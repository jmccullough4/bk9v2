export default function handler(req, res) {
  const BlueK9Database = require('../../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'POST') {
    try {
      const { gpsSource, nmeaIp, nmeaPort } = req.body;

      db.setSetting('gpsSource', gpsSource);
      db.setSetting('nmeaIp', nmeaIp || '');
      db.setSetting('nmeaPort', nmeaPort || '10110');

      db.addLog('info', `GPS settings updated: ${gpsSource}`);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving GPS settings:', error);
      res.status(500).json({ error: 'Failed to save GPS settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
