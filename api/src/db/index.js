const { Pool } = require('pg');

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

db.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

db.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err.message);
});

module.exports = db;