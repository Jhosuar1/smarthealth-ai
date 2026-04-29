// backend/routes/auditoria.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM auditoria ORDER BY creado_en DESC LIMIT 200');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/limpiar', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    await query('DELETE FROM auditoria');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
