// backend/config/db.js — Compatible con Vercel + Neon/Supabase
const { Pool } = require('pg');

// Vercel usa DATABASE_URL (Neon, Supabase, Railway)
// Local usa variables individuales
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // requerido por Neon/Supabase
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'smarthealth',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  console.error('[DB] Error en pool:', err.message);
});

const query = (text, params) => pool.query(text, params);

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as tiempo');
    console.log('[DB] PostgreSQL conectado:', res.rows[0].tiempo);
    return true;
  } catch (err) {
    console.error('[DB] Error de conexión:', err.message);
    return false;
  }
};

module.exports = { pool, query, testConnection };
