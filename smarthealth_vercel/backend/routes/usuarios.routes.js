// backend/routes/usuarios.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

// GET /api/usuarios — Solo admin/superadmin
router.get('/', requireAuth, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id,nombre,apellido,email,rol,avatar,color,activo,creado_en,ultimo_login FROM usuarios ORDER BY creado_en DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usuarios/me — Perfil propio
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id,nombre,apellido,email,rol,avatar,color,activo FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/usuarios/:id/toggle — Suspender/Activar
router.patch('/:id/toggle', requireAuth, requireRole('admin','superadmin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes suspenderte a ti mismo' });
    const { rows } = await query(
      'UPDATE usuarios SET activo = NOT activo WHERE id = $1 RETURNING id,nombre,apellido,activo',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    await audit(req, `Usuario ${rows[0].nombre} ${rows[0].apellido} ${rows[0].activo?'activado':'suspendido'}`);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:id — Solo admin/superadmin (no a sí mismo)
router.delete('/:id', requireAuth, requireRole('admin','superadmin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    const { rows } = await query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING nombre, apellido, email',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    await audit(req, `Usuario eliminado: ${rows[0].nombre} ${rows[0].apellido} (${rows[0].email})`);
    res.json({ ok: true, eliminado: `${rows[0].nombre} ${rows[0].apellido}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
