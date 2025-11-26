const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SMSService {
  constructor(db) {
    this.db = db;
    this.phoneNumbers = [];
    this.alertedTargets = new Map(); // Track which targets we've alerted about
    this.modemPath = null;
  }

  async initialize() {
    console.log('[SMS] Initializing SMS service with mmcli (ModemManager)');

    try {
      // Detect modem using mmcli
      await this.detectModemWithMMCLI();

      if (this.modemPath) {
        console.log(`[SMS] Modem found: ${this.modemPath}`);
        console.log('[SMS] SMS alerts enabled via ModemManager (no port conflicts!)');
      } else {
        console.log('[SMS] No modem found by ModemManager');
        console.log('[SMS] Make sure ModemManager is running: systemctl status ModemManager');
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

  async detectModemWithMMCLI() {
    try {
      const { stdout } = await execPromise('mmcli -L');

      if (stdout.includes('No modems were found')) {
        console.log('[SMS] No modems detected by ModemManager');
        return;
      }

      // Parse modem path from mmcli -L output
      // Example line: /org/freedesktop/ModemManager1/Modem/0 [QUALCOMM INCORPORATED]
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('/Modem/')) {
          const parts = line.trim().split(/\s+/);
          this.modemPath = parts[0];
          console.log(`[SMS] Detected modem path: ${this.modemPath}`);
          return;
        }
      }
    } catch (error) {
      console.log('[SMS] mmcli not available or error:', error.message);
      console.log('[SMS] Install ModemManager: apt-get install modemmanager');
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
        // Small delay between messages to avoid overwhelming modem
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[SMS] Failed to send alert to ${number}:`, err);
      }
    }
  }

  async sendSMS(phoneNumber, message) {
    // Add +1 if not present (US numbers)
    let fullNumber = phoneNumber;
    if (phoneNumber.length === 10) {
      fullNumber = '+1' + phoneNumber;
    } else if (!phoneNumber.startsWith('+')) {
      fullNumber = '+1' + phoneNumber;
    }

    // If no modem path, just log
    if (!this.modemPath) {
      console.log('[SMS] SMS (modem not available):');
      console.log(`[SMS] To: ${fullNumber}`);
      console.log(`[SMS] Message: ${message}`);
      return;
    }

    try {
      console.log(`[SMS] Sending SMS to ${fullNumber} via mmcli`);

      // Clean message text - replace commas with semicolons (mmcli uses commas as separators)
      const safeText = message.replace(/,/g, ';');

      // Step 1: Create SMS using mmcli
      const smsArg = `text=${safeText},number=${fullNumber}`;
      const createCmd = `mmcli -m ${this.modemPath} --messaging-create-sms="${smsArg}"`;

      console.log('[SMS] Creating SMS with mmcli...');
      const { stdout: createOutput } = await execPromise(createCmd);

      // Extract SMS ID from output
      // Example: Successfully created new SMS: /org/freedesktop/ModemManager1/SMS/3
      let smsId = null;
      const lines = createOutput.split('\n');
      for (const line of lines) {
        if (line.includes('Successfully created new SMS:')) {
          const smsPath = line.split(':')[1].trim();
          smsId = smsPath.split('/').pop();
          console.log(`[SMS] Created SMS with ID: ${smsId}`);
          break;
        }
      }

      if (!smsId) {
        throw new Error('Could not extract SMS ID from mmcli output');
      }

      // Step 2: Send the SMS
      console.log(`[SMS] Sending SMS ID ${smsId}...`);
      const sendCmd = `mmcli -s ${smsId} --send`;
      await execPromise(sendCmd);

      console.log(`[SMS] ✓ SMS sent successfully to ${fullNumber}`);
    } catch (error) {
      console.error('[SMS] ✗ Error sending SMS:', error.message);
      console.error('[SMS] Message that failed:', message);
      throw error;
    }
  }
}

module.exports = SMSService;
