export default function handler(req, res) {
  const BlueK9Database = require('../../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'DELETE') {
    try {
      const { username } = req.query;

      // Prevent deletion of admin user
      if (username === 'bluek9') {
        return res.status(403).json({ error: 'Cannot delete admin user' });
      }

      db.deleteUser(username);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
