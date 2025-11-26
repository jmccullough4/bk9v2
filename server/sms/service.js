const { SerialPort } = require('serialport');

class SMSService {
  constructor(db) {
    this.db = db;
    this.phoneNumbers = [];
    this.alertedTargets = new Map(); // Track which targets we've alerted about
    this.modemPath = null;
  }

  async initialize() {
    console.log('[SMS] Initializing SMS service');

    try {
      // IMPORTANT: Don't auto-detect modem to avoid interfering with internet connection
      // The SIMCOM7600 has multiple USB ports - some are for PPP/internet, some for AT commands
      // Only use the modem if explicitly configured in settings
      const configuredModemPath = this.db.getSetting('smsModemPath');

      if (configuredModemPath) {
        const fs = require('fs');
        if (fs.existsSync(configuredModemPath)) {
          this.modemPath = configuredModemPath;
          console.log(`[SMS] SMS modem configured at ${this.modemPath}`);
        } else {
          console.log(`[SMS] Configured modem path ${configuredModemPath} not found`);
          console.log('[SMS] SMS messages will be logged only');
        }
      } else {
        console.log('[SMS] SMS modem not configured');
        console.log('[SMS] To enable SMS alerts, configure the modem port in Settings > SMS');
        console.log('[SMS] IMPORTANT: Use a port that does NOT interfere with your internet connection');
        console.log('[SMS] For SIMCOM7600: typically /dev/ttyUSB2 or /dev/ttyUSB3 (NOT the PPP port)');
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
    if (phoneNumber.length === 10) {
      fullNumber = '1' + phoneNumber;
    }

    // If no modem path, just log
    if (!this.modemPath) {
      console.log('[SMS] SMS (modem not available):');
      console.log(`[SMS] To: ${fullNumber}`);
      console.log(`[SMS] Message: ${message}`);
      return;
    }

    let port = null;

    try {
      // Open port for this message only
      port = new SerialPort({
        path: this.modemPath,
        baudRate: 115200,
        autoOpen: false
      });

      // Open the port
      await new Promise((resolve, reject) => {
        port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('[SMS] Port opened for message');

      // Send AT command sequence (matching your Python script)
      await this.sendATCommand(port, 'AT', 500);
      await this.sendATCommand(port, 'AT+CMGF=1', 500);
      await this.sendATCommand(port, `AT+CMGS="${fullNumber}"`, 1000);

      // Write message text
      await new Promise((resolve, reject) => {
        port.write(message, (err) => {
          if (err) return reject(err);
          setTimeout(resolve, 200);
        });
      });

      // Send Ctrl+Z to send the message
      await new Promise((resolve, reject) => {
        port.write(Buffer.from([26]), (err) => {
          if (err) return reject(err);
          setTimeout(resolve, 3000); // Wait for send confirmation
        });
      });

      console.log('[SMS] Message sent successfully');

    } catch (error) {
      console.error('[SMS] Error sending SMS:', error.message);
      throw error;
    } finally {
      // Always close the port
      if (port && port.isOpen) {
        await new Promise((resolve) => {
          port.close((err) => {
            if (err) console.error('[SMS] Error closing port:', err.message);
            console.log('[SMS] Port closed');
            resolve();
          });
        });
      }
    }
  }

  sendATCommand(port, command, wait = 500) {
    return new Promise((resolve, reject) => {
      if (!port || !port.isOpen) {
        return reject(new Error('Port not open'));
      }

      console.log(`[SMS] >> ${command}`);
      port.write(command + '\r', (err) => {
        if (err) {
          return reject(err);
        }
        setTimeout(resolve, wait);
      });
    });
  }
}

module.exports = SMSService;
