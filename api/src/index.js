process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

console.log('🚀 Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

db.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });

global.db = db;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true
  }
});

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Health check first — before routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Routes
try {
  const authRoutes       = require('./routes/auth');
  const menuRoutes       = require('./routes/menu');
  const tableRoutes      = require('./routes/tables');
  const orderRoutes      = require('./routes/orders');
  const analyticsRoutes  = require('./routes/analytics');
  const settingsRoutes   = require('./routes/settings');
  const restaurantRoutes = require('./routes/restaurants');

  app.use('/api/auth',        authRoutes);
  app.use('/api/menu',        menuRoutes);
  app.use('/api/tables',      tableRoutes);
  app.use('/api/orders',      orderRoutes);
  app.use('/api/analytics',   analyticsRoutes);
  app.use('/api/settings',    settingsRoutes);
  app.use('/api/restaurants', restaurantRoutes);

  console.log('✅ All routes loaded');
} catch (err) {
  console.error('❌ Route loading error:', err.message);
  console.error(err.stack);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join:table', (tableId) => socket.join(`table:${tableId}`));
  socket.on('disconnect', () => console.log('Disconnected:', socket.id));
});

app.set('io', io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API running at http://0.0.0.0:${PORT}`);
});