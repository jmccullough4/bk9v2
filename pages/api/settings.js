export default function handler(req, res) {
  const BlueK9Database = require('../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'GET') {
    try {
      const settings = db.getAllSettings();
      res.status(200).json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
