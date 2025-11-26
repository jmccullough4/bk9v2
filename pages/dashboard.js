import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
import SurveyTable from '../components/SurveyTable';
import RadioManager from '../components/RadioManager';
import LogPanel from '../components/LogPanel';

let socket;

export default function Dashboard() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [radios, setRadios] = useState([]);
  const [logs, setLogs] = useState([]);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showRadioManager, setShowRadioManager] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('bluek9_token');
    if (!token) {
      router.push('/');
      return;
    }

    // Initialize socket connection
    socketInitializer();

    // Close context menu on click
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);

    return () => {
      if (socket) {
        socket.disconnect();
      }
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const socketInitializer = async () => {
    socket = io();

    socket.on('connect', () => {
      console.log('Connected to server');
      addLog('info', 'Connected to BlueK9 server');
    });

    socket.on('devices', (data) => {
      setDevices(data);
    });

    socket.on('deviceDetected', (device) => {
      setDevices((prev) => {
        const existing = prev.find((d) => d.address === device.address);
        if (existing) {
          return prev.map((d) => (d.address === device.address ? device : d));
        }
        return [...prev, device];
      });
    });

    socket.on('devicesClear', () => {
      setDevices([]);
    });

    socket.on('gpsUpdate', (location) => {
      setGpsLocation(location);
    });

    socket.on('log', (log) => {
      addLog(log.level, log.message);
    });

    // Fetch initial data
    const [devicesRes, radiosRes] = await Promise.all([
      fetch('/api/devices'),
      fetch('/api/radios')
    ]);

    if (devicesRes.ok) {
      const data = await devicesRes.json();
      setDevices(data);
    }

    if (radiosRes.ok) {
      const data = await radiosRes.json();
      setRadios(data.radios || []);
    }
  };

  const addLog = (level, message) => {
    setLogs((prev) => [
      { level, message, timestamp: Date.now() },
      ...prev.slice(0, 99)
    ]);
  };

  const handleStartScan = async () => {
    try {
      const response = await fetch('/api/scan/start', {
        method: 'POST',
      });
      if (response.ok) {
        setScanning(true);
        addLog('success', 'Bluetooth scanning started');
      }
    } catch (error) {
      addLog('error', 'Failed to start scanning');
    }
  };

  const handleStopScan = async () => {
    try {
      const response = await fetch('/api/scan/stop', {
        method: 'POST',
      });
      if (response.ok) {
        setScanning(false);
        addLog('info', 'Bluetooth scanning stopped');
      }
    } catch (error) {
      addLog('error', 'Failed to stop scanning');
    }
  };

  const handleClearDevices = async () => {
    if (!confirm('Are you sure you want to clear all detected devices?')) {
      return;
    }

    try {
      await fetch('/api/devices/clear', { method: 'POST' });
      setDevices([]);
      addLog('info', 'Devices cleared');
    } catch (error) {
      addLog('error', 'Failed to clear devices');
    }
  };

  const handleExport = async () => {
    window.location.href = '/api/export/csv';
    addLog('info', 'Exporting devices to CSV');
  };

  const handleLogout = () => {
    localStorage.removeItem('bluek9_token');
    router.push('/');
  };

  // Right-click context menu
  const handleDeviceRightClick = (e, device) => {
    e.preventDefault();
    setSelectedDevice(device);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      device
    });
  };

  const handleGeo = async () => {
    if (!selectedDevice) return;
    addLog('info', `Running geolocation for ${selectedDevice.address}...`);

    try {
      const res = await fetch('/api/device/geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedDevice.address })
      });

      const data = await res.json();
      if (data.success) {
        addLog('success', `Geo: ${selectedDevice.address} - RSSI: ${data.rssi} dBm, Distance: ${data.distance}m`);
        // TODO: Update map with heatmap
      } else {
        addLog('error', `Geo failed: ${data.error}`);
      }
    } catch (error) {
      addLog('error', `Geo error: ${error.message}`);
    }

    setContextMenu(null);
  };

  const handleInfo = async () => {
    if (!selectedDevice) return;
    addLog('info', `Getting info for ${selectedDevice.address}...`);

    try {
      const res = await fetch('/api/device/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedDevice.address })
      });

      const data = await res.json();
      if (data.success) {
        addLog('success', `Info:\n${data.info}`);
      } else {
        addLog('error', `Info failed: ${data.error}`);
      }
    } catch (error) {
      addLog('error', `Info error: ${error.message}`);
    }

    setContextMenu(null);
  };

  const handleName = async () => {
    if (!selectedDevice) return;
    addLog('info', `Getting name for ${selectedDevice.address}...`);

    try {
      const res = await fetch('/api/device/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedDevice.address })
      });

      const data = await res.json();
      if (data.success) {
        addLog('success', `Name: ${data.name}`);
      } else {
        addLog('error', `Name failed: ${data.error}`);
      }
    } catch (error) {
      addLog('error', `Name error: ${error.message}`);
    }

    setContextMenu(null);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      {/* Header */}
      <div className="bg-stone-800 border-b border-green-700 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-400">
            BlueK9 - Bluetooth Scanner & Geolocation
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-stone-800 border-b border-green-700 p-3">
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={() => setShowRadioManager(!showRadioManager)}
            className="px-4 py-2 bg-amber-900 hover:bg-amber-800 text-white rounded transition"
          >
            Radios
          </button>

          {scanning ? (
            <button
              onClick={handleStopScan}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded transition font-medium"
            >
              STOP
            </button>
          ) : (
            <button
              onClick={handleStartScan}
              className="px-4 py-2 bg-green-800 hover:bg-green-700 text-white rounded transition font-medium"
            >
              START
            </button>
          )}

          <button
            onClick={handleClearDevices}
            className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded transition"
          >
            Clear
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-amber-900 hover:bg-amber-800 text-white rounded transition"
          >
            Export
          </button>

          {gpsLocation && (
            <div className="ml-auto text-sm text-green-400">
              GPS: {gpsLocation.lat.toFixed(6)}, {gpsLocation.lon.toFixed(6)}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Map */}
        <div className="bg-stone-800 border border-green-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-green-400 mb-4">Map View</h2>
          <div className="h-96">
            <MapComponent devices={devices} currentLocation={gpsLocation} />
          </div>
        </div>

        {/* Devices Table */}
        <div className="bg-stone-800 border border-green-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-green-400 mb-4">
            Bluetooth Devices ({devices.length})
          </h2>
          <div className="h-96 overflow-auto">
            <SurveyTable
              devices={devices}
              onDeviceRightClick={handleDeviceRightClick}
            />
          </div>
        </div>

        {/* Logs */}
        <div className="lg:col-span-2 bg-stone-800 border border-green-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-green-400 mb-4">Activity Log</h2>
          <LogPanel logs={logs} />
        </div>
      </div>

      {/* Radio Manager Modal */}
      {showRadioManager && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-800 border border-green-700 rounded-lg p-6 max-w-4xl w-full max-h-screen overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-green-400">Radio Manager</h2>
              <button
                onClick={() => setShowRadioManager(false)}
                className="text-red-500 hover:text-red-400 text-2xl"
              >
                ×
              </button>
            </div>
            <RadioManager radios={radios} onUpdate={(r) => setRadios(r)} />
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-stone-700 border border-green-600 rounded shadow-lg z-50 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleGeo}
            className="w-full text-left px-4 py-2 hover:bg-stone-600 text-white"
          >
            🎯 Geolocate
          </button>
          <button
            onClick={handleInfo}
            className="w-full text-left px-4 py-2 hover:bg-stone-600 text-white"
          >
            ℹ️ Get Info
          </button>
          <button
            onClick={handleName}
            className="w-full text-left px-4 py-2 hover:bg-stone-600 text-white"
          >
            📝 Get Name
          </button>
        </div>
      )}
    </div>
  );
}
