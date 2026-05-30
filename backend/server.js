// backend/server.js — Compatible con Vercel (serverless) y servidor local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnection } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3131;

// ── Middlewares ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — protege contra fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta en 15 minutos.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de login. Intenta en 15 minutos.' }
});
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// ── Rutas API ────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth.routes'));
app.use('/api/citas',          require('./routes/citas.routes'));
app.use('/api/formulas',       require('./routes/formulas.routes'));
app.use('/api/inventario',     require('./routes/inventario.routes'));
app.use('/api/usuarios',       require('./routes/usuarios.routes'));
app.use('/api/notificaciones', require('./routes/notificaciones.routes'));
app.use('/api/auditoria',      require('./routes/auditoria.routes'));
app.use('/api/ia',             require('./routes/ia.routes'));

// ── Health check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  const gemini    = process.env.GEMINI_API_KEY    ? 'configurada ✓' : 'NO configurada ✗';
  const anthropic = process.env.ANTHROPIC_API_KEY ? 'configurada ✓' : 'NO configurada ✗';
  const dbUrl     = process.env.DATABASE_URL      ? 'configurada ✓' : 'NO configurada ✗';
  const jwt       = process.env.JWT_SECRET        ? 'configurada ✓' : 'NO configurada ✗';
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    variables: { GEMINI_API_KEY: gemini, ANTHROPIC_API_KEY: anthropic, DATABASE_URL: dbUrl, JWT_SECRET: jwt },
    ia_mode: process.env.GEMINI_API_KEY ? 'gemini-real' : (process.env.ANTHROPIC_API_KEY ? 'claude-real' : 'simulacion-local'),
    time: new Date().toISOString()
  });
});

// ── Diagnóstico de Base de Datos Neon (Vercel) ───────────
app.get('/api/diagnostico-db', async (req, res) => {
  try {
    const { query } = require('./config/db');
    
    // 1. Verificar fecha y conexión
    const timeRes = await query('SELECT NOW() as tiempo');
    
    // 2. Listar tablas en el esquema public
    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // 3. Inspeccionar estructura de 'formulas'
    let columnsFormulas = [];
    try {
      const colRes = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'formulas'
      `);
      columnsFormulas = colRes.rows;
    } catch (e) {
      columnsFormulas = 'Error al leer columnas de formulas: ' + e.message;
    }

    // 4. Contar filas en tablas principales
    const counts = {};
    for (const row of tablesRes.rows) {
      const name = row.table_name;
      try {
        const countRes = await query(`SELECT COUNT(*) as count FROM "${name}"`);
        counts[name] = parseInt(countRes.rows[0].count, 10);
      } catch (e) {
        counts[name] = 'Error: ' + e.message;
      }
    }

    res.json({
      ok: true,
      mensaje: 'Conexión a Neon PostgreSQL exitosa',
      tiempo_db: timeRes.rows[0].tiempo,
      tablas: tablesRes.rows.map(r => r.table_name),
      conteos: counts,
      columnas_formulas: columnsFormulas
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// ── Frontend estático (solo en modo local) ───────────
// En Vercel, el frontend es servido directamente por @vercel/static (vercel.json).
// Solo activamos esto en desarrollo local para poder correr con `npm start`.
if (process.env.VERCEL !== '1') {
  const frontendPath = path.join(__dirname, '..', 'frontend');
  const fs = require('fs');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    // SPA fallback
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });
  }
}

// ── Arrancar (solo en modo local, no en Vercel serverless) ──
if (process.env.VERCEL !== '1') {
  const start = async () => {
    const dbOk = await testConnection();
    app.listen(PORT, () => {
      console.log('\n┌──────────────────────────────────────────────┐');
      console.log('│        SmartHealth AI — Servidor             │');
      console.log('├──────────────────────────────────────────────┤');
      console.log(`│  URL:  http://localhost:${PORT}                   │`);
      console.log(`│  DB:   ${dbOk ? '✅ PostgreSQL conectado          ' : '❌ Sin BD (verifica .env)         '}│`);
      console.log(`│  IA:   ${process.env.ANTHROPIC_API_KEY ? '✅ Claude API activa             ' : '⚠️  Modo simulado (sin API Key)  '}│`);
      console.log('└──────────────────────────────────────────────┘\n');
    });
  };
  start();
}

// Exportar para Vercel serverless
module.exports = app;
