import { useState, useEffect } from 'react';

export default function SettingsManager({ onClose }) {
  const [activeTab, setActiveTab] = useState('gps');
  const [gpsSource, setGpsSource] = useState('simulated');
  const [systemName, setSystemName] = useState('BlueK9-01');
  const [nmeaIp, setNmeaIp] = useState('');
  const [nmeaPort, setNmeaPort] = useState('10110');
  const [radios, setRadios] = useState([]);
  const [availableRadios, setAvailableRadios] = useState({ bluetooth: [], wifi: [] });
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [smsNumbers, setSmsNumbers] = useState([]);
  const [newSmsNumber, setNewSmsNumber] = useState('');
  const [smsModemPath, setSmsModemPath] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
    loadRadios();
    loadUsers();
    loadSmsNumbers();
    queryAvailableRadios();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setGpsSource(data.gpsSource || 'simulated');
        setSystemName(data.systemName || 'BlueK9-01');
        setNmeaIp(data.nmeaIp || '');
        setNmeaPort(data.nmeaPort || '10110');
        setSmsModemPath(data.smsModemPath || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadRadios = async () => {
    try {
      const response = await fetch('/api/radios');
      if (response.ok) {
        const data = await response.json();
        setRadios(data.radios || []);
      }
    } catch (err) {
      console.error('Failed to load radios:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const queryAvailableRadios = async () => {
    try {
      const response = await fetch('/api/radios/available');
      if (response.ok) {
        const data = await response.json();
        setAvailableRadios(data);
      }
    } catch (err) {
      console.error('Failed to query radios:', err);
    }
  };

  const saveGpsSettings = async () => {
    setError('');
    setSuccess('');

    if (!systemName || systemName.trim().length < 3) {
      setError('System Name must be at least 3 characters');
      return;
    }

    try {
      const response = await fetch('/api/settings/gps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gpsSource, systemName, nmeaIp, nmeaPort }),
      });

      if (response.ok) {
        // Trigger GPS mode switch in real-time
        await fetch('/api/settings/gps/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gpsSource }),
        });

        setSuccess('Settings saved');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const addRadio = async (type, device) => {
    try {
      const response = await fetch('/api/radios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, device }),
      });

      if (response.ok) {
        await loadRadios();
        await queryAvailableRadios();
      }
    } catch (err) {
      console.error('Failed to add radio:', err);
    }
  };

  const removeRadio = async (id) => {
    try {
      await fetch(`/api/radios/${id}`, { method: 'DELETE' });
      await loadRadios();
      await queryAvailableRadios();
    } catch (err) {
      console.error('Failed to remove radio:', err);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });

      if (response.ok) {
        setSuccess('User created');
        setNewUsername('');
        setNewPassword('');
        await loadUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const deleteUser = async (username) => {
    if (username === 'bluek9') {
      setError('Cannot delete admin user');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!confirm(`Delete user ${username}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${username}`, { method: 'DELETE' });
      if (response.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const loadSmsNumbers = async () => {
    try {
      const response = await fetch('/api/sms/numbers');
      if (response.ok) {
        const data = await response.json();
        setSmsNumbers(data.numbers || []);
      }
    } catch (err) {
      console.error('Failed to load SMS numbers:', err);
    }
  };

  const addSmsNumber = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate phone number (basic US format)
    const cleanNumber = newSmsNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 10 && cleanNumber.length !== 11) {
      setError('Enter a valid 10-digit US phone number');
      return;
    }

    if (smsNumbers.length >= 10) {
      setError('Maximum 10 SMS numbers allowed');
      return;
    }

    try {
      const response = await fetch('/api/sms/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: cleanNumber }),
      });

      if (response.ok) {
        setSuccess('SMS number added');
        setNewSmsNumber('');
        await loadSmsNumbers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add SMS number');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const removeSmsNumber = async (number) => {
    try {
      const response = await fetch('/api/sms/numbers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });

      if (response.ok) {
        await loadSmsNumbers();
      }
    } catch (err) {
      console.error('Failed to remove SMS number:', err);
    }
  };

  const saveSmsModemSettings = async () => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/settings/sms-modem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsModemPath }),
      });

      if (response.ok) {
        setSuccess('Modem settings saved');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to save modem settings');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bluek9-dark border border-bluek9-cyan/30 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bluek9-cyan/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-bluek9-cyan">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('gps')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'gps'
                ? 'text-bluek9-cyan border-b-2 border-bluek9-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            GPS
          </button>
          <button
            onClick={() => setActiveTab('radios')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'radios'
                ? 'text-bluek9-cyan border-b-2 border-bluek9-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Radios
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'sms'
                ? 'text-bluek9-cyan border-b-2 border-bluek9-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            SMS
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'users'
                ? 'text-bluek9-cyan border-b-2 border-bluek9-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Users
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-500/10 border border-green-500 text-green-500 px-4 py-2 rounded-lg text-sm">
              {success}
            </div>
          )}

          {/* GPS Tab */}
          {activeTab === 'gps' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white">System & GPS Configuration</h3>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  System Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={systemName}
                  onChange={(e) => setSystemName(e.target.value)}
                  placeholder="BlueK9-01"
                  className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Identifies this system in SMS alerts and cloud sync
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  GPS Source
                </label>
                <select
                  value={gpsSource}
                  onChange={(e) => setGpsSource(e.target.value)}
                  className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                >
                  <option value="simulated">Simulated GPS</option>
                  <option value="gpsd">GPSD</option>
                  <option value="mnav">Mnav</option>
                  <option value="nmea">NMEA TCP</option>
                </select>
              </div>

              {gpsSource === 'nmea' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      NMEA Server IP
                    </label>
                    <input
                      type="text"
                      value={nmeaIp}
                      onChange={(e) => setNmeaIp(e.target.value)}
                      placeholder="192.168.1.100"
                      className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      NMEA Port
                    </label>
                    <input
                      type="text"
                      value={nmeaPort}
                      onChange={(e) => setNmeaPort(e.target.value)}
                      placeholder="10110"
                      className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={saveGpsSettings}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                Save GPS Settings
              </button>

              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>• <strong>Simulated GPS:</strong> Development mode with virtual location</p>
                <p>• <strong>GPSD:</strong> Standard Linux GPS daemon</p>
                <p>• <strong>Mnav:</strong> Military navigation system</p>
                <p>• <strong>NMEA TCP:</strong> Custom NMEA server (default port 10110)</p>
              </div>
            </div>
          )}

          {/* Radios Tab */}
          {activeTab === 'radios' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white">Radio Management</h3>

              {/* Available Bluetooth Radios */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Available Bluetooth Radios
                </h4>
                {availableRadios.bluetooth.length === 0 ? (
                  <div className="text-sm text-gray-500">No Bluetooth radios detected</div>
                ) : (
                  <div className="space-y-2">
                    {availableRadios.bluetooth.map((radio) => (
                      <div
                        key={radio.device}
                        className="flex items-center justify-between bg-bluek9-darker border border-gray-600 rounded-lg p-3"
                      >
                        <div>
                          <div className="text-white font-mono text-sm">{radio.device}</div>
                          <div className="text-xs text-gray-500">{radio.address}</div>
                        </div>
                        <button
                          onClick={() => addRadio('bluetooth', radio.device)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available WiFi Radios */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Available WiFi Radios
                </h4>
                {availableRadios.wifi.length === 0 ? (
                  <div className="text-sm text-gray-500">No WiFi radios detected</div>
                ) : (
                  <div className="space-y-2">
                    {availableRadios.wifi.map((radio) => (
                      <div
                        key={radio.device}
                        className="flex items-center justify-between bg-bluek9-darker border border-gray-600 rounded-lg p-3"
                      >
                        <div>
                          <div className="text-white font-mono text-sm">{radio.device}</div>
                          <div className="text-xs text-gray-500">
                            {radio.driver} - {radio.chipset}
                          </div>
                        </div>
                        <button
                          onClick={() => addRadio('wifi', radio.device)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Radios */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Active Radios ({radios.length})
                </h4>
                {radios.length === 0 ? (
                  <div className="text-sm text-gray-500">No active radios</div>
                ) : (
                  <div className="space-y-2">
                    {radios.map((radio) => (
                      <div
                        key={radio.id}
                        className="flex items-center justify-between bg-bluek9-darker border border-bluek9-cyan/30 rounded-lg p-3"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-bluek9-cyan font-medium text-sm">
                              {radio.type.toUpperCase()}
                            </span>
                            <span className="text-white font-mono text-sm">{radio.device}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Added {new Date(radio.addedAt).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => removeRadio(radio.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={queryAvailableRadios}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                Refresh Available Radios
              </button>
            </div>
          )}

          {/* SMS Tab */}
          {activeTab === 'sms' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white">SMS Configuration</h3>

              {/* Modem Configuration */}
              <div className="bg-bluek9-darker border border-gray-600 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-400">SIMCOM7600 Modem Settings</h4>
                <div className="bg-amber-950 border border-amber-700 rounded p-3 text-xs text-amber-200">
                  <p className="font-semibold mb-1">⚠️ IMPORTANT:</p>
                  <p className="mb-1">Configure the correct modem port to avoid interfering with your internet connection.</p>
                  <p>For SIMCOM7600: Use /dev/ttyUSB2 or /dev/ttyUSB3 (NOT the PPP/internet port)</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Modem Device Path
                  </label>
                  <input
                    type="text"
                    value={smsModemPath}
                    onChange={(e) => setSmsModemPath(e.target.value)}
                    placeholder="/dev/ttyUSB2"
                    className="w-full px-3 py-2 bg-bluek9-dark border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to disable SMS (logs only)</p>
                </div>
                <button
                  onClick={saveSmsModemSettings}
                  className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Save Modem Settings
                </button>
              </div>

              <h3 className="font-semibold text-white mt-6">SMS Alert Numbers</h3>

              {/* Add SMS Number Form */}
              <form onSubmit={addSmsNumber} className="space-y-3 bg-bluek9-darker border border-gray-600 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400">Add Alert Number</h4>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Phone Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    value={newSmsNumber}
                    onChange={(e) => setNewSmsNumber(e.target.value)}
                    placeholder="5551234567"
                    className="w-full px-3 py-2 bg-bluek9-dark border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Add Number
                </button>
              </form>

              {/* SMS Numbers List */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Alert Numbers ({smsNumbers.length}/10)
                </h4>
                {smsNumbers.length === 0 ? (
                  <div className="text-sm text-gray-500">No SMS alert numbers configured</div>
                ) : (
                  <div className="space-y-2">
                    {smsNumbers.map((number) => (
                      <div
                        key={number}
                        className="flex items-center justify-between bg-bluek9-darker border border-gray-600 rounded-lg p-3"
                      >
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-white font-mono">
                            {number.length === 10 ? `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}` : number}
                          </span>
                        </div>
                        <button
                          onClick={() => removeSmsNumber(number)}
                          className="px-3 py-1 bg-red-900 hover:bg-red-800 text-white text-sm rounded transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• SMS alerts sent when target devices are detected</p>
                <p>• Up to 10 phone numbers (US only)</p>
                <p>• Requires SIMCOM7600 cellular modem</p>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white">User Management</h3>

              {/* Create User Form */}
              <form onSubmit={createUser} className="space-y-3 bg-bluek9-darker border border-gray-600 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400">Create New User</h4>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Username (min 3 characters)"
                    className="w-full px-3 py-2 bg-bluek9-dark border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="w-full px-3 py-2 bg-bluek9-dark border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Create User
                </button>
              </form>

              {/* User List */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">
                  Users ({users.length})
                </h4>
                {users.length === 0 ? (
                  <div className="text-sm text-gray-500">No users</div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.username}
                        className="flex items-center justify-between bg-bluek9-darker border border-gray-600 rounded-lg p-3"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium">{user.username}</span>
                            {user.username === 'bluek9' && (
                              <span className="text-xs bg-bluek9-cyan text-black px-2 py-0.5 rounded">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created {new Date(user.createdAt).toLocaleString()}
                          </div>
                        </div>
                        {user.username !== 'bluek9' && (
                          <button
                            onClick={() => deleteUser(user.username)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
