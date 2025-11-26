const bcrypt = require('bcryptjs');

export default async function handler(req, res) {
  const BlueK9Database = require('../../../server/database/db');
  const db = new BlueK9Database();

  if (req.method === 'GET') {
    try {
      const users = db.getUsers();
      res.status(200).json({ users });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  } else if (req.method === 'POST') {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user exists
      const existingUser = db.getUser(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = db.createUser(username, hashedPassword);
      res.status(200).json({ user });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
