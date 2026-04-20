const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL TABLES ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM tables ORDER BY label'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE TABLE STATUS (admin only) ─────────────────────────
router.patch('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'occupied', 'reserved'];

  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const { rows } = await db.query(
      'UPDATE tables SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Table not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;