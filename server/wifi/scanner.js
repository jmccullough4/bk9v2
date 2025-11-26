const { spawn } = require('child_process');
const EventEmitter = require('events');

class WiFiScanner extends EventEmitter {
  constructor() {
    super();
    this.scanning = false;
    this.scanProcess = null;
    this.monitorInterfaces = new Map(); // Track interfaces in monitor mode
  }

  // Put interface in monitor mode
  async enableMonitorMode(iface) {
    return new Promise((resolve, reject) => {
      // Check if interface is already in monitor mode
      if (this.monitorInterfaces.has(iface)) {
        return resolve({ interface: iface, monInterface: this.monitorInterfaces.get(iface) });
      }

      // Kill any processes using the interface
      const killProcess = spawn('airmon-ng', ['check', 'kill']);

      killProcess.on('close', () => {
        // Enable monitor mode
        const monProcess = spawn('airmon-ng', ['start', iface]);
        let output = '';

        monProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        monProcess.stderr.on('data', (data) => {
          output += data.toString();
        });

        monProcess.on('close', (code) => {
          if (code === 0) {
            // Parse the monitor interface name (usually wlan0mon or similar)
            const match = output.match(/monitor mode (?:vif )?enabled (?:for|on) \[?(\w+)\]?/i) ||
                          output.match(/\(mac80211 monitor mode (?:vif )?enabled on \[?(\w+)\]?\)/i);

            const monInterface = match ? match[1] : `${iface}mon`;
            this.monitorInterfaces.set(iface, monInterface);

            this.emit('log', { level: 'info', message: `Monitor mode enabled: ${monInterface}` });
            resolve({ interface: iface, monInterface });
          } else {
            // If airmon-ng fails, try manual mode
            this.manualMonitorMode(iface)
              .then(resolve)
              .catch(reject);
          }
        });

        monProcess.on('error', () => {
          // If airmon-ng not available, try manual mode
          this.manualMonitorMode(iface)
            .then(resolve)
            .catch(reject);
        });
      });
    });
  }

  // Manually enable monitor mode using iw/iwconfig
  async manualMonitorMode(iface) {
    return new Promise((resolve, reject) => {
      // Bring interface down
      const downProcess = spawn('ip', ['link', 'set', iface, 'down']);

      downProcess.on('close', () => {
        // Set monitor mode
        const modeProcess = spawn('iw', ['dev', iface, 'set', 'type', 'monitor']);

        modeProcess.on('close', (code) => {
          if (code !== 0) {
            // Try iwconfig as fallback
            const iwconfigProcess = spawn('iwconfig', [iface, 'mode', 'monitor']);
            iwconfigProcess.on('close', () => {
              this.bringUpInterface(iface, resolve, reject);
            });
          } else {
            this.bringUpInterface(iface, resolve, reject);
          }
        });

        modeProcess.on('error', () => {
          // Try iwconfig as fallback
          const iwconfigProcess = spawn('iwconfig', [iface, 'mode', 'monitor']);
          iwconfigProcess.on('close', () => {
            this.bringUpInterface(iface, resolve, reject);
          });
        });
      });
    });
  }

  bringUpInterface(iface, resolve, reject) {
    const upProcess = spawn('ip', ['link', 'set', iface, 'up']);

    upProcess.on('close', (code) => {
      if (code === 0) {
        this.monitorInterfaces.set(iface, iface);
        this.emit('log', { level: 'info', message: `Monitor mode enabled: ${iface}` });
        resolve({ interface: iface, monInterface: iface });
      } else {
        reject(new Error(`Failed to bring up interface ${iface}`));
      }
    });
  }

  // Disable monitor mode
  async disableMonitorMode(iface) {
    return new Promise((resolve) => {
      const monInterface = this.monitorInterfaces.get(iface);
      if (!monInterface) {
        return resolve();
      }

      // Try airmon-ng stop first
      const stopProcess = spawn('airmon-ng', ['stop', monInterface]);

      stopProcess.on('close', () => {
        this.monitorInterfaces.delete(iface);
        resolve();
      });

      stopProcess.on('error', () => {
        // Manual cleanup
        this.manualDisableMonitor(iface, monInterface, resolve);
      });
    });
  }

