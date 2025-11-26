const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SMSService {
  constructor(db) {
    this.db = db;
    this.port = null;
    this.phoneNumbers = [];
    this.alertedTargets = new Map(); // Track which targets we've alerted about
    this.modemPath = null;
  }

  async initialize() {
    console.log('[SMS] Initializing SMS service');

    try {
      // Try to find SIMCOM7600 modem
      await this.detectModem();

      if (this.modemPath) {
        await this.initializeModem();
      } else {
        console.log('[SMS] SIMCOM7600 modem not found, SMS alerts disabled');
        console.log('[SMS] SMS messages will be logged only');
      }

      // Load SMS numbers from database
      this.phoneNumbers = this.db.getSMSNumbers();
      console.log(`[SMS] Loaded ${this.phoneNumbers.length} phone number(s)`);
    } catch (error) {
      console.log('[SMS] Error initializing SMS service:', error.message);
      console.log('[SMS] SMS messages will be logged only');
    }
  }

  async detectModem() {
    try {
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();

      // Look for SIMCOM7600 or similar modems
      for (const port of ports) {
        if (
          port.manufacturer?.includes('SIMCOM') ||
          port.manufacturer?.includes('SimTech') ||
          port.vendorId === '1e0e' // SIMCOM vendor ID
        ) {
          this.modemPath = port.path;
          console.log(`[SMS] Found SIMCOM modem at ${this.modemPath}`);
          return;
        }
      }

      // Try common modem paths (try /dev/ttyUSB2 first as it's most common for SIMCOM7600)
      const commonPaths = ['/dev/ttyUSB2', '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB3', '/dev/ttyACM0'];
      for (const path of commonPaths) {
        try {
          const testPort = new SerialPort({ path, baudRate: 115200 });
          await new Promise((resolve, reject) => {
            testPort.on('open', () => {
              this.modemPath = path;
              testPort.close();
              resolve();
            });
            testPort.on('error', reject);
          });
          if (this.modemPath) {
            console.log(`[SMS] Found modem at ${this.modemPath}`);
            return;
          }
        } catch (error) {
          // Try next path
        }
      }
    } catch (error) {
      console.log('[SMS] Error detecting modem:', error.message);
    }
  }

  async initializeModem() {
    try {
      this.port = new SerialPort({
        path: this.modemPath,
        baudRate: 115200
      });

      const parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      parser.on('data', (data) => {
        console.log('[SMS] Modem response:', data);
      });

      this.port.on('error', (err) => {
        console.log('[SMS] Modem error:', err.message);
      });

      // Wait for port to open
      await new Promise((resolve, reject) => {
        this.port.on('open', resolve);
        this.port.on('error', reject);
      });

      // Initialize modem with AT commands
      await this.sendATCommand('AT');
      await this.sendATCommand('AT+CMGF=1'); // Text mode
      await this.sendATCommand('AT+CNMI=1,2,0,0,0'); // New message indication

      console.log('[SMS] Modem initialized successfully');
    } catch (error) {
      console.log('[SMS] Error initializing modem:', error.message);
      this.port = null;
    }
  }

  sendATCommand(command, wait = 500) {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        return reject(new Error('Modem not connected'));
      }

      console.log(`[SMS] >> ${command}`);
      this.port.write(command + '\r', (err) => {
        if (err) {
          return reject(err);
        }

        // Wait for response
        setTimeout(() => {
          // Read any response
          if (this.port.readable) {
            this.port.read(); // Consume the response
          }
          resolve();
        }, wait);
      });
    });
  }

  setNumbers(numbers) {
    this.phoneNumbers = numbers;
  }

  async sendTargetAlert(device, location) {
    const alertKey = `${device.address}-${Math.floor(Date.now() / 60000)}`; // Throttle: once per minute

    // Check if we've already alerted for this target recently
    if (this.alertedTargets.has(alertKey)) {
      return;
    }

    this.alertedTargets.set(alertKey, Date.now());

    // Clean up old alerts (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, time] of this.alertedTargets.entries()) {
      if (time < fiveMinutesAgo) {
        this.alertedTargets.delete(key);
      }
    }

    const target = this.db.getTargets().find(t =>
      t.address.toLowerCase() === device.address.toLowerCase()
    );

    // Get system name from settings
    const systemName = this.db.getSetting('systemName') || 'BlueK9-01';

    // Current time of detection
    const timeCollected = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const locationStr = location
      ? `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`
      : 'Unknown';

    const message = `BlueK9 TARGET DETECTED
BD Addr: ${device.address}
Time: ${timeCollected}
System: ${systemName}
Location: ${locationStr}
Device: ${target?.name || device.name || 'Unknown'}
RSSI: ${device.rssi} dBm`;

    console.log('[SMS] TARGET DETECTED - Sending alerts');
    console.log(message);

    // Log the alert
    this.db.addLog('alert', `Target detected: ${device.address} on ${systemName}`, device);

    // Send SMS to all configured numbers
    for (const number of this.phoneNumbers) {
      try {
        await this.sendSMS(number, message);
        console.log(`[SMS] Alert sent to ${number}`);
      } catch (err) {
        console.error(`[SMS] Failed to send alert to ${number}:`, err);
      }
    }
  }

  async sendSMS(phoneNumber, message) {
    // Add +1 if not present (US numbers)
    let fullNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      fullNumber = '+1' + phoneNumber.replace(/\D/g, '');
    }

    console.log(`[SMS] Sending SMS to ${fullNumber}`);

    if (!this.port || !this.port.isOpen) {
      console.log(`[SMS] Modem not available - Message logged only`);
      console.log(`[SMS] To: ${fullNumber}`);
      console.log(`[SMS] Message: ${message}`);
      return;
    }

    try {
      // Wake the modem
      await this.sendATCommand('AT');

      // Set SMS text mode
      await this.sendATCommand('AT+CMGF=1');

      // Start message
      await this.sendATCommand(`AT+CMGS="${fullNumber}"`, 1000);

      // Write message text
      console.log('[SMS] >> (message body)');
      await new Promise((resolve, reject) => {
        this.port.write(message, (err) => {
          if (err) return reject(err);
          setTimeout(resolve, 200);
        });
      });

      // Send Ctrl+Z to finalize
      console.log('[SMS] >> <Ctrl+Z>');
      await new Promise((resolve, reject) => {
        this.port.write(Buffer.from([26]), (err) => {
          if (err) return reject(err);
          setTimeout(resolve, 3000); // Wait for modem to process
        });
      });

      console.log(`[SMS] Message sent successfully to ${fullNumber}`);
    } catch (error) {
      console.log(`[SMS] Error sending message to ${fullNumber}:`, error.message);
    }
  }

  async testSMS(phoneNumber, message) {
    await this.sendSMS(phoneNumber, message);
  }
}

module.exports = SMSService;
