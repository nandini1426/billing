const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET RESTAURANT SETTINGS ───────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM restaurant_settings WHERE restaurant_id=$1 LIMIT 1',
      [req.user.restaurant_id]
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

// ── UPDATE SETTINGS (admin only) ─────────────────────────────
router.put('/', authMiddleware, requireRole('admin'), async (req, res) => {
  const {
    name, address, contact,
    gstin, upi_id, service_charge, footer_text
  } = req.body;

  try {
    // Check if settings exist
    const { rows: existing } = await db.query(
      'SELECT id FROM restaurant_settings WHERE restaurant_id=$1',
      [req.user.restaurant_id]
    );

    let rows;
    if (existing.length > 0) {
      const result = await db.query(
        `UPDATE restaurant_settings
         SET name=COALESCE($1,name),
             address=COALESCE($2,address),
             contact=COALESCE($3,contact),
             gstin=COALESCE($4,gstin),
             upi_id=COALESCE($5,upi_id),
             service_charge=COALESCE($6,service_charge),
             footer_text=COALESCE($7,footer_text),
             updated_at=NOW()
         WHERE restaurant_id=$8
         RETURNING *`,
        [name, address, contact, gstin, upi_id,
         service_charge, footer_text, req.user.restaurant_id]
      );
      rows = result.rows;
    } else {
      const result = await db.query(
        `INSERT INTO restaurant_settings
         (name, address, contact, gstin, upi_id,
          service_charge, footer_text, restaurant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [name, address, contact, gstin, upi_id,
         service_charge, footer_text, req.user.restaurant_id]
      );
      rows = result.rows;
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET CASHIERS ──────────────────────────────────────────────
router.get('/cashiers', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM cashiers
       WHERE is_active=true AND restaurant_id=$1
       ORDER BY name`,
      [req.user.restaurant_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD CASHIER (admin only) ──────────────────────────────────
router.post('/cashiers', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO cashiers (name, restaurant_id)
       VALUES ($1,$2) RETURNING *`,
      [name, req.user.restaurant_id]
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
      `UPDATE cashiers SET is_active=false
       WHERE id=$1 AND restaurant_id=$2`,
      [req.params.id, req.user.restaurant_id]
    );
    res.json({ message: 'Cashier removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;