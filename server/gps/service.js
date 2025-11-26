const EventEmitter = require('events');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class GPSService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.currentLocation = {
      lat: 37.7749,
      lon: -122.4194,
      accuracy: 10,
      altitude: 0,
      speed: 0,
      heading: 0,
      timestamp: Date.now()
    };
    this.gpsDevice = null;
    this.updateInterval = null;
  }

  async initialize() {
    console.log('[GPS] Initializing GPS service');

    try {
      // Try to detect GPS device
      await this.detectGPSDevice();

      if (this.gpsDevice) {
        this.startGPSTracking();
      } else {
        // Use simulated GPS for development
        this.startSimulatedGPS();
      }
    } catch (error) {
      console.log('[GPS] Error initializing GPS:', error.message);
      this.startSimulatedGPS();
    }
  }

  async detectGPSDevice() {
    try {
      // Check for gpsd daemon
      const { stdout } = await execPromise('systemctl is-active gpsd');
      if (stdout.trim() === 'active') {
        this.gpsDevice = 'gpsd';
        console.log('[GPS] Found gpsd daemon');
        return;
      }
    } catch (error) {
      // gpsd not running
    }

    try {
      // Check for USB GPS devices
      const { stdout } = await execPromise('ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null');
      const devices = stdout.trim().split('\n').filter(d => d);
      if (devices.length > 0) {
        this.gpsDevice = devices[0];
        console.log(`[GPS] Found GPS device: ${this.gpsDevice}`);
        return;
      }
    } catch (error) {
      // No USB GPS devices found
    }

    console.log('[GPS] No GPS device found, using simulated GPS');
  }

  startGPSTracking() {
    console.log('[GPS] Starting GPS tracking');

    // In a real implementation, you would use node-gpsd or similar
    // For now, we'll simulate GPS data
    this.startSimulatedGPS();
  }

  startSimulatedGPS() {
    console.log('[GPS] Starting simulated GPS');

    // Simulate GPS updates every 1 second
    this.updateInterval = setInterval(() => {
      // Add small random movement to simulate vehicle movement
      const drift = 0.0001;
      this.currentLocation.lat += (Math.random() - 0.5) * drift;
      this.currentLocation.lon += (Math.random() - 0.5) * drift;
      this.currentLocation.accuracy = 5 + Math.random() * 10;
      this.currentLocation.speed = Math.random() * 20; // 0-20 m/s
      this.currentLocation.heading = Math.random() * 360;
      this.currentLocation.timestamp = Date.now();

      this.emit('locationUpdate', this.currentLocation);
    }, 1000);
  }

  getCurrentLocation() {
    return this.currentLocation;
  }

  setLocation(lat, lon) {
    this.currentLocation.lat = lat;
    this.currentLocation.lon = lon;
    this.currentLocation.timestamp = Date.now();
    this.emit('locationUpdate', this.currentLocation);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

module.exports = GPSService;
