const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class BlueK9Database {
  constructor() {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(path.join(dbDir, 'bluek9.db'));
    this.initializeTables();
  }

  initializeTables() {
    // Devices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        address TEXT PRIMARY KEY,
        name TEXT,
        manufacturer TEXT,
        deviceType TEXT,
        rssi INTEGER,
        firstSeen INTEGER,
        lastSeen INTEGER,
        systemLat REAL,
        systemLon REAL,
        emitterLat REAL,
        emitterLon REAL,
        emitterAccuracy REAL,
        detectionCount INTEGER DEFAULT 1
      )
    `);

    // Targets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS targets (
        address TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        addedAt INTEGER
      )
    `);

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        level TEXT,
        message TEXT,
        data TEXT
      )
    `);

    // SMS numbers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sms_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE
      )
    `);

    // RSSI history for geolocation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rssi_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT,
        rssi INTEGER,
        systemLat REAL,
        systemLon REAL,
        timestamp INTEGER,
        FOREIGN KEY(address) REFERENCES devices(address)
      )
    `);

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        createdAt INTEGER
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Radios table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS radios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        device TEXT,
        addedAt INTEGER
      )
    `);

    // Initialize default settings
    const defaultSettings = {
      gpsSource: 'simulated',
      nmeaIp: '',
      nmeaPort: '10110'
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      const existing = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      if (!existing) {
        this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
      }
    }
  }

  // Device operations
  upsertDevice(device) {
    const now = Date.now();
    const existing = this.db.prepare('SELECT * FROM devices WHERE address = ?').get(device.address);

    if (existing) {
      this.db.prepare(`
        UPDATE devices SET
          name = ?,
          manufacturer = ?,
          deviceType = ?,
          rssi = ?,
          lastSeen = ?,
          systemLat = ?,
          systemLon = ?,
          emitterLat = ?,
          emitterLon = ?,
          emitterAccuracy = ?,
          detectionCount = detectionCount + 1
        WHERE address = ?
      `).run(
        device.name || existing.name,
        device.manufacturer || existing.manufacturer,
        device.deviceType || existing.deviceType,
        device.rssi,
        now,
        device.systemLat,
        device.systemLon,
        device.emitterLat,
        device.emitterLon,
        device.emitterAccuracy,
        device.address
      );
    } else {
      this.db.prepare(`
        INSERT INTO devices (
          address, name, manufacturer, deviceType, rssi,
          firstSeen, lastSeen, systemLat, systemLon,
          emitterLat, emitterLon, emitterAccuracy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        device.address,
        device.name,
        device.manufacturer,
        device.deviceType,
        device.rssi,
        now,
        now,
        device.systemLat,
        device.systemLon,
        device.emitterLat,
        device.emitterLon,
        device.emitterAccuracy
      );
    }

    // Store RSSI history for geolocation
    if (device.rssi && device.systemLat && device.systemLon) {
      this.db.prepare(`
        INSERT INTO rssi_history (address, rssi, systemLat, systemLon, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(device.address, device.rssi, device.systemLat, device.systemLon, now);
    }

    return this.db.prepare('SELECT * FROM devices WHERE address = ?').get(device.address);
  }

  getDevices() {
    return this.db.prepare('SELECT * FROM devices ORDER BY lastSeen DESC').all();
  }

  clearDevices() {
    // Delete from rssi_history first due to foreign key constraint
    this.db.prepare('DELETE FROM rssi_history').run();
    this.db.prepare('DELETE FROM devices').run();
  }

  getRSSIHistory(address) {
    return this.db.prepare(`
      SELECT * FROM rssi_history
      WHERE address = ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).all(address);
  }

  // Target operations
  getTargets() {
    return this.db.prepare('SELECT * FROM targets').all();
  }

  addTarget(target) {
    const now = Date.now();
    this.db.prepare(`
      INSERT OR REPLACE INTO targets (address, name, description, addedAt)
      VALUES (?, ?, ?, ?)
    `).run(target.address, target.name, target.description, now);

    this.addLog('info', `Target added: ${target.address} (${target.name})`);
    return this.db.prepare('SELECT * FROM targets WHERE address = ?').get(target.address);
  }

  removeTarget(address) {
    this.db.prepare('DELETE FROM targets WHERE address = ?').run(address);
    this.addLog('info', `Target removed: ${address}`);
  }

  // SMS operations
  getSMSNumbers() {
    return this.db.prepare('SELECT number FROM sms_numbers').all().map(row => row.number);
  }

  setSMSNumbers(numbers) {
    this.db.prepare('DELETE FROM sms_numbers').run();
    const stmt = this.db.prepare('INSERT INTO sms_numbers (number) VALUES (?)');
    numbers.forEach(number => {
      try {
        stmt.run(number);
      } catch (e) {
        // Ignore duplicates
      }
    });
  }

  // Logging operations
  addLog(level, message, data = null) {
    this.db.prepare(`
      INSERT INTO logs (timestamp, level, message, data)
      VALUES (?, ?, ?, ?)
    `).run(Date.now(), level, message, data ? JSON.stringify(data) : null);
  }

  getLogs(limit = 1000) {
    return this.db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  }

  // Export to CSV
  exportToCSV() {
    const devices = this.getDevices();
    const headers = 'Address,Name,Manufacturer,Type,RSSI,First Seen,Last Seen,System Lat,System Lon,Emitter Lat,Emitter Lon,Accuracy,Detection Count\n';

    const rows = devices.map(d => {
      return [
        d.address,
        d.name || '',
        d.manufacturer || '',
        d.deviceType || '',
        d.rssi || '',
        new Date(d.firstSeen).toISOString(),
        new Date(d.lastSeen).toISOString(),
        d.systemLat || '',
        d.systemLon || '',
        d.emitterLat || '',
        d.emitterLon || '',
        d.emitterAccuracy || '',
        d.detectionCount || 1
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    return headers + rows;
  }

  // Settings operations
  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  getAllSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  // User operations
  getUsers() {
    return this.db.prepare('SELECT username, createdAt FROM users ORDER BY createdAt DESC').all();
  }

  getUser(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  createUser(username, hashedPassword) {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO users (username, password, createdAt)
      VALUES (?, ?, ?)
    `).run(username, hashedPassword, now);
    this.addLog('info', `User created: ${username}`);
    return this.db.prepare('SELECT username, createdAt FROM users WHERE username = ?').get(username);
  }

  deleteUser(username) {
    this.db.prepare('DELETE FROM users WHERE username = ?').run(username);
    this.addLog('info', `User deleted: ${username}`);
  }

  // Radio operations
  getRadios() {
    return this.db.prepare('SELECT * FROM radios ORDER BY addedAt DESC').all();
  }

  addRadio(type, device) {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO radios (type, device, addedAt)
      VALUES (?, ?, ?)
    `).run(type, device, now);
    this.addLog('info', `Radio added: ${type} ${device}`);
    return this.db.prepare('SELECT * FROM radios WHERE id = ?').get(result.lastInsertRowid);
  }

  removeRadio(id) {
    const radio = this.db.prepare('SELECT * FROM radios WHERE id = ?').get(id);
    if (radio) {
      this.db.prepare('DELETE FROM radios WHERE id = ?').run(id);
      this.addLog('info', `Radio removed: ${radio.type} ${radio.device}`);
    }
  }
}

module.exports = BlueK9Database;
