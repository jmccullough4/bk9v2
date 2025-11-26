# BlueK9 Client

BlueK9 is a professional Bluetooth detection and geolocation system designed for tracking and analyzing Bluetooth devices in the field.

## Features

### Core Functionality
- **Dual-Mode Scanning**: Detects both Classic and BLE (Low Energy) Bluetooth devices
- **Real-time Geolocation**: Advanced trilateration algorithm for device location estimation
- **Interactive Mapping**: Mapbox integration with dark/streets/satellite views
- **Target Tracking**: Mark devices of interest with automatic alerts
- **CEP Visualization**: Circular Error Probable plotting for location confidence
- **Multi-Radio Support**: Use multiple Bluetooth/WiFi adapters simultaneously

### Advanced Features
- **SMS Alerts**: Automatic notifications via SIMCOM7600 cellular modem (up to 10 numbers)
- **Audio/Visual Alerts**: Instant notification when targets are detected
- **Live Analytics**: Real-time charts and statistics
- **Post-Mission Analysis**: Comprehensive logging with CSV export
- **Radio Management**: Hot-swap Bluetooth and WiFi adapters
- **GPS Tracking**: Automatic location tracking with optional map following

## Hardware Requirements

### Minimum Requirements
- Linux system (Ubuntu 20.04+ recommended)
- Bluetooth adapter (e.g., Sena UD100)
- Node.js 18 or later

### Optional Hardware
- GPS receiver (USB or serial)
- SIMCOM7600 cellular modem (for SMS alerts)
- Additional Bluetooth/WiFi adapters for extended range

## Installation

### Quick Start (Docker)

```bash
# Run the installation script
sudo ./install.sh

# Start with Docker
docker-compose up -d

# View logs
docker-compose logs -f
```

### Native Installation

```bash
# Run the installation script
sudo ./install.sh

# Install dependencies
npm install --legacy-peer-deps

# Start the application
./start.sh
```

## Usage

### Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

**Default Credentials:**
- Username: `bluek9`
- Password: `warhammer`

### Basic Workflow

1. **Login** with the default credentials
2. **Configure Targets** - Add Bluetooth addresses to track
3. **Configure SMS** (optional) - Add phone numbers for alerts
4. **Start Scanning** - Click "Start Scan" button
5. **Monitor Map** - Watch as devices appear on the map
6. **Review Results** - Check the survey table for detailed information
7. **Export Data** - Download CSV for post-mission analysis

### Target Management

- Click **"Targets"** button to open target manager
- Add target MAC address and description
- Targets appear in red on map and survey table
- Automatic SMS alerts when targets detected

### Radio Management

- Click **"Radios"** button to manage adapters
- Add/remove Bluetooth and WiFi radios
- Multiple radios can scan simultaneously
- Primary radio (Sena UD100) detected automatically

### Map Controls

- **Map Style**: Toggle between Dark/Streets/Satellite views
- **Follow GPS**: Enable/disable automatic map centering
- **Click Markers**: View device details in popup
- **CEP Circles**: Show location confidence radius

### SMS Configuration

- Click **"SMS"** button to configure
- Add up to 10 US phone numbers
- Automatic alerts include:
  - Target name and MAC address
  - GPS location
  - First/Last seen timestamps
  - Signal strength

### Analytics

- Click **"Analytics"** button for insights:
  - Device type distribution
  - Signal strength analysis
  - Manufacturer breakdown
  - Most frequently detected devices

## Technical Details

### Geolocation Algorithm

BlueK9 uses an advanced trilateration algorithm:
1. Collects RSSI measurements from multiple positions
2. Calculates distance using path loss model
3. Applies weighted centroid calculation
4. Generates CEP (Circular Error Probable) for confidence

### Path Loss Model
```
Distance = 10^((TxPower - RSSI) / (10 * n))
Where:
  TxPower = -59 dBm (assumed at 1 meter)
  n = 2.5 (path loss exponent)
```

### Data Storage

- SQLite database in `./data/bluek9.db`
- Logs stored with full device history
- RSSI history for geolocation
- Export to CSV for external analysis

## Configuration

### Environment Variables

```bash
# Port (default: 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

### Bluetooth Permissions

The application requires access to Bluetooth hardware. Ensure:
- User is in `bluetooth` group
- BlueZ service is running
- Bluetooth adapters are enabled

```bash
# Add user to bluetooth group
sudo usermod -a -G bluetooth $USER

# Enable Bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Check adapters
hciconfig -a
```

## Troubleshooting

### Bluetooth Not Working

```bash
# Check Bluetooth service
sudo systemctl status bluetooth

# Restart Bluetooth
sudo systemctl restart bluetooth

# Bring up adapter
sudo hciconfig hci0 up
```

### SMS Not Working

- Verify SIMCOM7600 is connected: `lsusb | grep -i simcom`
- Check serial port: `ls /dev/ttyUSB*`
- Add user to dialout group: `sudo usermod -a -G dialout $USER`

### GPS Not Working

- Application uses simulated GPS if hardware not found
- Check for GPS device: `ls /dev/ttyUSB* /dev/ttyACM*`
- Install gpsd: `sudo apt-get install gpsd gpsd-clients`

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This starts:
- Next.js dev server on port 3000
- Backend server with hot reload
- Virtual Bluetooth scanning (if no hardware)

### File Structure

```
bluek9-client/
├── components/          # React components
├── pages/              # Next.js pages
├── server/             # Backend services
│   ├── bluetooth/      # Bluetooth scanning
│   ├── gps/           # GPS service
│   ├── sms/           # SMS alerts
│   └── database/      # SQLite database
├── styles/            # CSS styles
├── public/            # Static assets
├── data/              # Database and logs
├── docker-compose.yml # Docker configuration
├── Dockerfile         # Docker image
├── install.sh         # Installation script
└── start.sh          # Startup script
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login

### Devices
- `GET /api/devices` - Get all devices
- `POST /api/devices/clear` - Clear all devices

### Targets
- `GET /api/targets` - Get targets
- `POST /api/targets` - Add target
- `DELETE /api/targets/:address` - Remove target

### Radios
- `GET /api/radios` - Get radios
- `POST /api/radios` - Add radio
- `DELETE /api/radios/:id` - Remove radio

### Scanning
- `POST /api/scan/start` - Start scanning
- `POST /api/scan/stop` - Stop scanning

### SMS
- `GET /api/sms/numbers` - Get SMS numbers
- `POST /api/sms/numbers` - Set SMS numbers

### Export
- `GET /api/export/csv` - Export data as CSV

## Security Notes

- Change default password in production
- Use HTTPS in production environments
- Restrict network access to trusted IPs
- Keep system and dependencies updated

## Future Enhancements

The following features are planned for future releases:
- Server component for centralized management
- Target deck synchronization across clients
- WiFi scanning and analysis
- Enhanced KISMET integration
- Machine learning for device classification
- Historical heatmaps
- Team collaboration features

## License

Copyright © 2024. All rights reserved.

## Support

For issues, questions, or feature requests, please contact the development team.

---

**BlueK9** - Professional Bluetooth Detection and Geolocation