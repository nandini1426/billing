const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL TABLES ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM tables
       WHERE restaurant_id=$1
     ORDER BY CAST(REGEXP_REPLACE(label, '[^0-9]', '', 'g') AS INTEGER) ASC`,
      [req.user.restaurant_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE TABLE STATUS ───────────────────────────────────────
router.patch('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'occupied', 'reserved'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rows } = await db.query(
      `UPDATE tables SET status=$1
       WHERE id=$2 AND restaurant_id=$3
       RETURNING *`,
      [status, req.params.id, req.user.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Table not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD TABLE (admin only) ────────────────────────────────────
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const { label, capacity } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO tables (label, capacity, restaurant_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [label, capacity || 4, req.user.restaurant_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE TABLE (admin only) ─────────────────────────────────
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM tables WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    res.json({ message: 'Table removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;