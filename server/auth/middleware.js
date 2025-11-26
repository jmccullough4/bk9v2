function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  // Simple token validation (for production, use JWT)
  if (token === 'authenticated') {
    next();
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
