const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// ── Generate unique restaurant code ──────────────────────────
async function generateUniqueCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code, exists;
  do {
    code = 'REST-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const { rows } = await db.query(
      'SELECT id FROM restaurants WHERE code=$1', [code]
    );
    exists = rows.length > 0;
  } while (exists);
  return code;
}

// ── REGISTER ─────────────────────────────────────────────────
// Two types:
// 1. Owner registers → creates new restaurant
// 2. Staff registers → joins existing restaurant with code
router.post('/register', async (req, res) => {
  const {
    username, email, password, phone,
    role = 'cashier',
    restaurant_code,
    restaurant_name
  } = req.body;

  // Validation
  if (!username || username.length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!password || password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check username/email uniqueness
    const existing = await client.query(
      'SELECT id FROM users WHERE username=$1 OR email=$2',
      [username, email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already taken' });

    let restaurant_id;
    let userRole = role;

    if (role === 'admin') {
      // Owner registering — create new restaurant
      const code = await generateUniqueCode();
      const name = restaurant_name || `${username}'s Restaurant`;
      const { rows: [restaurant] } = await client.query(
        'INSERT INTO restaurants (name, code) VALUES ($1,$2) RETURNING *',
        [name, code]
      );
      restaurant_id = restaurant.id;

      // Create default tables T1-T10 for new restaurant
      const tables = [
        ['T1',4],['T2',4],['T3',4],['T4',4],['T5',4],
        ['T6',6],['T7',6],['T8',6],['T9',2],['T10',2]
      ];
      for (const [label, capacity] of tables) {
        await client.query(
          'INSERT INTO tables (label, capacity, restaurant_id) VALUES ($1,$2,$3)',
          [label, capacity, restaurant_id]
        );
      }

      // Create default categories for new restaurant
      const categories = [
        ['Dosas', 'dosa', 1],
        ['Burgers', 'burger', 2],
        ['Continental', 'cont', 3],
        ['Fried Rice', 'rice', 4],
        ['Noodles', 'noodle', 5],
        ['Biriyani', 'biry', 6],
        ['Cool Drinks', 'drink', 7],
        ['Water Bottle', 'water', 8],
      ];
      for (const [name, icon, sort] of categories) {
        await client.query(
          'INSERT INTO categories (name, icon_url, sort_order, restaurant_id) VALUES ($1,$2,$3,$4)',
          [name, icon, sort, restaurant_id]
        );
      }

      // Create default restaurant settings
      await client.query(
        'INSERT INTO restaurant_settings (name, restaurant_id) VALUES ($1,$2)',
        [name, restaurant_id]
      );

      userRole = 'admin';

    } else {
      // Staff registering — must provide restaurant code
      if (!restaurant_code)
        return res.status(400).json({ error: 'Restaurant code is required for staff' });

      const { rows: [restaurant] } = await client.query(
        'SELECT * FROM restaurants WHERE code=$1 AND is_active=true',
        [restaurant_code.toUpperCase()]
      );
      if (!restaurant)
        return res.status(404).json({ error: 'Invalid restaurant code' });

      restaurant_id = restaurant.id;

      // Validate role
      if (!['manager', 'cashier'].includes(role))
        userRole = 'cashier';
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users
       (username, email, password_hash, phone, role, restaurant_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, email, role, restaurant_id`,
      [username, email, hash, phone, userRole, restaurant_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Account created successfully',
      user,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const { rows: [user] } = await db.query(
      'SELECT * FROM users WHERE username=$1',
      [username]
    );
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurant_id: user.restaurant_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurant_id: user.restaurant_id
      }
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