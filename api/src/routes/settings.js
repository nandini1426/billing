const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET RESTAURANT SETTINGS ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM restaurant_settings LIMIT 1'
    );
    if (!rows.length) {
      return res.json({
        name: 'My Restaurant',
        address: '',
        contact: '',
        gstin: '',
        upi_id: '',
        service_charge: 0,
        footer_text: 'Thank you! Visit again'
      });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE RESTAURANT SETTINGS (admin only) ───────────────────
router.put('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const {
    name, address, contact,
    gstin, upi_id, service_charge, footer_text
  } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE restaurant_settings
       SET name=COALESCE($1,name),
           address=COALESCE($2,address),
           contact=COALESCE($3,contact),
           gstin=COALESCE($4,gstin),
           upi_id=COALESCE($5,upi_id),
           service_charge=COALESCE($6,service_charge),
           footer_text=COALESCE($7,footer_text),
           updated_at=NOW()
       RETURNING *`,
      [name, address, contact, gstin, upi_id, service_charge, footer_text]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL CASHIERS ──────────────────────────────────────────
router.get('/cashiers', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM cashiers WHERE is_active=true ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD CASHIER (admin only) ──────────────────────────────────
router.post('/cashiers', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { rows } = await db.query(
      'INSERT INTO cashiers (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE CASHIER (admin only) ───────────────────────────────
router.delete('/cashiers/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'UPDATE cashiers SET is_active=false WHERE id=$1',
      [req.params.id]
    );
    res.json({ message: 'Cashier removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;