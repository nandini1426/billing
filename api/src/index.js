const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true }
});

// ── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ── Routes ───────────────────────────────────────────────────
const authRoutes  = require('./routes/auth');
const menuRoutes  = require('./routes/menu');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes  = require('./routes/settings');

app.use('/api/auth',      authRoutes);
app.use('/api/menu',      menuRoutes);
app.use('/api/tables',    tableRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings',  settingsRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join:table', (tableId) => socket.join(`table:${tableId}`));
  socket.on('disconnect', () => console.log('Disconnected:', socket.id));
});

// Export io so routes can use it
app.set('io', io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});