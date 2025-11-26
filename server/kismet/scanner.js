const EventEmitter = require('events');
const http = require('http');
const https = require('https');

class KismetScanner extends EventEmitter {
  constructor(db, io) {
    super();
    this.db = db;
    this.io = io;
    this.scanning = false;
    this.pollInterval = null;
    this.seenDevices = new Map(); // Track devices we've already seen
    this.kismetUrl = process.env.KISMET_URL || 'http://localhost:2501';
    this.kismetApiKey = process.env.KISMET_API_KEY || '';
    this.lastTimestamp = Date.now() / 1000; // Kismet uses Unix timestamps

    console.log('[Kismet] Configured URL:', this.kismetUrl);
    if (this.kismetApiKey) {
      console.log('[Kismet] API key configured');
    }
  }

  async initialize() {
    console.log('[Kismet] Initializing Kismet scanner');

    // Check if Kismet is running
    const isRunning = await this.checkKismetRunning();
    if (isRunning) {
      console.log('[Kismet] ✓ Kismet server detected and running');
      this.log('Kismet server connected');
    } else {
      console.log('[Kismet] ✗ Kismet server not detected at', this.kismetUrl);
      console.log('[Kismet] To start Kismet: sudo kismet -c wlo1');
      console.log('[Kismet] Or if running elsewhere, set KISMET_URL environment variable');
    }
  }

  async checkKismetRunning() {
    return new Promise((resolve) => {
      const url = new URL('/system/status.json', this.kismetUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        timeout: 3000
      };

      // Add API key if configured
      if (this.kismetApiKey) {
        options.headers = {
          'KISMET': this.kismetApiKey
        };
      }

      const req = httpModule.get(options, (res) => {
        console.log('[Kismet] Health check response:', res.statusCode);

        // Accept 200 or 401 (auth required but server is running)
        resolve(res.statusCode === 200 || res.statusCode === 401);
      });

      req.on('error', (err) => {
        console.log('[Kismet] Connection error:', err.message);
        resolve(false);
      });

      req.on('timeout', () => {
        console.log('[Kismet] Connection timeout');
        req.destroy();
        resolve(false);
      });
    });
  }

  async fetchDevices() {
    return new Promise((resolve, reject) => {
      const url = new URL('/devices/views/all/devices.json', this.kismetUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      // Add API key if configured
      if (this.kismetApiKey) {
        options.headers = {
          'KISMET': this.kismetApiKey
        };
      }

      const req = httpModule.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const devices = JSON.parse(data);
              resolve(devices);
            } catch (e) {
              console.error('[Kismet] JSON parse error:', e.message);
              reject(e);
            }
          } else if (res.statusCode === 401) {
            console.error('[Kismet] Authentication required. Set KISMET_API_KEY environment variable.');
            reject(new Error('Authentication required'));
          } else {
            console.error('[Kismet] HTTP', res.statusCode, ':', data.substring(0, 200));
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async startScanning() {
    if (this.scanning) {
      console.log('[Kismet] Scanning already in progress');
      return;
    }

    // Check if Kismet is running
    const isRunning = await this.checkKismetRunning();
    if (!isRunning) {
      const msg = 'Kismet server not running';
      console.log('[Kismet] Error:', msg);
      console.log('[Kismet] Start Kismet with: sudo kismet -c wlo1');
      this.io.emit('log', {
        level: 'error',
        message: `${msg}. Start with: sudo kismet -c wlo1`,
        timestamp: Date.now()
      });
      return;
    }

    this.scanning = true;
    console.log('[Kismet-WiFi] ✓ Starting WiFi device polling');
    this.log('Started Kismet WiFi scanning');

    // Poll Kismet for devices every 2 seconds
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollDevices();
      } catch (error) {
        console.error('[Kismet] Poll error:', error.message);
      }
    }, 2000);

    // Do initial poll immediately
    this.pollDevices();
  }

  async pollDevices() {
    try {
      const devices = await this.fetchDevices();

      if (!Array.isArray(devices)) {
        console.error('[Kismet] Expected array of devices, got:', typeof devices);
        return;
      }

      let newDeviceCount = 0;
      for (const device of devices) {
        const processed = this.processKismetDevice(device);
        if (processed) newDeviceCount++;
      }

      if (newDeviceCount > 0) {
        console.log(`[Kismet] Processed ${newDeviceCount} new/updated devices`);
      }
    } catch (error) {
      if (error.message !== 'Authentication required') {
        console.error('[Kismet] Fetch error:', error.message);
      }
    }
  }

  processKismetDevice(kismetDevice) {
    try {
      // Extract device key (unique identifier)
      const macAddr = kismetDevice['kismet.device.base.macaddr'];
      if (!macAddr) return false;

      const name = kismetDevice['kismet.device.base.name'] ||
                   kismetDevice['kismet.device.base.commonname'] ||
                   '(Unknown)';
      const type = kismetDevice['kismet.device.base.type'];
      const lastTime = kismetDevice['kismet.device.base.last_time'] || 0;

      // Skip if we've already processed this device recently
      const deviceId = `${type}-${macAddr}`;
      if (this.seenDevices.has(deviceId)) {
        const lastSeen = this.seenDevices.get(deviceId);
        if (lastTime <= lastSeen) {
          return false; // No new activity
        }
      }

      // Update last seen time
      this.seenDevices.set(deviceId, lastTime);

      // ONLY process WiFi devices - Bluetooth is handled by BluetoothScanner
      let deviceData = null;

      if (type === 'Wi-Fi AP' || type === 'Wi-Fi Device' || type === 'Wi-Fi Client') {
        deviceData = this.extractWiFiDevice(kismetDevice);
      }
      // Note: Bluetooth devices (BTLE/BT) are now handled by BluetoothScanner with hcitool

      if (deviceData) {
        console.log('[Kismet-WiFi] Device:', deviceData.address, '|', deviceData.name, '|', deviceData.deviceType, '| RSSI:', deviceData.rssi);
        this.emit('device', deviceData);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Kismet] Device processing error:', error.message);
      return false;
    }
  }

  extractWiFiDevice(kismetDevice) {
    const macAddr = kismetDevice['kismet.device.base.macaddr'];
    const name = kismetDevice['kismet.device.base.name'] ||
                 kismetDevice['dot11.device']?.['dot11.device.last_beaconed_ssid'] ||
                 '(Unknown)';
    const type = kismetDevice['kismet.device.base.type'];
    const signal = kismetDevice['kismet.device.base.signal']?.['kismet.common.signal.last_signal'];
    const channel = kismetDevice['kismet.device.base.channel'];
    const manuf = kismetDevice['kismet.device.base.manuf'] || 'Unknown';

    return {
      address: macAddr,
      name: name,
      manufacturer: manuf,
      deviceType: type === 'Wi-Fi AP' ? 'WiFi AP' : 'WiFi',
      rssi: signal || null,
      channel: channel || null,
      radioId: 'kismet'
    };
  }

  stopScanning() {
    if (!this.scanning) {
      return;
    }

    this.scanning = false;
    console.log('[Kismet] Stopping device polling');
    this.log('Stopped Kismet device scanning');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Clear seen devices
    this.seenDevices.clear();
  }

  log(message, level = 'info') {
    console.log(`[Kismet] ${message}`);
    this.db.addLog(level, message);
    this.io.emit('log', { level, message, timestamp: Date.now() });
  }
}

module.exports = KismetScanner;