  async manualDisableMonitor(iface, monInterface, resolve) {
    const downProcess = spawn('ip', ['link', 'set', monInterface, 'down']);

    downProcess.on('close', () => {
      const modeProcess = spawn('iw', ['dev', monInterface, 'set', 'type', 'managed']);

      modeProcess.on('close', () => {
        const upProcess = spawn('ip', ['link', 'set', iface, 'up']);
        upProcess.on('close', () => {
          this.monitorInterfaces.delete(iface);
          resolve();
        });
      });

      modeProcess.on('error', () => {
        this.monitorInterfaces.delete(iface);
        resolve();
      });
    });
  }

  // Start WiFi scanning
  async startScan(interfaces = []) {
    if (this.scanning) {
      return;
    }

    this.scanning = true;
    this.emit('log', { level: 'info', message: 'WiFi scanning started' });

    // If no interfaces provided, detect available WiFi interfaces
    if (interfaces.length === 0) {
      interfaces = await this.detectWiFiInterfaces();
    }

    if (interfaces.length === 0) {
      this.emit('log', { level: 'warning', message: 'No WiFi interfaces found, using virtual scan' });
      this.startVirtualScan();
      return;
    }

    // Enable monitor mode on all interfaces
    for (const iface of interfaces) {
      try {
        await this.enableMonitorMode(iface);
      } catch (error) {
        this.emit('log', { level: 'error', message: `Failed to enable monitor mode on ${iface}: ${error.message}` });
      }
    }

    // Start passive scanning using airodump-ng or tshark
    this.startPassiveScan();
  }

