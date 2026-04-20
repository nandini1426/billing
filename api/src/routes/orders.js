const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

async function nextOrderNumber() {
  const { rows } = await db.query('SELECT COUNT(*) FROM orders');
  const count = parseInt(rows[0].count) + 1;
  return `${count}`;
}

const roundTotal = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

// ── CREATE ORDER ──────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const {
    table_id, order_type = 'table', items,
    cgst = 2.5, sgst = 2.5,
    discount_pct = 0, discount_fixed = 0, delivery_fee = 0,
    customer_name = null, customer_phone = null
  } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ error: 'No items provided' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ids = items.map(i => i.menu_item_id);
    const { rows: menuItems } = await client.query(
      'SELECT id, price FROM menu_items WHERE id = ANY($1)', [ids]
    );
    const priceMap = Object.fromEntries(
      menuItems.map(m => [m.id, parseFloat(m.price)])
    );

    let subtotal = 0;
    const enriched = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id];
      if (!unitPrice) throw new Error(`Item ${item.menu_item_id} not found`);
      const lineTotal = round2(unitPrice * item.quantity);
      subtotal += lineTotal;
      return { ...item, unit_price: unitPrice, line_total: lineTotal };
    });

    const afterDiscount = subtotal
      - parseFloat(discount_fixed)
      - (subtotal * parseFloat(discount_pct) / 100);
    const cgstAmt  = round2(afterDiscount * cgst / 100);
    const sgstAmt  = round2(afterDiscount * sgst / 100);
    const grandTotal = roundTotal(
      afterDiscount + cgstAmt + sgstAmt + parseFloat(delivery_fee)
    );

    const orderNumber = await nextOrderNumber();

    const { rows: [order] } = await client.query(
  `INSERT INTO orders
   (order_number, user_id, table_id, order_type, status,
    subtotal, cgst, sgst, discount_pct, discount_fixed,
    delivery_fee, grand_total, customer_name, customer_phone)
   VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13)
   RETURNING *`,
  [orderNumber, req.user.id, table_id || null, order_type,
   round2(subtotal), cgstAmt, sgstAmt,
   discount_pct, discount_fixed, delivery_fee, grandTotal,
   customer_name, customer_phone]
);

    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items
         (order_id, menu_item_id, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menu_item_id, item.quantity, item.unit_price, item.line_total]
      );
    }

    if (table_id) {
      await client.query(
        "UPDATE tables SET status='occupied' WHERE id=$1", [table_id]
      );
    }

    await client.query('COMMIT');
    req.app.get('io').emit('order:new', { order, items: enriched });
    res.status(201).json({ order, items: enriched });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── GET ALL ORDERS ────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { status, order_type } = req.query;
  try {
    let q = `
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
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      q += ` AND o.user_id=$${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND o.status=$${params.length}`;
    }
    if (order_type) {
      params.push(order_type);
      q += ` AND o.order_type=$${params.length}`;
    }
    q += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
       WHERE o.id=$1
       GROUP BY o.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE ORDER ──────────────────────────────────────────────
router.patch('/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    const { rows: [order] } = await db.query(
      'SELECT * FROM orders WHERE id=$1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.is_printed)
      return res.status(400).json({ error: 'Cannot edit a printed order' });

    await db.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2',
      [status, req.params.id]
    );
    req.app.get('io').emit('order:updated', { orderId: req.params.id });
    res.json({ message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MARK AS PRINTED ───────────────────────────────────────────
router.post('/:id/print', authMiddleware, async (req, res) => {
  try {
    await db.query(
      `UPDATE orders
       SET is_printed=true, printed_at=NOW(), status='completed'
       WHERE id=$1`,
      [req.params.id]
    );
    const { rows: [order] } = await db.query(
      'SELECT table_id FROM orders WHERE id=$1', [req.params.id]
    );
    if (order?.table_id) {
      await db.query(
        "UPDATE tables SET status='available' WHERE id=$1",
        [order.table_id]
      );
    }
    req.app.get('io').emit('order:printed', { orderId: req.params.id });
    res.json({ message: 'Order marked as printed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CANCEL ORDER ──────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      'SELECT * FROM orders WHERE id=$1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.is_printed)
      return res.status(400).json({ error: 'Cannot cancel a printed order' });

    await db.query(
      "UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    if (order.table_id) {
      await db.query(
        "UPDATE tables SET status='available' WHERE id=$1",
        [order.table_id]
      );
    }
    req.app.get('io').emit('order:cancelled', { orderId: req.params.id });
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── SEARCH CUSTOMERS ──────────────────────────────────────────
router.get('/customers/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2)
    return res.json([]);

  try {
    const { rows } = await db.query(`
      SELECT
        customer_name,
        customer_phone,
        COUNT(*) AS order_count,
        MAX(created_at) AS last_order
      FROM orders
      WHERE status = 'completed'
        AND (
          customer_name ILIKE $1
          OR customer_phone ILIKE $1
        )
        AND customer_name IS NOT NULL
      GROUP BY customer_name, customer_phone
      ORDER BY last_order DESC
      LIMIT 5
    `, [`%${q}%`]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;