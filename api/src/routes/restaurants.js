const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Generate unique restaurant code ──────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'REST-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ── GET current restaurant info ───────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM restaurants WHERE id=$1',
      [req.user.restaurant_id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Restaurant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET restaurant code (admin only) ─────────────────────────
router.get('/code', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT code FROM restaurants WHERE id=$1',
      [req.user.restaurant_id]
    );
    res.json({ code: rows[0]?.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VALIDATE restaurant code (public) ────────────────────────
router.post('/validate-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  try {
    const { rows } = await db.query(
      'SELECT id, name FROM restaurants WHERE code=$1 AND is_active=true',
      [code.toUpperCase()]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Invalid restaurant code' });
    res.json({ valid: true, restaurant: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;