  // Detect available WiFi interfaces
  async detectWiFiInterfaces() {
    return new Promise((resolve) => {
      const interfaces = [];
      const process = spawn('iwconfig');
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', () => {
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/^(wlan\d+|wlp\d+s\d+|wlo\d+)\s+IEEE/);
          if (match) {
            interfaces.push(match[1]);
          }
        }
        resolve(interfaces);
      });

      process.on('error', () => {
        resolve([]);
      });
    });
  }

  // Start passive WiFi scanning
  startPassiveScan() {
    const monInterfaces = Array.from(this.monitorInterfaces.values());

    if (monInterfaces.length === 0) {
      this.emit('log', { level: 'warning', message: 'No monitor interfaces available' });
      return;
    }

    // Try airodump-ng first
    this.scanProcess = spawn('airodump-ng', [
      '--output-format', 'csv',
      '--write', '/tmp/bluek9-wifi',
      '--background', '1',
      monInterfaces[0]
    ]);

    this.scanProcess.on('error', () => {
      // If airodump-ng not available, try tshark
      this.emit('log', { level: 'info', message: 'airodump-ng not available, trying tshark' });
      this.startTsharkScan(monInterfaces[0]);
    });

    this.scanProcess.stdout.on('data', (data) => {
      this.parseAirodumpOutput(data.toString());
    });

    this.scanProcess.stderr.on('data', (data) => {
      this.parseAirodumpOutput(data.toString());
    });

    // Poll the CSV file for results
    this.csvPollInterval = setInterval(() => {
      this.parseAirodumpCSV();
    }, 5000);
  }

  // Start tshark scanning as fallback
  startTsharkScan(iface) {
    this.scanProcess = spawn('tshark', [
      '-i', iface,
      '-I',
      '-Y', 'wlan.fc.type == 0',
      '-T', 'fields',
      '-e', 'wlan.sa',
      '-e', 'wlan_radio.signal_dbm',
      '-e', 'wlan.ssid'
    ]);

    this.scanProcess.stdout.on('data', (data) => {
      this.parseTsharkOutput(data.toString());
    });
  }

  // Parse airodump-ng CSV output
  parseAirodumpCSV() {
    const fs = require('fs');
    const csvFile = '/tmp/bluek9-wifi-01.csv';

    try {
      if (!fs.existsSync(csvFile)) {
        return;
      }

      const content = fs.readFileSync(csvFile, 'utf8');
      const lines = content.split('\n');

      let inAPSection = false;
      for (const line of lines) {
        if (line.includes('BSSID')) {
          inAPSection = true;
          continue;
        }

        if (line.includes('Station MAC')) {
          inAPSection = false;
          continue;
        }

        if (inAPSection && line.trim()) {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 14) {
            const bssid = parts[0];
            const power = parseInt(parts[8]);
            const ssid = parts[13];

            if (bssid && bssid.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
              this.emit('device', {
                address: bssid,
                name: ssid || 'Hidden Network',
                rssi: power,
                type: 'WiFi AP',
                manufacturer: this.getManufacturer(bssid)
              });
            }
          }
        }
      }
    } catch (error) {
      // Ignore file read errors
    }
  }

  // Parse airodump-ng output
  parseAirodumpOutput(output) {
    // Airodump-ng output is primarily in CSV format
    // Live output parsing is minimal, main parsing happens in CSV
  }

  // Parse tshark output
  parseTsharkOutput(output) {
    const lines = output.split('\n');

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const address = parts[0].trim();
        const rssi = parseInt(parts[1]) || -70;
        const ssid = parts[2] ? parts[2].trim() : 'Unknown';

        if (address && address.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)) {
          this.emit('device', {
            address: address,
            name: ssid,
            rssi: rssi,
            type: 'WiFi',
            manufacturer: this.getManufacturer(address)
          });
        }
      }
    }
  }

  // Virtual WiFi scan for development
  startVirtualScan() {
    const virtualAPs = [
      { ssid: 'HomeNetwork-5G', channel: 36 },
      { ssid: 'OfficeWiFi', channel: 6 },
      { ssid: 'Guest-Network', channel: 11 },
      { ssid: 'Hidden Network', channel: 1 },
    ];

    this.scanInterval = setInterval(() => {
      virtualAPs.forEach(ap => {
        const address = this.generateRandomMAC();
        this.emit('device', {
          address: address,
          name: ap.ssid,
          rssi: -50 - Math.floor(Math.random() * 50),
          type: 'WiFi AP',
          manufacturer: this.getManufacturer(address)
        });
      });
    }, 10000);
  }

  // Stop scanning
  async stopScan() {
    this.scanning = false;

    if (this.scanProcess) {
      this.scanProcess.kill();
      this.scanProcess = null;
    }

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.csvPollInterval) {
      clearInterval(this.csvPollInterval);
      this.csvPollInterval = null;
    }

    // Disable monitor mode on all interfaces
    for (const [iface] of this.monitorInterfaces) {
      await this.disableMonitorMode(iface);
    }

    this.emit('log', { level: 'info', message: 'WiFi scanning stopped' });
  }

  // Get manufacturer from MAC address OUI
  getManufacturer(address) {
    const oui = address.substring(0, 8).toUpperCase();
    const manufacturers = {
      '00:1A:11': 'Google',
      '00:50:F2': 'Microsoft',
      '00:03:93': 'Apple',
      '00:1B:63': 'Apple',
      '00:26:BB': 'Apple',
      'AC:DE:48': 'Apple',
      '00:17:F2': 'Apple',
      '00:0D:93': 'Apple',
      '28:E1:4C': 'Apple',
      '68:9C:70': 'Apple',
      '18:AF:61': 'Google',
      '3C:5A:B4': 'Google',
      '54:60:09': 'Google',
    };

    return manufacturers[oui] || 'Unknown';
  }

  // Generate random MAC address for virtual scan
  generateRandomMAC() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      if (i > 0) mac += ':';
      mac += hex.charAt(Math.floor(Math.random() * 16));
      mac += hex.charAt(Math.floor(Math.random() * 16));
    }
    return mac;
  }
}

module.exports = WiFiScanner;
