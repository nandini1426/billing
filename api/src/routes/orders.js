const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

async function nextOrderNumber(restaurant_id) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(CAST(order_number AS INTEGER)), 0) + 1 AS next
     FROM orders
     WHERE restaurant_id = $1
     AND order_number ~ '^[0-9]+$'`,
    [restaurant_id]
  );
  return String(rows[0].next);
}

const roundTotal = (n) => Math.ceil(n);
const round2 = (n) => Math.round(n * 100) / 100;

// ── CREATE ORDER ──────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const {
    table_id, order_type = 'table', items,
    cgst = 2.5, sgst = 2.5,
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
      `SELECT id, price FROM menu_items
       WHERE id = ANY($1) AND restaurant_id=$2`,
      [ids, req.user.restaurant_id]
    );
    const priceMap = Object.fromEntries(
      menuItems.map(m => [m.id, parseFloat(m.price)])
    );

    let subtotal = 0;
    const enriched = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id];
      if (!unitPrice) throw new Error(`Item ${item.menu_item_id} not found`);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += lineTotal;
      return { ...item, unit_price: unitPrice, line_total: lineTotal };
    });

    const afterDiscount = subtotal
      - parseFloat(discount_fixed)
      - (subtotal * parseFloat(discount_pct) / 100);
    const cgstAmt  = Math.round(afterDiscount * cgst / 100 * 100) / 100;
    const sgstAmt  = Math.round(afterDiscount * sgst / 100 * 100) / 100;
    const grandTotal = Math.ceil(
      afterDiscount + cgstAmt + sgstAmt + parseFloat(delivery_fee)
    );

    const orderNumber = await nextOrderNumber(req.user.restaurant_id);

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
        `INSERT INTO order_items
         (order_id, menu_item_id, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.id, item.menu_item_id, item.quantity,
         item.unit_price, item.line_total]
      );
    }

    if (table_id) {
      await client.query(
        `UPDATE tables SET status='occupied'
         WHERE id=$1 AND restaurant_id=$2`,
        [table_id, req.user.restaurant_id]
      );
    }

    await client.query('COMMIT');

    // ── Auto deduct inventory stock ──────────────────────────
    try {
      for (const oi of enriched) {
        const { rows: recipe } = await db.query(`
          SELECT ri.ingredient_id, ri.quantity_used
          FROM recipe_items ri
          WHERE ri.menu_item_id = $1 AND ri.restaurant_id = $2
        `, [oi.menu_item_id, req.user.restaurant_id]);

        for (const r of recipe) {
          const totalUsed = Number(r.quantity_used) * Number(oi.quantity);
          await db.query(`
            UPDATE ingredients
            SET current_stock = GREATEST(current_stock - $1, 0),
                updated_at = NOW()
            WHERE id = $2 AND restaurant_id = $3
          `, [totalUsed, r.ingredient_id, req.user.restaurant_id]);
        }
      }
    } catch (invErr) {
      console.error('Inventory deduction error:', invErr.message);
    }

    req.app.get('io').emit(`order:new:${req.user.restaurant_id}`, { order, items: enriched });
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
  const { status, order_type, date } = req.query;
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
      WHERE o.restaurant_id=$1
    `;
    const params = [req.user.restaurant_id];

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
    if (date) {
      params.push(date);
      q += ` AND o.created_at::date=$${params.length}`;
    }
    q += ' GROUP BY o.id ORDER BY o.created_at DESC';

    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── GET NEXT BILL NUMBER ──────────────────────────────────────
router.get('/next-number', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*) FROM orders WHERE restaurant_id=$1',
      [req.user.restaurant_id]
    );
    const next = parseInt(rows[0].count) + 1;
    res.json({ next_number: String(next) });
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
       WHERE o.id=$1 AND o.restaurant_id=$2
       GROUP BY o.id`,
      [req.params.id, req.user.restaurant_id]
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
      'SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, req.user.restaurant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.is_printed)
      return res.status(400).json({ error: 'Cannot edit a printed order' });

    await db.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2',
      [status, req.params.id]
    );
    req.app.get('io').emit(`order:updated:${req.user.restaurant_id}`, { orderId: req.params.id });
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
       WHERE id=$1 AND restaurant_id=$2`,
      [req.params.id, req.user.restaurant_id]
    );
    const { rows: [order] } = await db.query(
      'SELECT table_id FROM orders WHERE id=$1',
      [req.params.id]
    );
    if (order?.table_id) {
      await db.query(
        `UPDATE tables SET status='available'
         WHERE id=$1 AND restaurant_id=$2`,
        [order.table_id, req.user.restaurant_id]
      );
    }
    req.app.get('io').emit(`order:printed:${req.user.restaurant_id}`, { orderId: req.params.id });
    res.json({ message: 'Order marked as printed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.is_printed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot cancel a printed order' });
    }

    // Cancel the order
    await client.query(
      `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );

    // Always free the table if it has one
    if (order.table_id) {
      await client.query(
        `UPDATE tables SET status='available'
         WHERE id=$1 AND restaurant_id=$2`,
        [order.table_id, req.user.restaurant_id]
      );
      console.log(`✅ Table freed for order ${req.params.id}`);
    }

    await client.query('COMMIT');

    req.app.get('io').emit(
      `order:cancelled:${req.user.restaurant_id}`,
      { orderId: req.params.id }
    );

    res.json({ message: 'Order cancelled and table freed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel order error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// ── PUBLIC BILL VIEW (no auth needed) ─────────────────────────
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUBLIC RESTAURANT SETTINGS ────────────────────────────────
router.get('/public/:id/settings', async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      'SELECT restaurant_id FROM orders WHERE id=$1',
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Not found' });

    const { rows: [settings] } = await db.query(
      'SELECT * FROM restaurant_settings WHERE restaurant_id=$1',
      [order.restaurant_id]
    );
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── SEARCH CUSTOMERS ──────────────────────────────────────────
router.get('/customers/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const { rows } = await db.query(`
      SELECT
        customer_name,
        customer_phone,
        COUNT(*) AS order_count,
        MAX(created_at) AS last_order
      FROM orders
      WHERE status = 'completed'
        AND restaurant_id = $1
        AND (
          customer_name ILIKE $2
          OR customer_phone ILIKE $2
        )
        AND customer_name IS NOT NULL
      GROUP BY customer_name, customer_phone
      ORDER BY last_order DESC
      LIMIT 5
    `, [req.user.restaurant_id, `%${q}%`]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;