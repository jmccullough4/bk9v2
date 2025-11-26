const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BluetoothScanner = require('./bluetooth/scanner');
const GPSService = require('./gps/service');
const Database = require('./database/db');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Initialize services - Bluetooth scanner only
  const db = new Database();
  const gpsService = new GPSService(io, db);
  const bluetoothScanner = new BluetoothScanner(db, io, gpsService);

  expressApp.use(express.json());

  // Auth endpoint
  expressApp.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'bluek9' && password === 'warhammer') {
      res.json({ success: true, token: 'authenticated' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  // Get all devices
  expressApp.get('/api/devices', (req, res) => {
    const devices = db.getDevices();
    res.json(devices);
  });

  // Get radios
  expressApp.get('/api/radios', (req, res) => {
    const radios = db.getRadios();
    res.json({ radios });
  });

  // Add radio
  expressApp.post('/api/radios', (req, res) => {
    const { type, device } = req.body;
    const radio = db.addRadio(type, device);
    res.json({ radio });
  });

  // Remove radio
  expressApp.delete('/api/radios/:id', (req, res) => {
    db.removeRadio(parseInt(req.params.id));
    res.json({ success: true });
  });

  // Start Bluetooth scanning
  expressApp.post('/api/scan/start', async (req, res) => {
    console.log('[BlueK9] Starting Bluetooth scanner');
    await bluetoothScanner.startScanning();
    res.json({ success: true, message: 'Bluetooth scanning started' });
  });

  // Stop scanning
  expressApp.post('/api/scan/stop', async (req, res) => {
    console.log('[BlueK9] Stopping Bluetooth scanner');
    bluetoothScanner.stopScanning();
    res.json({ success: true, message: 'Bluetooth scanning stopped' });
  });

  // Clear devices
  expressApp.post('/api/devices/clear', (req, res) => {
    db.clearDevices();
    io.emit('devicesClear');
    res.json({ success: true });
  });

  // Export CSV
  expressApp.get('/api/export/csv', (req, res) => {
    const csv = db.exportToCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bluek9-export.csv');
    res.send(csv);
  });

  // Get logs
  expressApp.get('/api/logs', (req, res) => {
    const logs = db.getLogs();
    res.json(logs);
  });

  // GPS settings update
  expressApp.post('/api/settings/gps/update', async (req, res) => {
    try {
      const { gpsSource } = req.body;
      if (gpsSource) {
        await gpsService.setGPSSource(gpsSource);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating GPS mode:', error);
      res.status(500).json({ error: 'Failed to update GPS mode' });
    }
  });

  // Device command: Get info (hcitool info)
  expressApp.post('/api/device/info', async (req, res) => {
    try {
      const { address } = req.body;
      const { stdout } = await execPromise(`hcitool info ${address}`);
      res.json({ success: true, info: stdout });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });

  // Device command: Get name (hcitool name)
  expressApp.post('/api/device/name', async (req, res) => {
    try {
      const { address } = req.body;
      const { stdout } = await execPromise(`hcitool name ${address}`);
      res.json({ success: true, name: stdout.trim() });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });

  // Device command: Geolocate (l2ping + hcitool rssi)
  expressApp.post('/api/device/geo', async (req, res) => {
    try {
      const { address } = req.body;

      // Get RSSI using hcitool
      let rssi = null;
      try {
        const { stdout: rssiOut } = await execPromise(`hcitool rssi ${address}`);
        const rssiMatch = rssiOut.match(/RSSI return value: (-?\d+)/);
        if (rssiMatch) {
          rssi = parseInt(rssiMatch[1]);
        }
      } catch (e) {
        // Try l2ping to establish connection first
        await execPromise(`timeout 2 l2ping -c 1 ${address}`);
        const { stdout: rssiOut } = await execPromise(`hcitool rssi ${address}`);
        const rssiMatch = rssiOut.match(/RSSI return value: (-?\d+)/);
        if (rssiMatch) {
          rssi = parseInt(rssiMatch[1]);
        }
      }

      if (rssi !== null) {
        // Calculate distance from RSSI (simplified path loss model)
        // RSSI = -10n * log10(d) + A
        // Where: n = path loss exponent (2-4, use 2.5 for indoor)
        //        A = RSSI at 1 meter (typically -50 to -60)
        const A = -55; // RSSI at 1 meter
        const n = 2.5; // Path loss exponent
        const distance = Math.pow(10, (A - rssi) / (10 * n));

        res.json({
          success: true,
          rssi,
          distance: distance.toFixed(2),
          unit: 'meters'
        });
      } else {
        res.json({ success: false, error: 'Could not get RSSI' });
      }
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  });

  // Socket.io connection
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    socket.emit('devices', db.getDevices());
    socket.emit('gpsUpdate', gpsService.getCurrentLocation());

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Handle Bluetooth device detection
  bluetoothScanner.on('deviceDetected', (device) => {
    console.log('[BlueK9] Bluetooth device detected:', device.address);
    io.emit('deviceDetected', device);
  });

  // Handle GPS updates
  gpsService.on('locationUpdate', (location) => {
    io.emit('gpsUpdate', location);
  });

  // Next.js handler
  expressApp.all('*', (req, res) => {
    return handle(req, res);
  });

  // Start server
  server.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> BlueK9 ready on http://0.0.0.0:${PORT}`);
    console.log(`> Access locally: http://localhost:${PORT}`);
    console.log(`> Access from network: http://<your-ip>:${PORT}`);
    console.log('> Starting Bluetooth scanner...');
    bluetoothScanner.initialize();
    console.log('> Starting GPS service...');
    gpsService.initialize();
    console.log('> BlueK9 - Bluetooth Scanner & Geolocation Tool');
  });
});
