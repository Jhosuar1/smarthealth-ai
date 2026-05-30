// backend/routes/citas.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

// GET /api/citas — Citas del paciente actual (o todas si es médico/admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql, params;
    if (req.user.rol === 'paciente') {
      sql = 'SELECT * FROM citas WHERE paciente_id = $1 ORDER BY fecha DESC, hora DESC';
      params = [req.user.id];
    } else {
      sql = 'SELECT c.*, u.nombre||chr(32)||u.apellido AS paciente_nombre FROM citas c JOIN usuarios u ON u.id = c.paciente_id ORDER BY c.fecha DESC, c.hora ASC';
      params = [];
    }
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/citas — Crear nueva cita
router.post('/', requireAuth, requireRole('paciente'), async (req, res) => {
  try {
    const { medico_nom, especialidad, centro, fecha, hora, modalidad, prioridad, motivo } = req.body;
    if (!especialidad || !centro || !fecha || !hora || !motivo) return res.status(400).json({ error: 'Campos incompletos' });

    const { rows } = await query(
      `INSERT INTO citas (paciente_id,medico_nom,especialidad,centro,fecha,hora,modalidad,prioridad,motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, medico_nom||'Dr. Carlos Mejía', especialidad, centro, fecha, hora, modalidad||'Presencial', prioridad||'media', motivo]
    );

    // Notificación automática
    await query('INSERT INTO notificaciones (user_id,mensaje,tipo) VALUES ($1,$2,$3)',
      [req.user.id, `Cita confirmada: ${especialidad} para el ${fecha} a las ${hora}`, 'ok']);

    await audit(req, `Cita agendada: ${especialidad} · ${fecha} · Prioridad: ${prioridad}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/citas/:id/cancelar
router.patch('/:id/cancelar', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE citas SET estado = 'cancelada' WHERE id = $1 AND (paciente_id = $2 OR $3 IN ('admin','superadmin','medico')) RETURNING *`,
      [req.params.id, req.user.id, req.user.rol]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cita no encontrada o sin permisos' });
    await audit(req, `Cita cancelada: ${rows[0].especialidad} · ${rows[0].fecha}`);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
