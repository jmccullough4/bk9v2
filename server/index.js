const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const BluetoothScanner = require('./bluetooth/scanner');
const WiFiScanner = require('./wifi/scanner');
const KismetScanner = require('./kismet/scanner');
const GPSService = require('./gps/service');
const SMSService = require('./sms/service');
const Database = require('./database/db');
const authMiddleware = require('./auth/middleware');

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

  // Initialize services
  const db = new Database();
  const bluetoothScanner = new BluetoothScanner(db, io);
  const wifiScanner = new WiFiScanner();
  const kismetScanner = new KismetScanner(db, io);
  const gpsService = new GPSService(io, db);
  const smsService = new SMSService(db);

  expressApp.use(express.json());

  // Auth endpoint
  expressApp.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'bluek9' && password === 'warhammer') {
      const token = 'authenticated'; // Simple token for now
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  // API endpoints
  expressApp.get('/api/devices', (req, res) => {
    const devices = db.getDevices();
    res.json(devices);
  });

  expressApp.get('/api/targets', (req, res) => {
    const targets = db.getTargets();
    res.json(targets);
  });

  expressApp.post('/api/targets', (req, res) => {
    const target = db.addTarget(req.body);
    io.emit('targetAdded', target);
    res.json(target);
  });

  expressApp.delete('/api/targets/:address', (req, res) => {
    db.removeTarget(req.params.address);
    io.emit('targetRemoved', req.params.address);
    res.json({ success: true });
  });

  expressApp.get('/api/radios', (req, res) => {
    const radios = db.getRadios();
    res.json({ radios });
  });

  expressApp.post('/api/radios', (req, res) => {
    const { type, device } = req.body;
    const radio = db.addRadio(type, device);
    res.json({ radio });
  });

  expressApp.delete('/api/radios/:id', (req, res) => {
    db.removeRadio(parseInt(req.params.id));
    res.json({ success: true });
  });

  expressApp.post('/api/scan/start', async (req, res) => {
    console.log('[SERVER-DEBUG] Scan start requested');

    // Start Kismet scanner (handles both WiFi and Bluetooth)
    console.log('[SERVER-DEBUG] Starting Kismet scanner');
    await kismetScanner.startScanning();

    res.json({ success: true, message: 'Kismet scanning started (WiFi & Bluetooth)' });
  });

  expressApp.post('/api/scan/stop', async (req, res) => {
    console.log('[SERVER-DEBUG] Scan stop requested');
    kismetScanner.stopScanning();
    res.json({ success: true, message: 'Kismet scanning stopped' });
  });

  expressApp.post('/api/devices/clear', (req, res) => {
    db.clearDevices();
    io.emit('devicesClear');
    res.json({ success: true });
  });

  expressApp.get('/api/logs', (req, res) => {
    const logs = db.getLogs();
    res.json(logs);
  });

  expressApp.get('/api/export/csv', (req, res) => {
    const csv = db.exportToCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bluek9-export.csv');
    res.send(csv);
  });

  expressApp.post('/api/sms/numbers', (req, res) => {
    const numbers = req.body.numbers;
    db.setSMSNumbers(numbers);
    smsService.setNumbers(numbers);
    res.json({ success: true });
  });

  expressApp.get('/api/sms/numbers', (req, res) => {
    const numbers = db.getSMSNumbers();
    res.json({ numbers });
  });

  expressApp.post('/api/settings/gps/update', async (req, res) => {
    try {
      const { gpsSource } = req.body;
      console.log('[SERVER-DEBUG] GPS settings update requested:', gpsSource);

      // Update GPS mode in real-time
      if (gpsSource) {
        await gpsService.setGPSSource(gpsSource);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating GPS mode:', error);
      res.status(500).json({ error: 'Failed to update GPS mode' });
    }
  });

  // Socket.io connection
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    socket.emit('devices', db.getDevices());
    socket.emit('targets', db.getTargets());
    socket.emit('gpsUpdate', gpsService.getCurrentLocation());

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Handle device detection events
  bluetoothScanner.on('deviceDetected', (device) => {
    console.log('[SERVER-DEBUG] Bluetooth device detected event received:', device.address);
    io.emit('deviceDetected', device);
    console.log('[SERVER-DEBUG] deviceDetected emitted to socket.io clients');

    // Check if device is a target
    const targets = db.getTargets();
    const isTarget = targets.some(t =>
      t.address.toLowerCase() === device.address.toLowerCase()
    );

    if (isTarget) {
      console.log('[SERVER-DEBUG] Device is a TARGET:', device.address);
      io.emit('targetDetected', device);
      smsService.sendTargetAlert(device, gpsService.getCurrentLocation());
    }
  });

  // Handle WiFi device detection events
  wifiScanner.on('device', (device) => {
    console.log('[SERVER-DEBUG] WiFi device detected event received:', device.address);
    io.emit('deviceDetected', device);
    console.log('[SERVER-DEBUG] WiFi deviceDetected emitted to socket.io clients');

    // Check if device is a target
    const targets = db.getTargets();
    const isTarget = targets.some(t =>
      t.address.toLowerCase() === device.address.toLowerCase()
    );

    if (isTarget) {
      console.log('[SERVER-DEBUG] WiFi device is a TARGET:', device.address);
      io.emit('targetDetected', device);
      smsService.sendTargetAlert(device, gpsService.getCurrentLocation());
    }
  });

  // Handle WiFi scanner logs
  wifiScanner.on('log', (log) => {
    io.emit('log', log);
  });

  // Handle Kismet device detection events
  kismetScanner.on('device', async (deviceData) => {
    console.log('[SERVER-DEBUG] Kismet device detected:', deviceData.address, deviceData.deviceType);

    // Get current GPS location
    const gpsLocation = gpsService.getCurrentLocation();

    // Build complete device object
    const device = {
      address: deviceData.address,
      name: deviceData.name,
      manufacturer: deviceData.manufacturer,
      deviceType: deviceData.deviceType,
      rssi: deviceData.rssi,
      systemLat: gpsLocation.lat,
      systemLon: gpsLocation.lon,
      emitterLat: gpsLocation.lat, // For now, use system location
      emitterLon: gpsLocation.lon,
      emitterAccuracy: 50,
      radioId: deviceData.radioId,
      channel: deviceData.channel
    };

    // Save to database
    const savedDevice = db.upsertDevice(device);

    // Emit to clients
    io.emit('deviceDetected', savedDevice);
    console.log('[SERVER-DEBUG] Kismet deviceDetected emitted to socket.io clients');

    // Check if device is a target
    const targets = db.getTargets();
    const isTarget = targets.some(t =>
      t.address.toLowerCase() === device.address.toLowerCase()
    );

    if (isTarget) {
      console.log('[SERVER-DEBUG] Kismet device is a TARGET:', device.address);
      io.emit('targetDetected', savedDevice);
      smsService.sendTargetAlert(savedDevice, gpsLocation);
    }
  });

  // Handle GPS updates
  gpsService.on('locationUpdate', (location) => {
    io.emit('gpsUpdate', location);
  });

  // Next.js handler
  expressApp.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> BlueK9 ready on http://0.0.0.0:${PORT}`);
    console.log(`> Access locally: http://localhost:${PORT}`);
    console.log(`> Access from network: http://<your-ip>:${PORT}`);
    console.log('> Starting Kismet scanner...');
    kismetScanner.initialize();
    console.log('> Starting GPS service...');
    gpsService.initialize();
    console.log('> Starting SMS service...');
    smsService.initialize();
  });
});
