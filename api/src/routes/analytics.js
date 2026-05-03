const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── SUMMARY ───────────────────────────────────────────────────
router.get('/summary', authMiddleware, async (req, res) => {
  const { period = 'today' } = req.query;
  const intervals = { today: '1 day', week: '7 days', month: '30 days' };
  const interval = intervals[period] || '1 day';
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)                                            AS total_orders,
        COALESCE(SUM(grand_total), 0)                      AS total_revenue,
        COALESCE(AVG(grand_total), 0)                      AS avg_bill,
        COUNT(*) FILTER (WHERE order_type='table')         AS table_orders,
        COUNT(*) FILTER (WHERE order_type='takeaway')      AS takeaway_orders,
        COUNT(*) FILTER (WHERE order_type='delivery')      AS delivery_orders,
        COUNT(*) FILTER (WHERE order_type='fast')          AS fast_orders
      FROM orders
      WHERE status = 'completed'
        AND restaurant_id = $1
        AND created_at > NOW() - INTERVAL '${interval}'
    `, [req.user.restaurant_id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DAILY SALES ────────────────────────────────────────────────
router.get('/daily', authMiddleware, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  try {
    const { rows } = await db.query(`
      SELECT
        created_at::date              AS date,
        COUNT(*)                      AS orders,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM orders
      WHERE status = 'completed'
        AND restaurant_id = $1
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY date
      ORDER BY date ASC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CATEGORY SALES ─────────────────────────────────────────────
router.get('/categories', authMiddleware, async (req, res) => {
  const { period = 'month' } = req.query;
  const intervals = { today: '1 day', week: '7 days', month: '30 days' };
  const interval = intervals[period] || '30 days';
  try {
    const { rows } = await db.query(`
      SELECT
        c.name             AS category,
        SUM(oi.quantity)   AS qty_sold,
        SUM(oi.line_total) AS revenue
      FROM order_items oi
      JOIN menu_items m  ON m.id = oi.menu_item_id
      JOIN categories c  ON c.id = m.category_id
      JOIN orders o      ON o.id = oi.order_id
      WHERE o.status = 'completed'
        AND o.restaurant_id = $1
        AND o.created_at > NOW() - INTERVAL '${interval}'
      GROUP BY c.name
      ORDER BY revenue DESC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TOP ITEMS ──────────────────────────────────────────────────
router.get('/top-items', authMiddleware, async (req, res) => {
  const { period = 'month' } = req.query;
  const intervals = { today: '1 day', week: '7 days', month: '30 days' };
  const interval = intervals[period] || '30 days';
  try {
    const { rows } = await db.query(`
      SELECT
        m.name             AS item,
        c.name             AS category,
        SUM(oi.quantity)   AS qty_sold,
        SUM(oi.line_total) AS revenue
      FROM order_items oi
      JOIN menu_items m  ON m.id = oi.menu_item_id
      JOIN categories c  ON c.id = m.category_id
      JOIN orders o      ON o.id = oi.order_id
      WHERE o.status = 'completed'
        AND o.restaurant_id = $1
        AND o.created_at > NOW() - INTERVAL '${interval}'
      GROUP BY m.name, c.name
      ORDER BY qty_sold DESC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DAY OF WEEK ────────────────────────────────────────────────
router.get('/day-of-week', authMiddleware, async (req, res) => {
  const { period = 'month' } = req.query;
  const intervals = { today: '1 day', week: '7 days', month: '30 days' };
  const interval = intervals[period] || '30 days';
  try {
    const { rows } = await db.query(`
      SELECT
        TO_CHAR(created_at, 'Day')    AS day_name,
        EXTRACT(DOW FROM created_at)  AS day_num,
        COUNT(*)                      AS orders,
        COALESCE(SUM(grand_total), 0) AS revenue,
        COALESCE(AVG(grand_total), 0) AS avg_bill
      FROM orders
      WHERE status = 'completed'
        AND restaurant_id = $1
        AND created_at > NOW() - INTERVAL '${interval}'
      GROUP BY day_name, day_num
      ORDER BY day_num ASC
    `, [req.user.restaurant_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// ── AI SUGGESTIONS ─────────────────────────────────────────────
router.post('/ai-suggestions', authMiddleware, async (req, res) => {
  const { messages, system } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;