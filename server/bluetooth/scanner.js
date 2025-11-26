const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class BluetoothScanner extends EventEmitter {
  constructor(db, io) {
    super();
    this.db = db;
    this.io = io;
    this.scanning = false;
    this.radios = [];
    this.scanProcesses = new Map();
    this.rssiMonitor = null;
  }

  async initialize() {
    this.db.addLog('info', 'Initializing Bluetooth scanner');
    await this.discoverRadios();
    this.log('Bluetooth scanner initialized');
  }

  async discoverRadios() {
    try {
      // Discover Bluetooth adapters using hciconfig
      const { stdout } = await execPromise('hciconfig -a');
      const hciRegex = /(hci\d+):/g;
      const matches = [...stdout.matchAll(hciRegex)];

      this.radios = matches.map((match, index) => ({
        id: match[1],
        name: match[1],
        type: 'bluetooth',
        enabled: index === 0, // Enable first radio by default
        status: 'ready'
      }));

      // Check for Sena UD100 specifically
      const senaRadio = this.radios.find(r => r.id === 'hci0');
      if (senaRadio) {
        senaRadio.name = 'Sena UD100 (hci0)';
        senaRadio.primary = true;
      }

      this.log(`Discovered ${this.radios.length} Bluetooth adapter(s)`);
      this.io.emit('radiosUpdate', this.radios);
    } catch (error) {
      this.log('Error discovering Bluetooth adapters: ' + error.message, 'error');
      // Add a virtual radio for development
      this.radios = [{
        id: 'hci0',
        name: 'Virtual Bluetooth Adapter',
        type: 'bluetooth',
        enabled: true,
        status: 'ready',
        virtual: true
      }];
      this.io.emit('radiosUpdate', this.radios);
    }
  }

  getRadios() {
    return this.radios;
  }

  addRadio(radio) {
    const newRadio = {
      id: radio.id || `radio-${Date.now()}`,
      name: radio.name,
      type: radio.type || 'bluetooth',
      enabled: true,
      status: 'ready'
    };
    this.radios.push(newRadio);
    this.io.emit('radiosUpdate', this.radios);
    this.log(`Radio added: ${newRadio.name}`);
    return newRadio;
  }

  removeRadio(id) {
    this.radios = this.radios.filter(r => r.id !== id);
    this.io.emit('radiosUpdate', this.radios);
    this.log(`Radio removed: ${id}`);
  }

  async startScanning() {
    if (this.scanning) {
      this.log('Scanning already in progress');
      return;
    }

    this.scanning = true;
    this.log('Starting Bluetooth scan (Classic + LE)');
    console.log('[BT-DEBUG] startScanning() called');
    console.log('[BT-DEBUG] Total radios:', this.radios.length);

    const enabledRadios = this.radios.filter(r => r.enabled);
    console.log('[BT-DEBUG] Enabled radios:', enabledRadios.length);
    console.log('[BT-DEBUG] Radios:', JSON.stringify(enabledRadios, null, 2));

    for (const radio of enabledRadios) {
      if (radio.virtual) {
        // Start virtual scanning for development
        console.log('[BT-DEBUG] Starting virtual scan for', radio.id);
        this.startVirtualScan(radio);
      } else {
        // Start real Bluetooth scanning
        console.log('[BT-DEBUG] Starting real scan for', radio.id);
        await this.startRealScan(radio);
      }
    }

    // Start RSSI monitoring
    this.startRSSIMonitoring();
  }

  async startRealScan(radio) {
    try {
      // Enable the adapter
      await execPromise(`hciconfig ${radio.id} up`);

      // Scan for Classic Bluetooth devices
      this.scanClassic(radio);

      // Scan for BLE devices
      this.scanLE(radio);

      radio.status = 'scanning';
      this.io.emit('radiosUpdate', this.radios);
    } catch (error) {
      this.log(`Error starting scan on ${radio.id}: ${error.message}`, 'error');
      radio.status = 'error';
      this.io.emit('radiosUpdate', this.radios);
    }
  }

  scanClassic(radio) {
    // Use hcitool to scan for Classic Bluetooth devices
    const scanProcess = spawn('hcitool', ['scan', '--flush']);

    scanProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Parse line format: "XX:XX:XX:XX:XX:XX  Device Name"
        const match = line.match(/([0-9A-F:]{17})\s+(.+)/i);
        if (match) {
          const address = match[1];
          const name = match[2].trim();
          this.handleDeviceDetection({
            address,
            name,
            deviceType: 'Classic',
            radioId: radio.id
          });
        }
      }
    });

    this.scanProcesses.set(`${radio.id}-classic`, scanProcess);
  }

  scanLE(radio) {
    // Use hcitool for LE scan
    const scanProcess = spawn('hcitool', ['lescan', '--duplicates']);

    scanProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Parse line format: "XX:XX:XX:XX:XX:XX Device Name"
        const match = line.match(/([0-9A-F:]{17})\s+(.+)/i);
        if (match) {
          const address = match[1];
          const name = match[2].trim() || '(Unknown)';
          this.handleDeviceDetection({
            address,
            name,
            deviceType: 'LE',
            radioId: radio.id
          });
        }
      }
    });

    this.scanProcesses.set(`${radio.id}-le`, scanProcess);
  }

  startRSSIMonitoring() {
    // Monitor RSSI for detected devices
    this.rssiMonitor = setInterval(async () => {
      const devices = this.db.getDevices();
      for (const device of devices) {
        try {
          // Get RSSI using hcitool
          const { stdout } = await execPromise(`hcitool rssi ${device.address}`);
          const rssiMatch = stdout.match(/RSSI return value: (-?\d+)/);
          if (rssiMatch) {
            const rssi = parseInt(rssiMatch[1]);
            device.rssi = rssi;
            this.handleDeviceDetection(device);
          }
        } catch (error) {
          // Device may not be in range anymore
        }
      }
    }, 5000); // Check every 5 seconds
  }

  startVirtualScan(radio) {
    // Virtual scanning for development/testing
    this.log('Starting virtual scan (development mode)');
    console.log('[BT-DEBUG] Virtual scan started for radio:', radio.id);

    const virtualDevices = [
      { address: '00:11:22:33:44:55', name: 'Virtual Device 1', type: 'LE' },
      { address: 'AA:BB:CC:DD:EE:FF', name: 'Virtual Device 2', type: 'Classic' },
      { address: '11:22:33:44:55:66', name: 'Test Target', type: 'LE' },
    ];

    let index = 0;
    const virtualInterval = setInterval(() => {
      if (!this.scanning) {
        console.log('[BT-DEBUG] Virtual scan stopped - scanning is false');
        clearInterval(virtualInterval);
        return;
      }

      const device = virtualDevices[index % virtualDevices.length];
      const deviceData = {
        ...device,
        deviceType: device.type,
        radioId: radio.id,
        rssi: -50 - Math.floor(Math.random() * 50) // Random RSSI between -50 and -100
      };

      console.log('[BT-DEBUG] Virtual device detected:', deviceData.address, deviceData.name, 'RSSI:', deviceData.rssi);
      this.handleDeviceDetection(deviceData);

      index++;
    }, 3000); // Detect a device every 3 seconds

    this.scanProcesses.set(`${radio.id}-virtual`, { kill: () => clearInterval(virtualInterval) });
    radio.status = 'scanning';
    this.io.emit('radiosUpdate', this.radios);
  }

  async handleDeviceDetection(deviceData) {
    console.log('[BT-DEBUG] handleDeviceDetection called for:', deviceData.address);

    // Get current GPS location
    const gpsLocation = await this.getCurrentGPSLocation();
    console.log('[BT-DEBUG] GPS location:', gpsLocation);

    // Get manufacturer from OUI lookup
    const manufacturer = this.lookupManufacturer(deviceData.address);

    // Calculate emitter location using geolocation algorithm
    const emitterLocation = await this.calculateEmitterLocation(
      deviceData.address,
      deviceData.rssi,
      gpsLocation
    );

    const device = {
      address: deviceData.address,
      name: deviceData.name || '(Unknown)',
      manufacturer,
      deviceType: deviceData.deviceType,
      rssi: deviceData.rssi ?? null,
      systemLat: gpsLocation.lat,
      systemLon: gpsLocation.lon,
      emitterLat: emitterLocation.lat,
      emitterLon: emitterLocation.lon,
      emitterAccuracy: emitterLocation.accuracy,
      radioId: deviceData.radioId
    };

    console.log('[BT-DEBUG] Device object prepared:', JSON.stringify(device, null, 2));

    // Save to database
    const savedDevice = this.db.upsertDevice(device);
    console.log('[BT-DEBUG] Device saved to database:', savedDevice ? 'SUCCESS' : 'FAILED');

    // Emit event
    this.emit('deviceDetected', savedDevice);
    console.log('[BT-DEBUG] deviceDetected event emitted for:', savedDevice.address);
  }

  lookupManufacturer(address) {
    // OUI lookup table (first 3 octets)
    const oui = address.substring(0, 8).toUpperCase();
    const ouiMap = {
      '00:11:22': 'CIMSYS Inc',
      'AA:BB:CC': 'Virtual Vendor',
      '11:22:33': 'Test Manufacturer',
      '00:1A:7D': 'Sena Technologies',
      '00:0E:6D': 'Apple, Inc.',
      'DC:2C:26': 'Apple, Inc.',
      '5C:F3:70': 'Broadcom',
      '00:25:00': 'Apple, Inc.',
    };

    return ouiMap[oui] || 'Unknown';
  }

  async calculateEmitterLocation(address, rssi, systemLocation) {
    // Advanced geolocation algorithm using trilateration
    // Get RSSI history for this device
    const history = this.db.getRSSIHistory(address);

    if (history.length < 3) {
      // Not enough data for trilateration, use simple path loss model
      const distance = this.calculateDistance(rssi);
      return {
        lat: systemLocation.lat,
        lon: systemLocation.lon,
        accuracy: distance
      };
    }

    // Use the last 3 strongest RSSI readings for trilateration
    const strongestReadings = history
      .sort((a, b) => b.rssi - a.rssi)
      .slice(0, 3);

    // Trilateration calculation
    const circles = strongestReadings.map(reading => ({
      lat: reading.systemLat,
      lon: reading.systemLon,
      radius: this.calculateDistance(reading.rssi)
    }));

    const estimated = this.trilaterate(circles);

    return {
      lat: estimated.lat || systemLocation.lat,
      lon: estimated.lon || systemLocation.lon,
      accuracy: estimated.accuracy || 50
    };
  }

  calculateDistance(rssi) {
    // Path loss model: RSSI = -10 * n * log10(d) + A
    // Where: n = path loss exponent (2-4), A = RSSI at 1 meter (-59 for BLE)
    const txPower = -59; // Assumed TX power at 1 meter
    const n = 2.5; // Path loss exponent

    if (rssi === 0) {
      return -1; // Invalid RSSI
    }

    const ratio = (txPower - rssi) / (10 * n);
    return Math.pow(10, ratio); // Distance in meters
  }

  trilaterate(circles) {
    // Simplified trilateration algorithm
    if (circles.length < 3) {
      return { lat: circles[0].lat, lon: circles[0].lon, accuracy: circles[0].radius };
    }

    // Convert to Cartesian coordinates
    const R = 6371000; // Earth radius in meters

    const points = circles.map(c => {
      const latRad = c.lat * Math.PI / 180;
      const lonRad = c.lon * Math.PI / 180;
      return {
        x: R * Math.cos(latRad) * Math.cos(lonRad),
        y: R * Math.cos(latRad) * Math.sin(lonRad),
        z: R * Math.sin(latRad),
        r: c.radius
      };
    });

    // Use weighted centroid based on signal strength (inverse of radius)
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    points.forEach(p => {
      const weight = 1 / (p.r * p.r); // Inverse square weighting
      totalWeight += weight;
      weightedX += p.x * weight;
      weightedY += p.y * weight;
      weightedZ += p.z * weight;
    });

    const avgX = weightedX / totalWeight;
    const avgY = weightedY / totalWeight;
    const avgZ = weightedZ / totalWeight;

    // Convert back to lat/lon
    const lat = Math.atan2(avgZ, Math.sqrt(avgX * avgX + avgY * avgY)) * 180 / Math.PI;
    const lon = Math.atan2(avgY, avgX) * 180 / Math.PI;

    // Calculate accuracy (CEP)
    const maxRadius = Math.max(...circles.map(c => c.radius));
    const accuracy = maxRadius * 0.5; // 50% CEP

    return { lat, lon, accuracy };
  }

  async getCurrentGPSLocation() {
    // This will be populated by GPS service
    // For now return a default location
    return {
      lat: 37.7749,
      lon: -122.4194,
      accuracy: 10
    };
  }

  stopScanning() {
    if (!this.scanning) {
      return;
    }

    this.scanning = false;
    this.log('Stopping Bluetooth scan');

    // Kill all scan processes
    for (const [key, process] of this.scanProcesses) {
      try {
        process.kill();
      } catch (error) {
        // Process may already be dead
      }
    }
    this.scanProcesses.clear();

    // Stop RSSI monitoring
    if (this.rssiMonitor) {
      clearInterval(this.rssiMonitor);
      this.rssiMonitor = null;
    }

    // Update radio status
    this.radios.forEach(r => {
      r.status = 'ready';
    });
    this.io.emit('radiosUpdate', this.radios);
  }

  log(message, level = 'info') {
    console.log(`[BluetoothScanner] ${message}`);
    this.db.addLog(level, message);
    this.io.emit('log', { level, message, timestamp: Date.now() });
  }
}

module.exports = BluetoothScanner;
