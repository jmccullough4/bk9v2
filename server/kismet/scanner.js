const EventEmitter = require('events');
const http = require('http');

class KismetScanner extends EventEmitter {
  constructor(db, io) {
    super();
    this.db = db;
    this.io = io;
    this.scanning = false;
    this.pollInterval = null;
    this.seenDevices = new Map(); // Track devices we've already seen
    this.kismetUrl = 'http://localhost:2501';
    this.lastTimestamp = Date.now() / 1000; // Kismet uses Unix timestamps
  }

  async initialize() {
    console.log('[Kismet] Initializing Kismet scanner');

    // Check if Kismet is running
    const isRunning = await this.checkKismetRunning();
    if (isRunning) {
      console.log('[Kismet] Kismet server detected and running');
    } else {
      console.log('[Kismet] Kismet server not detected');
      console.log('[Kismet] Start Kismet with: kismet -c wlo1');
    }
  }

  async checkKismetRunning() {
    return new Promise((resolve) => {
      const req = http.get(`${this.kismetUrl}/system/status.json`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async fetchDevices() {
    return new Promise((resolve, reject) => {
      const url = `${this.kismetUrl}/devices/views/all/devices.json`;

      http.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const devices = JSON.parse(data);
            resolve(devices);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (e) => {
        reject(e);
      });
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
      console.log('[Kismet] Error: Kismet server not running');
      console.log('[Kismet] Start Kismet with: kismet -c wlo1');
      this.io.emit('log', {
        level: 'error',
        message: 'Kismet not running. Start with: kismet -c wlo1',
        timestamp: Date.now()
      });
      return;
    }

    this.scanning = true;
    console.log('[Kismet] Starting device polling');

    // Poll Kismet for devices every 3 seconds
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollDevices();
      } catch (error) {
        console.error('[Kismet] Error polling devices:', error.message);
      }
    }, 3000);

    // Do initial poll immediately
    this.pollDevices();
  }

  async pollDevices() {
    try {
      const devices = await this.fetchDevices();

      for (const device of devices) {
        this.processKismetDevice(device);
      }
    } catch (error) {
      console.error('[Kismet] Error fetching devices:', error.message);
    }
  }

  processKismetDevice(kismetDevice) {
    try {
      // Extract device key (unique identifier)
      const deviceKey = kismetDevice['kismet.device.base.key'];
      const macAddr = kismetDevice['kismet.device.base.macaddr'];
      const name = kismetDevice['kismet.device.base.name'] || kismetDevice['kismet.device.base.commonname'] || '(Unknown)';
      const type = kismetDevice['kismet.device.base.type'];
      const lastTime = kismetDevice['kismet.device.base.last_time'];

      // Skip if we've already processed this device recently
      const deviceId = `${type}-${macAddr}`;
      if (this.seenDevices.has(deviceId)) {
        const lastSeen = this.seenDevices.get(deviceId);
        if (lastTime <= lastSeen) {
          return; // Haven't seen new activity for this device
        }
      }

      // Update last seen time
      this.seenDevices.set(deviceId, lastTime);

      // Determine device type and extract relevant data
      let deviceData = null;

      if (type === 'Wi-Fi AP' || type === 'Wi-Fi Device') {
        deviceData = this.extractWiFiDevice(kismetDevice);
      } else if (type === 'BTLE' || type === 'BT') {
        deviceData = this.extractBluetoothDevice(kismetDevice);
      }

      if (deviceData) {
        console.log('[Kismet] Device detected:', deviceData.address, deviceData.name, 'Type:', deviceData.deviceType);
        this.emit('device', deviceData);
      }
    } catch (error) {
      console.error('[Kismet] Error processing device:', error.message);
    }
  }

  extractWiFiDevice(kismetDevice) {
    const macAddr = kismetDevice['kismet.device.base.macaddr'];
    const name = kismetDevice['kismet.device.base.name'] ||
                 kismetDevice['dot11.device']?.['dot11.device.last_beaconed_ssid'] ||
                 '(Unknown)';
    const type = kismetDevice['kismet.device.base.type'];
    const signal = kismetDevice['kismet.device.base.signal']?.['kismet.common.signal.last_signal'] || null;
    const channel = kismetDevice['kismet.device.base.channel'] || null;
    const manuf = kismetDevice['kismet.device.base.manuf'] || 'Unknown';

    return {
      address: macAddr,
      name: name,
      manufacturer: manuf,
      deviceType: type === 'Wi-Fi AP' ? 'WiFi AP' : 'WiFi',
      rssi: signal,
      channel: channel,
      radioId: 'kismet'
    };
  }

  extractBluetoothDevice(kismetDevice) {
    const macAddr = kismetDevice['kismet.device.base.macaddr'];
    const name = kismetDevice['kismet.device.base.name'] || '(Unknown)';
    const type = kismetDevice['kismet.device.base.type'];
    const signal = kismetDevice['kismet.device.base.signal']?.['kismet.common.signal.last_signal'] || null;
    const manuf = kismetDevice['kismet.device.base.manuf'] || 'Unknown';

    return {
      address: macAddr,
      name: name,
      manufacturer: manuf,
      deviceType: type === 'BTLE' ? 'BLE' : 'Classic',
      rssi: signal,
      radioId: 'kismet'
    };
  }

  stopScanning() {
    if (!this.scanning) {
      return;
    }

    this.scanning = false;
    console.log('[Kismet] Stopping device polling');

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
