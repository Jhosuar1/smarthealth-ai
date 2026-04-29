// backend/routes/notificaciones.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM notificaciones WHERE user_id = $1 ORDER BY creado_en DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/leer', requireAuth, async (req, res) => {
  try {
    await query('UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/leer-todas', requireAuth, async (req, res) => {
  try {
    await query('UPDATE notificaciones SET leida = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
