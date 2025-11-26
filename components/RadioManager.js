import { useState } from 'react';

export default function RadioManager({ radios, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('bluetooth');
  const [error, setError] = useState('');

  const handleAddRadio = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/radios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, type }),
      });

      if (response.ok) {
        setName('');
        setType('bluetooth');
      } else {
        setError('Failed to add radio');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleRemoveRadio = async (radioId) => {
    if (!confirm(`Remove radio ${radioId}?`)) {
      return;
    }

    try {
      await fetch(`/api/radios/${encodeURIComponent(radioId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to remove radio:', err);
    }
  };

  const getRadioIcon = (radioType) => {
    return radioType === 'wifi' ? '📶' : '📡';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scanning':
        return 'text-green-400';
      case 'ready':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scanning':
        return 'Scanning';
      case 'ready':
        return 'Ready';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bluek9-dark border border-bluek9-cyan/30 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bluek9-cyan/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-bluek9-cyan">📡 Radio Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Add Radio Form */}
          <form onSubmit={handleAddRadio} className="space-y-4">
            <h3 className="font-semibold text-white">Add Radio</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Radio Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., External Bluetooth Adapter"
                className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Radio Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
              >
                <option value="bluetooth">Bluetooth</option>
                <option value="wifi">WiFi</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-bluek9-cyan hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Add Radio
            </button>
          </form>

          {/* Radio List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white">
              Active Radios ({radios.length})
            </h3>

            {radios.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No radios configured
              </div>
            ) : (
              <div className="space-y-2">
                {radios.map((radio) => (
                  <div
                    key={radio.id}
                    className={`bg-bluek9-darker border rounded-lg p-4 ${
                      radio.enabled ? 'border-green-500/30' : 'border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{getRadioIcon(radio.type)}</span>
                          <span className="font-semibold text-white">
                            {radio.name}
                          </span>
                          {radio.primary && (
                            <span className="px-2 py-0.5 bg-blue-600 text-xs rounded-full">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <span className="text-gray-400">
                            ID: <span className="font-mono">{radio.id}</span>
                          </span>
                          <span className="text-gray-400">
                            Type: <span className="capitalize">{radio.type}</span>
                          </span>
                          <span className={getStatusColor(radio.status)}>
                            Status: {getStatusText(radio.status)}
                          </span>
                        </div>
                        {radio.virtual && (
                          <div className="mt-1 text-xs text-yellow-500">
                            ⚠ Virtual adapter (for development)
                          </div>
                        )}
                      </div>
                      {!radio.primary && (
                        <button
                          onClick={() => handleRemoveRadio(radio.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-gray-300">
            <div className="font-semibold text-blue-400 mb-2">ℹ️ Information</div>
            <ul className="space-y-1 text-xs">
              <li>• Primary radio (Sena UD100) is detected automatically</li>
              <li>• Additional Bluetooth and WiFi radios can be added manually</li>
              <li>• Radios are automatically enabled when added</li>
              <li>• Multiple radios can scan simultaneously for better coverage</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
