import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function SurveyTable({ devices, onDeviceRightClick }) {
  const [sortField, setSortField] = useState('lastSeen');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filter, setFilter] = useState('');

  const sortedDevices = useMemo(() => {
    let filtered = devices;

    if (filter) {
      filtered = devices.filter(d =>
        d.address.toLowerCase().includes(filter.toLowerCase()) ||
        (d.name && d.name.toLowerCase().includes(filter.toLowerCase())) ||
        (d.manufacturer && d.manufacturer.toLowerCase().includes(filter.toLowerCase()))
      );
    }

    return filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'rssi') {
        aVal = aVal || -999;
        bVal = bVal || -999;
      }

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
  }, [devices, sortField, sortDirection, filter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getRSSIColor = (rssi) => {
    if (rssi > -50) return 'text-green-400';
    if (rssi > -70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-600">⇅</span>;
    return sortDirection === 'asc' ? <span className="text-bluek9-cyan">↑</span> : <span className="text-bluek9-cyan">↓</span>;
  };

  return (
    <div className="h-full flex flex-col bg-bluek9-dark">
      {/* Header */}
      <div className="px-4 py-3 border-b border-bluek9-cyan/30">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-bluek9-cyan">Survey Results</h2>
          <span className="text-sm text-gray-400">{sortedDevices.length} device(s)</span>
        </div>
        <input
          type="text"
          placeholder="Filter by address, name, or manufacturer..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 bg-bluek9-darker border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-bluek9-cyan"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bluek9-dark border-b border-bluek9-cyan/30">
            <tr>
              <th
                onClick={() => handleSort('address')}
                className="px-3 py-2 text-left cursor-pointer hover:bg-bluek9-darker"
              >
                <div className="flex items-center space-x-1">
                  <span>BD Address</span>
                  <SortIcon field="address" />
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="px-3 py-2 text-left cursor-pointer hover:bg-bluek9-darker"
              >
                <div className="flex items-center space-x-1">
                  <span>Device Name</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                onClick={() => handleSort('manufacturer')}
                className="px-3 py-2 text-left cursor-pointer hover:bg-bluek9-darker"
              >
                <div className="flex items-center space-x-1">
                  <span>Manufacturer</span>
                  <SortIcon field="manufacturer" />
                </div>
              </th>
              <th
                onClick={() => handleSort('rssi')}
                className="px-3 py-2 text-left cursor-pointer hover:bg-bluek9-darker"
              >
                <div className="flex items-center space-x-1">
                  <span>RSSI</span>
                  <SortIcon field="rssi" />
                </div>
              </th>
              <th className="px-3 py-2 text-left">Emitter Location</th>
              <th
                onClick={() => handleSort('lastSeen')}
                className="px-3 py-2 text-left cursor-pointer hover:bg-bluek9-darker"
              >
                <div className="flex items-center space-x-1">
                  <span>Last Seen</span>
                  <SortIcon field="lastSeen" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDevices.map((device) => (
              <tr
                key={device.address}
                onContextMenu={(e) => onDeviceRightClick && onDeviceRightClick(e, device)}
                className="border-b border-gray-700 hover:bg-bluek9-darker/50 cursor-pointer transition"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  {device.address}
                </td>
                <td className="px-3 py-2">
                  {device.name || '(Unknown)'}
                </td>
                <td className="px-3 py-2 text-gray-400">
                  {device.manufacturer || '-'}
                </td>
                <td className={`px-3 py-2 ${getRSSIColor(device.rssi)}`}>
                  {device.rssi ? `${device.rssi} dBm` : '-'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">
                  {device.emitterLat && device.emitterLon
                    ? `${device.emitterLat.toFixed(6)}, ${device.emitterLon.toFixed(6)}`
                    : '-'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">
                  {device.lastSeen && !isNaN(device.lastSeen)
                    ? formatDistanceToNow(device.lastSeen, { addSuffix: true })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedDevices.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-500">
            {filter ? 'No devices match your filter' : 'No devices detected yet'}
          </div>
        )}
      </div>
    </div>
  );
}
