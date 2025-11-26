import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
import SurveyTable from '../components/SurveyTable';
import TargetManager from '../components/TargetManager';
import RadioManager from '../components/RadioManager';
import LogPanel from '../components/LogPanel';
import AnalyticsPanel from '../components/AnalyticsPanel';
import SMSConfig from '../components/SMSConfig';

let socket;

export default function Dashboard() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [targets, setTargets] = useState([]);
  const [radios, setRadios] = useState([]);
  const [logs, setLogs] = useState([]);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showTargetManager, setShowTargetManager] = useState(false);
  const [showRadioManager, setShowRadioManager] = useState(false);
  const [showSMSConfig, setShowSMSConfig] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('bluek9_token');
    if (!token) {
      router.push('/');
      return;
    }

    // Initialize socket connection
    socketInitializer();

    return () => {
      if (socket) {
        socket.disconnect();
      }
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

    socket.on('targets', (data) => {
      setTargets(data);
    });

    socket.on('targetAdded', (target) => {
      setTargets((prev) => [...prev, target]);
      addLog('success', `Target added: ${target.address}`);
    });

    socket.on('targetRemoved', (address) => {
      setTargets((prev) => prev.filter((t) => t.address !== address));
      addLog('info', `Target removed: ${address}`);
    });

    socket.on('targetDetected', (device) => {
      addLog('alert', `🎯 TARGET DETECTED: ${device.address} (${device.name})`);
      playAlert();
      showTargetAlert(device);
    });

    socket.on('gpsUpdate', (location) => {
      setGpsLocation(location);
    });

    socket.on('radiosUpdate', (data) => {
      setRadios(data);
    });

    socket.on('log', (log) => {
      addLog(log.level, log.message);
    });

    socket.on('devicesClear', () => {
      setDevices([]);
      addLog('info', 'Devices cleared');
    });
  };

  const addLog = (level, message) => {
    const log = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      level,
      message,
    };
    setLogs((prev) => [log, ...prev].slice(0, 500)); // Keep last 500 logs
  };

  const playAlert = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log('Audio play failed:', e));
    }
  };

  const showTargetAlert = (device) => {
    // Create a visual alert
    if (Notification.permission === 'granted') {
      new Notification('BlueK9 Target Detected!', {
        body: `${device.name} (${device.address})`,
        icon: '/favicon.ico',
      });
    }
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
      const response = await fetch('/api/devices/clear', {
        method: 'POST',
      });
      if (response.ok) {
        setDevices([]);
        addLog('info', 'All devices cleared');
      }
    } catch (error) {
      addLog('error', 'Failed to clear devices');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bluek9-export-${Date.now()}.csv`;
      a.click();
      addLog('success', 'Data exported successfully');
    } catch (error) {
      addLog('error', 'Failed to export data');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bluek9_token');
    router.push('/');
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-bluek9-darker">
      {/* Audio element for alerts */}
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Header */}
      <div className="bg-bluek9-dark border-b border-bluek9-cyan/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-bluek9-cyan">BlueK9</h1>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${gpsLocation ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-sm text-gray-400">
                {gpsLocation
                  ? `GPS: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lon.toFixed(6)}`
                  : 'GPS: Acquiring...'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              Analytics
            </button>
            <button
              onClick={() => setShowTargetManager(!showTargetManager)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              Targets
            </button>
            <button
              onClick={() => setShowRadioManager(!showRadioManager)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              Radios
            </button>
            <button
              onClick={() => setShowSMSConfig(!showSMSConfig)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              SMS
            </button>
            {scanning ? (
              <button
                onClick={handleStopScan}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition font-medium"
              >
                STOP
              </button>
            ) : (
              <button
                onClick={handleStartScan}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded transition font-medium"
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
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              Export
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition border border-gray-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-3 flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-gray-400">
              {scanning ? 'Scanning Active' : 'Scanning Inactive'}
            </span>
          </div>
          <div className="text-gray-400">
            Devices: <span className="text-white font-semibold">{devices.length}</span>
          </div>
          <div className="text-gray-400">
            Targets: <span className="text-white font-semibold">{targets.length}</span>
          </div>
          <div className="text-gray-400">
            Radios: <span className="text-white font-semibold">{radios.filter(r => r.enabled).length}/{radios.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Map */}
        <div className="flex-1 flex flex-col">
          <MapComponent
            devices={devices}
            targets={targets}
            gpsLocation={gpsLocation}
          />
        </div>

        {/* Right Panel - Survey Table and Logs */}
        <div className="w-2/5 flex flex-col border-l border-bluek9-cyan/30">
          {/* Survey Table */}
          <div className="flex-1 overflow-hidden">
            <SurveyTable devices={devices} targets={targets} />
          </div>

          {/* Log Panel */}
          <div className="h-64 border-t border-bluek9-cyan/30">
            <LogPanel logs={logs} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showTargetManager && (
        <TargetManager
          targets={targets}
          onClose={() => setShowTargetManager(false)}
        />
      )}

      {showRadioManager && (
        <RadioManager
          radios={radios}
          onClose={() => setShowRadioManager(false)}
        />
      )}

      {showSMSConfig && (
        <SMSConfig
          onClose={() => setShowSMSConfig(false)}
        />
      )}

      {showAnalytics && (
        <AnalyticsPanel
          devices={devices}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  );
}
