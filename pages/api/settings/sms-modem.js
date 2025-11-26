export default function handler(req, res) {
  const BlueK9Database = require('../../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'POST') {
    try {
      const { smsModemPath } = req.body;

      // Save modem path setting
      db.setSetting('smsModemPath', smsModemPath || '');

      db.addLog('info', `SMS modem path updated: ${smsModemPath || 'disabled'}`);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving SMS modem settings:', error);
      res.status(500).json({ error: 'Failed to save SMS modem settings' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
