export default function handler(req, res) {
  const BlueK9Database = require('../../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'POST') {
    try {
      const { gpsSource, systemName, nmeaIp, nmeaPort } = req.body;

      if (systemName) {
        db.setSetting('systemName', systemName);
      }
      db.setSetting('gpsSource', gpsSource);
      db.setSetting('nmeaIp', nmeaIp || '');
      db.setSetting('nmeaPort', nmeaPort || '10110');

      db.addLog('info', `Settings updated: ${systemName || 'Unknown'} - ${gpsSource}`);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
