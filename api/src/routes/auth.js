const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// ── REGISTER ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password, phone } = req.body;

  // Validation
  if (!username || username.length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!password || password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });

  try {
    // Check if username or email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE username=$1 OR email=$2',
      [username, email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already taken' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, 'cashier')
       RETURNING id, username, email, role`,
      [username, email, hash, phone]
    );

    res.status(201).json({
      message: 'Account created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE username=$1',
      [username]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET CURRENT USER ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;