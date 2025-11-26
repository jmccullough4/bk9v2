const EventEmitter = require('events');
const { exec } = require('child_process');
const net = require('net');
const util = require('util');
const execPromise = util.promisify(exec);

class GPSService extends EventEmitter {
  constructor(io, db) {
    super();
    this.io = io;
    this.db = db;
    this.currentLocation = {
      lat: 37.7749,
      lon: -122.4194,
      accuracy: 10,
      altitude: 0,
      speed: 0,
      heading: 0,
      timestamp: Date.now()
    };
    this.gpsSource = 'simulated';
    this.updateInterval = null;
    this.tcpClient = null;
    this.gpsdClient = null;
  }

  async initialize() {
    console.log('[GPS] Initializing GPS service');

    try {
      // Read GPS source from database settings
      this.gpsSource = this.db.getSetting('gpsSource') || 'simulated';
      console.log('[GPS] GPS source mode:', this.gpsSource);

      // Start GPS based on configured mode
      await this.startGPSMode();
    } catch (error) {
      console.log('[GPS] Error initializing GPS:', error.message);
      this.startSimulatedGPS();
    }
  }

  async startGPSMode() {
    // Stop any existing GPS tracking
    this.stop();

    console.log('[GPS] Starting GPS in mode:', this.gpsSource);

    switch (this.gpsSource) {
      case 'gpsd':
        await this.startGPSD();
        break;
      case 'nmea':
        await this.startNMEATCP();
        break;
      case 'mnav':
        await this.startMnav();
        break;
      case 'simulated':
      default:
        this.startSimulatedGPS();
        break;
    }
  }

  async startGPSD() {
    console.log('[GPS] Starting GPSD client');

    try {
      // Check if gpsd is running
      const { stdout } = await execPromise('systemctl is-active gpsd');
      if (stdout.trim() !== 'active') {
        console.log('[GPS] gpsd is not running, falling back to simulated GPS');
        this.startSimulatedGPS();
        return;
      }

      // Connect to GPSD on localhost:2947
      const gpsd = require('node-gpsd');
      this.gpsdClient = new gpsd.Listener({
        port: 2947,
        hostname: 'localhost'
      });

      this.gpsdClient.on('TPV', (data) => {
        if (data.lat && data.lon) {
          this.currentLocation = {
            lat: data.lat,
            lon: data.lon,
            accuracy: data.epy || 10,
            altitude: data.alt || 0,
            speed: data.speed || 0,
            heading: data.track || 0,
            timestamp: Date.now()
          };
          this.emit('locationUpdate', this.currentLocation);
        }
      });

      this.gpsdClient.connect(() => {
        console.log('[GPS] Connected to GPSD');
        this.gpsdClient.watch();
      });

      this.gpsdClient.on('error', (error) => {
        console.log('[GPS] GPSD error:', error.message);
      });

    } catch (error) {
      console.log('[GPS] Error starting GPSD:', error.message);
      console.log('[GPS] Falling back to simulated GPS');
      this.startSimulatedGPS();
    }
  }

  async startNMEATCP() {
    console.log('[GPS] Starting NMEA TCP client');

    const nmeaIp = this.db.getSetting('nmeaIp') || '127.0.0.1';
    const nmeaPort = parseInt(this.db.getSetting('nmeaPort') || '10110');

    console.log(`[GPS] Connecting to NMEA server at ${nmeaIp}:${nmeaPort}`);

    this.tcpClient = new net.Socket();
    let buffer = '';

    this.tcpClient.connect(nmeaPort, nmeaIp, () => {
      console.log('[GPS] Connected to NMEA TCP server');
    });

    this.tcpClient.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        this.parseNMEA(line);
      }
    });

    this.tcpClient.on('error', (error) => {
      console.log('[GPS] NMEA TCP error:', error.message);
      console.log('[GPS] Falling back to simulated GPS');
      this.startSimulatedGPS();
    });

    this.tcpClient.on('close', () => {
      console.log('[GPS] NMEA TCP connection closed');
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        if (this.gpsSource === 'nmea') {
          this.startNMEATCP();
        }
      }, 5000);
    });
  }

  parseNMEA(sentence) {
    if (!sentence.startsWith('$')) return;

    const parts = sentence.split(',');
    const type = parts[0];

    // Parse GGA sentence (Global Positioning System Fix Data)
    if (type === '$GPGGA' || type === '$GNGGA') {
      const lat = this.parseNMEACoord(parts[2], parts[3]);
      const lon = this.parseNMEACoord(parts[4], parts[5]);
      const quality = parseInt(parts[6]);
      const altitude = parseFloat(parts[9]) || 0;
      const hdop = parseFloat(parts[8]) || 1.0;

      if (lat && lon && quality > 0) {
        this.currentLocation = {
          lat,
          lon,
          accuracy: hdop * 5, // Rough accuracy estimate
          altitude,
          speed: this.currentLocation.speed || 0,
          heading: this.currentLocation.heading || 0,
          timestamp: Date.now()
        };
        this.emit('locationUpdate', this.currentLocation);
      }
    }

    // Parse RMC sentence (Recommended Minimum)
    if (type === '$GPRMC' || type === '$GNRMC') {
      const lat = this.parseNMEACoord(parts[3], parts[4]);
      const lon = this.parseNMEACoord(parts[5], parts[6]);
      const speed = parseFloat(parts[7]) || 0;
      const heading = parseFloat(parts[8]) || 0;

      if (lat && lon) {
        this.currentLocation.lat = lat;
        this.currentLocation.lon = lon;
        this.currentLocation.speed = speed * 0.514444; // Convert knots to m/s
        this.currentLocation.heading = heading;
        this.currentLocation.timestamp = Date.now();
        this.emit('locationUpdate', this.currentLocation);
      }
    }
  }

  parseNMEACoord(value, direction) {
    if (!value || !direction) return null;

    const val = parseFloat(value);
    const degrees = Math.floor(val / 100);
    const minutes = val - (degrees * 100);
    let coord = degrees + (minutes / 60);

    if (direction === 'S' || direction === 'W') {
      coord = -coord;
    }

    return coord;
  }

  async startMnav() {
    console.log('[GPS] Mnav mode not yet implemented');
    console.log('[GPS] Falling back to simulated GPS');
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
    console.log('[GPS] Stopping GPS service');

    // Stop simulated GPS interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Close TCP client
    if (this.tcpClient) {
      this.tcpClient.destroy();
      this.tcpClient = null;
    }

    // Close GPSD client
    if (this.gpsdClient) {
      try {
        this.gpsdClient.disconnect();
      } catch (error) {
        // Ignore
      }
      this.gpsdClient = null;
    }
  }

  // Allow updating GPS mode on the fly
  async setGPSSource(source) {
    console.log('[GPS] Changing GPS source to:', source);
    this.gpsSource = source;
    await this.startGPSMode();
  }
}

module.exports = GPSService;
