// backend/config/db.js — Compatible con Vercel + Supabase/Neon/Railway
const { Pool } = require('pg');

// Vercel es serverless: cada invocación puede crear una conexión nueva.
// Supabase recomienda usar el Transaction Pooler (puerto 6543) en serverless.
// La DATABASE_URL debe apuntar al pooler de Supabase para evitar "too many connections".
// Ejemplo URL Supabase pooler: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // requerido por Supabase/Neon
    // En Vercel serverless: pool pequeño para no agotar conexiones
    max: isProduction ? 3 : 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
} else {
  pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'smarthealth',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

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
