// backend/server.js — Compatible con Vercel y servidor local
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { testConnection } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3131;

// ── Middlewares ───────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

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
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    ia: process.env.ANTHROPIC_API_KEY ? 'real' : 'simulada',
    time: new Date().toISOString()
  });
});

// ── Frontend estático ────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

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
