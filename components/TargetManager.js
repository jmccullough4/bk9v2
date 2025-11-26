import { useState, useMemo } from 'react';

export default function TargetManager({ targets, onClose }) {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('addedAt');
  const [sortDirection, setSortDirection] = useState('desc');

  const sortedTargets = useMemo(() => {
    return [...targets].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [targets, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    setError('');

    // Validate MAC address
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(address)) {
      setError('Invalid MAC address format');
      return;
    }

    try {
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, name, description }),
      });

      if (response.ok) {
        setAddress('');
        setName('');
        setDescription('');
      } else {
        setError('Failed to add target');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleRemoveTarget = async (targetAddress) => {
    if (!confirm(`Remove target ${targetAddress}?`)) {
      return;
    }

    try {
      await fetch(`/api/targets/${encodeURIComponent(targetAddress)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to remove target:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bluek9-dark border border-bluek9-cyan/30 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bluek9-cyan/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-bluek9-cyan">🎯 Target Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Add Target Form */}
          <form onSubmit={handleAddTarget} className="space-y-4">
            <h3 className="font-semibold text-white">Add New Target</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                MAC Address *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Target device name"
                className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional information about this target"
                rows={3}
                className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg focus:outline-none focus:border-bluek9-cyan resize-none"
              />
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
              Add Target
            </button>
          </form>

          {/* Target List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">
                Current Targets ({targets.length})
              </h3>
              <div className="flex space-x-3 text-xs">
                <button
                  onClick={() => handleSort('name')}
                  className="text-gray-400 hover:text-white transition"
                >
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('address')}
                  className="text-gray-400 hover:text-white transition"
                >
                  Address {sortField === 'address' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('addedAt')}
                  className="text-gray-400 hover:text-white transition"
                >
                  Added {sortField === 'addedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {sortedTargets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No targets configured
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTargets.map((target) => (
                  <div
                    key={target.address}
                    className="bg-bluek9-darker border border-red-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-red-400 font-bold">
                            {target.name}
                          </span>
                          <span className="text-xs text-gray-500">🎯</span>
                        </div>
                        <div className="text-sm text-gray-400 font-mono mt-1">
                          {target.address}
                        </div>
                        {target.description && (
                          <div className="text-sm text-gray-500 mt-1">
                            {target.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-600 mt-1">
                          Added {new Date(target.addedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTarget(target.address)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
