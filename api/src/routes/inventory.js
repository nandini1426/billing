const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET ALL INGREDIENTS ───────────────────────────────────────
router.get('/ingredients', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT i.*,
        COALESCE((
          SELECT SUM(ri.quantity_used * oi.quantity)
          FROM recipe_items ri
          JOIN order_items oi ON oi.menu_item_id = ri.menu_item_id
          JOIN orders o ON o.id = oi.order_id
          WHERE ri.ingredient_id = i.id
            AND o.status = 'completed'
            AND o.created_at > NOW() - INTERVAL '7 days'
        ), 0) AS used_last_7_days
      FROM ingredients i
      WHERE i.restaurant_id = $1
      ORDER BY i.name ASC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET SINGLE INGREDIENT ─────────────────────────────────────
router.get('/ingredients/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM ingredients WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ingredient not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADD INGREDIENT (admin only) ───────────────────────────────
router.post('/ingredients', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, unit, current_stock, min_stock, cost_per_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO ingredients (name, unit, current_stock, min_stock, cost_per_unit, restaurant_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name, unit||'kg', current_stock||0, min_stock||0, cost_per_unit||0, req.user.restaurant_id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── UPDATE INGREDIENT (admin only) ────────────────────────────
router.put('/ingredients/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { name, unit, min_stock, cost_per_unit } = req.body;
  try {
    const { rows } = await db.query(`
      UPDATE ingredients
      SET name=COALESCE($1,name),
          unit=COALESCE($2,unit),
          min_stock=COALESCE($3,min_stock),
          cost_per_unit=COALESCE($4,cost_per_unit),
          updated_at=NOW()
      WHERE id=$5 AND restaurant_id=$6
      RETURNING *
    `, [name, unit, min_stock, cost_per_unit, req.params.id, req.user.restaurant_id]);
    if (!rows.length) return res.status(404).json({ error: 'Ingredient not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE INGREDIENT (admin only) ────────────────────────────
router.delete('/ingredients/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM ingredients WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    res.json({ message: 'Ingredient deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET RECIPE FOR MENU ITEM ──────────────────────────────────
router.get('/recipe/:menu_item_id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ri.*, i.name AS ingredient_name, i.unit, i.current_stock
      FROM recipe_items ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2
      ORDER BY i.name
    `, [req.params.menu_item_id, req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADD RECIPE ITEM (admin only) ──────────────────────────────
router.post('/recipe', authMiddleware, requireRole('admin'), async (req, res) => {
  const { menu_item_id, ingredient_id, quantity_used } = req.body;
  if (!menu_item_id || !ingredient_id || !quantity_used)
    return res.status(400).json({ error: 'menu_item_id, ingredient_id and quantity_used required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO recipe_items (menu_item_id, ingredient_id, quantity_used, restaurant_id)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (menu_item_id, ingredient_id)
      DO UPDATE SET quantity_used = $3
      RETURNING *
    `, [menu_item_id, ingredient_id, quantity_used, req.user.restaurant_id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE RECIPE ITEM (admin only) ───────────────────────────
router.delete('/recipe/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM recipe_items WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    res.json({ message: 'Recipe item deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADD STOCK PURCHASE (admin only) ──────────────────────────
router.post('/purchases', authMiddleware, requireRole('admin'), async (req, res) => {
  const { ingredient_id, quantity, cost_per_unit, supplier_name, notes } = req.body;
  if (!ingredient_id || !quantity)
    return res.status(400).json({ error: 'ingredient_id and quantity required' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const total_cost = (quantity * (cost_per_unit || 0)).toFixed(2);
    const { rows } = await client.query(`
      INSERT INTO stock_purchases
        (ingredient_id, quantity, cost_per_unit, total_cost, supplier_name, notes, restaurant_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [ingredient_id, quantity, cost_per_unit||0, total_cost, supplier_name||null, notes||null, req.user.restaurant_id]);

    // Update ingredient stock
    await client.query(`
      UPDATE ingredients
      SET current_stock = current_stock + $1, updated_at = NOW()
      WHERE id = $2 AND restaurant_id = $3
    `, [quantity, ingredient_id, req.user.restaurant_id]);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── GET PURCHASE HISTORY ──────────────────────────────────────
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sp.*, i.name AS ingredient_name, i.unit
      FROM stock_purchases sp
      JOIN ingredients i ON i.id = sp.ingredient_id
      WHERE sp.restaurant_id = $1
      ORDER BY sp.purchased_at DESC
      LIMIT 50
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── RECORD WASTE (admin + manager + cashier) ──────────────────
router.post('/waste', authMiddleware, async (req, res) => {
  const { ingredient_id, quantity, reason, notes } = req.body;
  if (!ingredient_id || !quantity || !reason)
    return res.status(400).json({ error: 'ingredient_id, quantity and reason required' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check stock available
    const { rows: [ingredient] } = await client.query(
      'SELECT * FROM ingredients WHERE id=$1 AND restaurant_id=$2',
      [ingredient_id, req.user.restaurant_id]
    );
    if (!ingredient) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    if (Number(ingredient.current_stock) < Number(quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough stock. Available: ${ingredient.current_stock} ${ingredient.unit}` });
    }

    // Record waste
    const { rows } = await client.query(`
      INSERT INTO stock_waste
        (ingredient_id, quantity, reason, notes, restaurant_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [ingredient_id, quantity, reason, notes||null, req.user.restaurant_id]);

    // Deduct from stock
    await client.query(`
      UPDATE ingredients
      SET current_stock = current_stock - $1, updated_at = NOW()
      WHERE id = $2 AND restaurant_id = $3
    `, [quantity, ingredient_id, req.user.restaurant_id]);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── GET WASTE HISTORY ─────────────────────────────────────────
router.get('/waste', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sw.*, i.name AS ingredient_name, i.unit
      FROM stock_waste sw
      JOIN ingredients i ON i.id = sw.ingredient_id
      WHERE sw.restaurant_id = $1
      ORDER BY sw.wasted_at DESC
      LIMIT 50
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET LOW STOCK ALERTS ──────────────────────────────────────
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM ingredients
      WHERE restaurant_id = $1
        AND current_stock <= min_stock
        AND min_stock > 0
      ORDER BY current_stock ASC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET HOW MANY DISHES CAN BE MADE ──────────────────────────
router.get('/can-make', authMiddleware, async (req, res) => {
  try {
    const { rows: menuItems } = await db.query(`
      SELECT DISTINCT mi.id, mi.name, mi.price, c.name AS category
      FROM menu_items mi
      JOIN categories c ON c.id = mi.category_id
      JOIN recipe_items ri ON ri.menu_item_id = mi.id
      WHERE mi.restaurant_id = $1 AND mi.is_available = true
      ORDER BY mi.name
    `, [req.user.restaurant_id]);

    const result = [];
    for (const item of menuItems) {
      const { rows: recipe } = await db.query(`
        SELECT ri.quantity_used, i.current_stock, i.name AS ingredient_name, i.unit
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2
      `, [item.id, req.user.restaurant_id]);

      let canMake = Infinity;
      for (const r of recipe) {
        const possible = Math.floor(Number(r.current_stock) / Number(r.quantity_used));
        canMake = Math.min(canMake, possible);
      }

      result.push({
        ...item,
        can_make: canMake === Infinity ? null : canMake,
        has_recipe: recipe.length > 0,
        recipe,
      });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AUTO DEDUCT STOCK WHEN ORDER PLACED ──────────────────────
router.post('/deduct/:order_id', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderItems } = await client.query(`
      SELECT oi.menu_item_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = $1
    `, [req.params.order_id]);

    for (const oi of orderItems) {
      const { rows: recipe } = await client.query(`
        SELECT ri.ingredient_id, ri.quantity_used
        FROM recipe_items ri
        WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2
      `, [oi.menu_item_id, req.user.restaurant_id]);

      for (const r of recipe) {
        const totalUsed = Number(r.quantity_used) * Number(oi.quantity);
        await client.query(`
          UPDATE ingredients
          SET current_stock = GREATEST(current_stock - $1, 0),
              updated_at = NOW()
          WHERE id = $2 AND restaurant_id = $3
        `, [totalUsed, r.ingredient_id, req.user.restaurant_id]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Stock deducted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;