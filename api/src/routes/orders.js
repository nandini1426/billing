const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── NEXT ORDER NUMBER ─────────────────────────────────────────
async function nextOrderNumber(restaurant_id) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(
      CASE WHEN order_number ~ '^[0-9]+$'
      THEN CAST(order_number AS INTEGER)
      ELSE 0 END
    ), 0) + 1 AS next
    FROM orders
    WHERE restaurant_id = $1`,
    [restaurant_id]
  );
  return String(rows[0].next);
}

// ── GET NEXT BILL NUMBER ──────────────────────────────────────
router.get('/next-number', authMiddleware, async (req, res) => {
  try {
    const next = await nextOrderNumber(req.user.restaurant_id);
    res.json({ next_number: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUBLIC BILL VIEW ──────────────────────────────────────────
router.get('/public/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*,
        json_agg(json_build_object(
          'item_id',    oi.menu_item_id,
          'name',       m.name,
          'quantity',   oi.quantity,
          'unit_price', oi.unit_price,
          'line_total', oi.line_total
        )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m   ON m.id = oi.menu_item_id
       WHERE o.id=$1
       GROUP BY o.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Bill not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUBLIC RESTAURANT SETTINGS ────────────────────────────────
router.get('/public/:id/settings', async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      'SELECT restaurant_id FROM orders WHERE id=$1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Not found' });
    const { rows: [settings] } = await db.query(
      'SELECT * FROM restaurant_settings WHERE restaurant_id=$1',
      [order.restaurant_id]
    );
    res.json(settings || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET ALL ORDERS ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { status, order_type, date, search } = req.query;
  let query = `
    SELECT o.*,
      json_agg(json_build_object(
        'item_id',    oi.menu_item_id,
        'name',       m.name,
        'quantity',   oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      )) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN menu_items m   ON m.id = oi.menu_item_id
    WHERE o.restaurant_id = $1
  `;
  const params = [req.user.restaurant_id];
  let i = 2;
  if (status)     { query += ` AND o.status = $${i++}`;           params.push(status); }
  if (order_type) { query += ` AND o.order_type = $${i++}`;       params.push(order_type); }
  if (date)       { query += ` AND o.created_at::date = $${i++}`; params.push(date); }
  if (search)     {
    query += ` AND (o.order_number ILIKE $${i} OR o.customer_name ILIKE $${i} OR o.customer_phone ILIKE $${i})`;
    params.push(`%${search}%`); i++;
  }
  query += ' GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200';
  try {
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET SINGLE ORDER ──────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*,
        json_agg(json_build_object(
          'item_id',    oi.menu_item_id,
          'name',       m.name,
          'quantity',   oi.quantity,
          'unit_price', oi.unit_price,
          'line_total', oi.line_total
        )) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu_items m   ON m.id = oi.menu_item_id
       WHERE o.id=$1 AND o.restaurant_id=$2
       GROUP BY o.id`,
      [req.params.id, req.user.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CREATE ORDER ──────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const {
    table_id, order_type = 'table', items,
    cgst = 0, sgst = 0,
    discount_pct = 0, discount_fixed = 0,
    delivery_fee = 0,
    customer_name = null, customer_phone = null
  } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ error: 'No items provided' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ids = items.map(i => i.menu_item_id);
    const { rows: menuItems } = await client.query(
      `SELECT id, price FROM menu_items WHERE id = ANY($1) AND restaurant_id=$2`,
      [ids, req.user.restaurant_id]
    );
    const priceMap = Object.fromEntries(menuItems.map(m => [m.id, parseFloat(m.price)]));

    let subtotal = 0;
    const enriched = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id];
      if (!unitPrice) throw new Error(`Item ${item.menu_item_id} not found`);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += lineTotal;
      return { ...item, unit_price: unitPrice, line_total: lineTotal };
    });

    const afterDiscount = subtotal
      - parseFloat(discount_fixed || 0)
      - (subtotal * parseFloat(discount_pct || 0) / 100);
    const cgstAmt  = Math.round(afterDiscount * parseFloat(cgst) / 100 * 100) / 100;
    const sgstAmt  = Math.round(afterDiscount * parseFloat(sgst) / 100 * 100) / 100;
    const grandTotal = Math.ceil(afterDiscount + cgstAmt + sgstAmt + parseFloat(delivery_fee || 0));

    // Get order number INSIDE transaction
    const { rows: numRows } = await client.query(
      `SELECT COALESCE(MAX(
        CASE WHEN order_number ~ '^[0-9]+$'
        THEN CAST(order_number AS INTEGER)
        ELSE 0 END
      ), 0) + 1 AS next
      FROM orders WHERE restaurant_id = $1`,
      [req.user.restaurant_id]
    );
    const orderNumber = String(numRows[0].next);

    const { rows: [order] } = await client.query(
      `INSERT INTO orders
       (order_number, user_id, table_id, order_type, status,
        subtotal, cgst, sgst, discount_pct, discount_fixed,
        delivery_fee, grand_total, customer_name, customer_phone,
        restaurant_id)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [orderNumber, req.user.id, table_id || null, order_type,
       Math.round(subtotal * 100) / 100, cgstAmt, sgstAmt,
       discount_pct, discount_fixed, delivery_fee, grandTotal,
       customer_name, customer_phone, req.user.restaurant_id]
    );

    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menu_item_id, item.quantity, item.unit_price, item.line_total]
      );
    }

    if (table_id) {
      await client.query(
        `UPDATE tables SET status='occupied' WHERE id=$1 AND restaurant_id=$2`,
        [table_id, req.user.restaurant_id]
      );
    }

    await client.query('COMMIT');

    // Auto deduct inventory
    try {
      for (const oi of enriched) {
        const { rows: recipe } = await db.query(
          `SELECT ri.ingredient_id, ri.quantity_used
           FROM recipe_items ri
           WHERE ri.menu_item_id=$1 AND ri.restaurant_id=$2`,
          [oi.menu_item_id, req.user.restaurant_id]
        );
        for (const r of recipe) {
          await db.query(
            `UPDATE ingredients
             SET current_stock = GREATEST(current_stock - $1, 0), updated_at=NOW()
             WHERE id=$2 AND restaurant_id=$3`,
            [Number(r.quantity_used) * Number(oi.quantity), r.ingredient_id, req.user.restaurant_id]
          );
        }
      }
    } catch (invErr) { console.error('Inventory deduction error:', invErr.message); }

    req.app.get('io').emit(`order:new:${req.user.restaurant_id}`, { order, items: enriched });
    res.status(201).json({ order, items: enriched });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ── MARK AS PRINTED ───────────────────────────────────────────
router.post('/:id/print', authMiddleware, async (req, res) => {
  try {
    await db.query(
      `UPDATE orders SET is_printed=true, printed_at=NOW(), status='completed'
       WHERE id=$1 AND restaurant_id=$2`,
      [req.params.id, req.user.restaurant_id]
    );
    const { rows: [order] } = await db.query(
      'SELECT table_id FROM orders WHERE id=$1', [req.params.id]
    );
    if (order?.table_id) {
      await db.query(
        `UPDATE tables SET status='available' WHERE id=$1 AND restaurant_id=$2`,
        [order.table_id, req.user.restaurant_id]
      );
    }
    req.app.get('io').emit(`order:printed:${req.user.restaurant_id}`, { orderId: req.params.id });
    res.json({ message: 'Order completed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CANCEL ORDER ──────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [order] } = await client.query(
      'SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
    if (order.is_printed) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot cancel printed order' }); }

    await client.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1`, [req.params.id]
    );
    if (order.table_id) {
      await client.query(
        `UPDATE tables SET status='available' WHERE id=$1 AND restaurant_id=$2`,
        [order.table_id, req.user.restaurant_id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;