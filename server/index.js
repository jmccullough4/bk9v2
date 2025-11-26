const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const BluetoothScanner = require('./bluetooth/scanner');
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
  const gpsService = new GPSService(io);
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
    const radios = bluetoothScanner.getRadios();
    res.json(radios);
  });

  expressApp.post('/api/radios', (req, res) => {
    const radio = bluetoothScanner.addRadio(req.body);
    res.json(radio);
  });

  expressApp.delete('/api/radios/:id', (req, res) => {
    bluetoothScanner.removeRadio(req.params.id);
    res.json({ success: true });
  });

  expressApp.post('/api/scan/start', (req, res) => {
    bluetoothScanner.startScanning();
    res.json({ success: true, message: 'Scanning started' });
  });

  expressApp.post('/api/scan/stop', (req, res) => {
    bluetoothScanner.stopScanning();
    res.json({ success: true, message: 'Scanning stopped' });
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
    res.json(numbers);
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
    io.emit('deviceDetected', device);

    // Check if device is a target
    const targets = db.getTargets();
    const isTarget = targets.some(t =>
      t.address.toLowerCase() === device.address.toLowerCase()
    );

    if (isTarget) {
      io.emit('targetDetected', device);
      smsService.sendTargetAlert(device, gpsService.getCurrentLocation());
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

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> BlueK9 ready on http://localhost:${PORT}`);
    console.log('> Starting Bluetooth scanner...');
    bluetoothScanner.initialize();
    console.log('> Starting GPS service...');
    gpsService.initialize();
    console.log('> Starting SMS service...');
    smsService.initialize();
  });
});
