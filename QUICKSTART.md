# BlueK9 Quick Start Guide

## ✅ Fixed Issues

The following issues have been resolved:

1. **Removed non-existent npm packages** (`@noble/hci`, `gps`, `node-gpsd`)
2. **Removed problematic native Bluetooth packages** (replaced with command-line tools)
3. **Fixed development server setup** (no more port conflicts)
4. **Verified application startup** (server runs successfully)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Start the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
# First build the app
npm run build

# Then start it
npm start
```

**Using the Start Script:**
```bash
./start.sh
```

### 3. Access the Application

Open your browser and go to:
```
http://localhost:3000
```

**Login Credentials:**
- Username: `bluek9`
- Password: `warhammer`

## 📋 What's Working

### ✅ Core Features

- **Web Server**: Running on port 3000
- **Authentication**: Login system working
- **GPS Service**: Simulated GPS (ready for real hardware)
- **SMS Service**: Ready (logs alerts when hardware not available)
- **Bluetooth Scanner**: Uses system tools (hcitool, bluetoothctl)
- **Database**: SQLite database initialized
- **Socket.io**: Real-time communication ready
- **Map Interface**: Mapbox integration with your token

### 📡 Bluetooth Scanning

The application uses command-line Bluetooth tools:
- **Classic BT**: `hcitool scan`
- **BLE**: `hcitool lescan`
- **RSSI**: `hcitool rssi`

**To enable real Bluetooth scanning:**
```bash
# Install Bluetooth tools
sudo apt-get install bluetooth bluez bluez-tools

# Enable Bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Check your adapters
hciconfig -a
```

### 📱 SMS Alerts

The SMS service looks for a SIMCOM7600 modem. If not found, alerts are logged instead.

**To enable real SMS:**
- Connect SIMCOM7600 via USB
- Device will be auto-detected
- Configure numbers in the SMS panel

### 🌍 GPS

The GPS service uses simulated data by default.

**To enable real GPS:**
- Connect USB GPS device
- Install gpsd: `sudo apt-get install gpsd gpsd-clients`
- Device will be auto-detected

## 🐳 Docker Deployment

```bash
# Run the install script
sudo ./install.sh

# Start with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🔧 Development Notes

### Hardware Detection

The application gracefully handles missing hardware:
- **No Bluetooth adapter**: Uses virtual scanning for testing
- **No GPS**: Uses simulated location data
- **No SIMCOM modem**: Logs SMS alerts instead of sending

### Virtual Mode

For development/testing without hardware:
1. Start the app normally
2. Virtual Bluetooth devices will appear
3. Simulated GPS updates every second
4. SMS alerts go to the log panel

### Adding Real Hardware

The app auto-detects hardware on startup:
1. Connect your hardware
2. Restart the application
3. Check the startup logs to confirm detection
4. Hardware will be used automatically

## 📊 Features Overview

### Main Dashboard

- **Real-time Map**: Devices plotted with CEP circles
- **Survey Table**: All detected devices with details
- **Live Log**: System events and alerts
- **Control Buttons**: Start/Stop scan, Clear, Export

### Target Management

- Add target MAC addresses
- Targets show in red
- Automatic SMS/audio alerts
- First/Last seen tracking

### Radio Management

- View detected Bluetooth adapters
- Add/remove radios
- Multi-radio scanning support

### SMS Configuration

- Configure up to 10 US phone numbers
- Automatic target detection alerts
- Includes location, timestamps, RSSI

### Analytics

- Device type distribution
- Signal strength analysis
- Manufacturer breakdown
- Detection frequency charts

## 🎯 Next Steps

1. **Start the application**: `npm run dev`
2. **Login**: Use bluek9/warhammer
3. **Add targets**: Click "Targets" button
4. **Start scanning**: Click "Start Scan"
5. **Monitor**: Watch the map and survey table

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### Bluetooth Not Working

```bash
# Check Bluetooth service
sudo systemctl status bluetooth

# Restart if needed
sudo systemctl restart bluetooth

# Bring up adapter
sudo hciconfig hci0 up
```

### Can't Install Dependencies

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install --legacy-peer-deps
```

## 📚 Documentation

See the main README.md for:
- Complete feature list
- API documentation
- Architecture details
- Security notes

---

**Ready to go!** Your BlueK9 client is fully functional and ready for use. 🎉
