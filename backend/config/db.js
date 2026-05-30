// backend/config/db.js — Compatible con Vercel + Supabase/Neon/Railway
const { Pool } = require('pg');

// Vercel es serverless: cada invocación puede crear una conexión nueva.
// Supabase recomienda usar el Transaction Pooler (puerto 6543) en serverless.
// La DATABASE_URL debe apuntar al pooler de Supabase para evitar "too many connections".
// Ejemplo URL Supabase pooler: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

let pool;

if (process.env.DATABASE_URL) {
  // Limpiar parámetros incompatibles con la librería pg (channel_binding no es soportado)
  let cleanUrl = process.env.DATABASE_URL;
  cleanUrl = cleanUrl.replace(/[&?]channel_binding=[^&]*/g, '');
  
  pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false }, // requerido por Neon
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

const schemaSql = require('./schemaSql');

// Auto-migración ejecutada de manera asíncrona al importar el módulo (para Vercel Serverless + Neon)
const initDb = async () => {
  try {
    // 1. Verificar si la tabla usuarios existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'usuarios'
      );
    `);
    
    const exists = tableCheck.rows[0].exists;
    if (!exists) {
      console.log('[DB] Inicializando base de datos vacía...');
      // Ejecutar el script completo de inicialización desde el módulo JS garantizado
      await pool.query(schemaSql);
      console.log('[DB] Base de datos inicializada correctamente con schema.sql.');
    } else {
      console.log('[DB] Tabla usuarios existente.');
    }

    // 2. Auto-migración Habeas Data
    await pool.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS habeas_consent BOOLEAN DEFAULT TRUE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS habeas_fecha TIMESTAMP DEFAULT NOW();
    `);

    // 3. Ampliar el CHECK constraint de fórmulas si existe la tabla
    await pool.query(`
      ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_estado_check;
      ALTER TABLE formulas ADD CONSTRAINT formulas_estado_check
        CHECK (estado IN ('pendiente','preparando','en_camino','entregado','cancelado'));
    `);

    console.log('[DB] Auto-migración Habeas Data y estados de fórmulas verificada.');
  } catch (err) {
    console.error('[DB] Nota de auto-migración:', err.message);
  }
};
initDb();

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
