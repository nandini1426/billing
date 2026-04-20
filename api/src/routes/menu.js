const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL CATEGORIES ────────────────────────────────────────
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM categories WHERE is_active=true ORDER BY sort_order'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ITEMS BY CATEGORY ─────────────────────────────────────
router.get('/categories/:id/items', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM menu_items WHERE category_id=$1 AND is_available=true ORDER BY name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL ITEMS ─────────────────────────────────────────────
router.get('/items', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT mi.*, c.name as category_name
       FROM menu_items mi
       JOIN categories c ON c.id = mi.category_id
       ORDER BY c.sort_order, mi.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD CATEGORY (admin only) ─────────────────────────────────
router.post('/categories', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, icon_url, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const { rows } = await db.query(
      'INSERT INTO categories (name, icon_url, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name, icon_url || '', sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE CATEGORY (admin only) ──────────────────────────────
router.put('/categories/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, icon_url, sort_order, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE categories
       SET name=COALESCE($1,name),
           icon_url=COALESCE($2,icon_url),
           sort_order=COALESCE($3,sort_order),
           is_active=COALESCE($4,is_active)
       WHERE id=$5 RETURNING *`,
      [name, icon_url, sort_order, is_active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE CATEGORY (admin only) ──────────────────────────────
router.delete('/categories/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query('UPDATE categories SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Category removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD ITEM (admin only) ─────────────────────────────────────
router.post('/items', authMiddleware, requireRole('admin'), async (req, res) => {
  const { category_id, name, price, image_url } = req.body;
  if (!category_id || !name || price == null)
    return res.status(400).json({ error: 'category_id, name and price are required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO menu_items (category_id, name, price, image_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [category_id, name, price, image_url || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE ITEM (admin only) ──────────────────────────────────
router.put('/items/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, price, is_available, image_url } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE menu_items
       SET name=COALESCE($1,name),
           price=COALESCE($2,price),
           is_available=COALESCE($3,is_available),
           image_url=COALESCE($4,image_url),
           updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, price, is_available, image_url, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ITEM (admin only) ──────────────────────────────────
router.delete('/items/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'UPDATE menu_items SET is_available=false WHERE id=$1',
      [req.params.id]
    );
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;