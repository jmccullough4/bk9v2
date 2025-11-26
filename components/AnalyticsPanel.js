import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AnalyticsPanel({ devices, onClose }) {
  const analytics = useMemo(() => {
    // Device type distribution
    const typeDistribution = devices.reduce((acc, device) => {
      const type = device.deviceType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const typeData = Object.entries(typeDistribution).map(([name, value]) => ({
      name,
      value
    }));

    // Manufacturer distribution (top 10)
    const manufacturerDistribution = devices.reduce((acc, device) => {
      const manufacturer = device.manufacturer || 'Unknown';
      acc[manufacturer] = (acc[manufacturer] || 0) + 1;
      return acc;
    }, {});

    const manufacturerData = Object.entries(manufacturerDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // RSSI distribution
    const rssiRanges = {
      'Excellent (-50 to 0)': 0,
      'Good (-70 to -50)': 0,
      'Fair (-85 to -70)': 0,
      'Poor (-100 to -85)': 0,
    };

    devices.forEach(device => {
      const rssi = device.rssi || -999;
      if (rssi > -50) rssiRanges['Excellent (-50 to 0)']++;
      else if (rssi > -70) rssiRanges['Good (-70 to -50)']++;
      else if (rssi > -85) rssiRanges['Fair (-85 to -70)']++;
      else rssiRanges['Poor (-100 to -85)']++;
    });

    const rssiData = Object.entries(rssiRanges).map(([name, value]) => ({
      name,
      value
    }));

    // Detection count (top 10 most detected)
    const topDetections = devices
      .sort((a, b) => (b.detectionCount || 1) - (a.detectionCount || 1))
      .slice(0, 10)
      .map(device => ({
        name: device.name || device.address.substring(0, 17),
        count: device.detectionCount || 1
      }));

    return {
      totalDevices: devices.length,
      uniqueManufacturers: Object.keys(manufacturerDistribution).length,
      avgRSSI: devices.length > 0
        ? (devices.reduce((sum, d) => sum + (d.rssi || -999), 0) / devices.length).toFixed(1)
        : 0,
      typeData,
      manufacturerData,
      rssiData,
      topDetections
    };
  }, [devices]);

  const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bluek9-dark border border-bluek9-cyan/30 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-bluek9-cyan/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-bluek9-cyan">📊 Analytics Dashboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg p-4">
              <div className="text-sm text-cyan-100">Total Devices</div>
              <div className="text-3xl font-bold text-white mt-1">{analytics.totalDevices}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-4">
              <div className="text-sm text-purple-100">Unique Manufacturers</div>
              <div className="text-3xl font-bold text-white mt-1">{analytics.uniqueManufacturers}</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg p-4">
              <div className="text-sm text-green-100">Average RSSI</div>
              <div className="text-3xl font-bold text-white mt-1">{analytics.avgRSSI} dBm</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Type Distribution */}
            <div className="bg-bluek9-darker border border-bluek9-cyan/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Device Type Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.typeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* RSSI Distribution */}
            <div className="bg-bluek9-darker border border-bluek9-cyan/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Signal Strength Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.rssiData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Manufacturers */}
            <div className="bg-bluek9-darker border border-bluek9-cyan/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Top Manufacturers</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.manufacturerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Detected Devices */}
            <div className="bg-bluek9-darker border border-bluek9-cyan/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Most Frequently Detected</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.topDetections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm text-gray-300">
            <div className="font-semibold text-blue-400 mb-2">📈 Analytics Information</div>
            <ul className="space-y-1 text-xs">
              <li>• Charts update in real-time as new devices are detected</li>
              <li>• RSSI (Received Signal Strength Indicator) measures signal quality</li>
              <li>• Detection count tracks how many times each device has been seen</li>
              <li>• Export data as CSV for detailed post-mission analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
