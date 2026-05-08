// backend/routes/formulas.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

// ── GET /api/formulas ────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql, params = [];
    if (req.user.rol === 'paciente') {
      sql = `
        SELECT f.*,
          COALESCE(json_agg(
            json_build_object('nombre',fm.nombre,'dosis',fm.dosis,'duracion',fm.duracion)
            ORDER BY fm.orden
          ) FILTER (WHERE fm.id IS NOT NULL), '[]') AS medicamentos
        FROM formulas f
        LEFT JOIN formula_medicamentos fm ON fm.formula_id = f.id
        WHERE f.paciente_id = $1
        GROUP BY f.id ORDER BY f.creado_en DESC`;
      params = [req.user.id];
    } else {
      sql = `
        SELECT f.*,
          up.nombre||' '||up.apellido AS paciente_nombre,
          COALESCE(json_agg(
            json_build_object('nombre',fm.nombre,'dosis',fm.dosis,'duracion',fm.duracion)
            ORDER BY fm.orden
          ) FILTER (WHERE fm.id IS NOT NULL), '[]') AS medicamentos
        FROM formulas f
        LEFT JOIN formula_medicamentos fm ON fm.formula_id = f.id
        LEFT JOIN usuarios up ON up.id = f.paciente_id
        GROUP BY f.id, up.nombre, up.apellido ORDER BY f.creado_en DESC`;
    }
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/formulas ───────────────────────────────────────────
router.post('/', requireAuth, requireRole('medico','admin','superadmin'), async (req, res) => {
  try {
    const { paciente_id, diagnostico, observaciones, tipo_entrega, farmacia, medicamentos } = req.body;
    if (!paciente_id || !diagnostico || !medicamentos?.length)
      return res.status(400).json({ error: 'Datos incompletos' });

    const hash = 'SHA-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);
    const { rows } = await query(
      `INSERT INTO formulas (hash,paciente_id,medico_id,diagnostico,observaciones,tipo_entrega,farmacia,estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente') RETURNING *`,
      [hash, paciente_id, req.user.id, diagnostico, observaciones||'', tipo_entrega||'domicilio', farmacia||'Cruz Verde']
    );
    const formula = rows[0];
    for (let i = 0; i < medicamentos.length; i++) {
      const m = medicamentos[i];
      await query(
        'INSERT INTO formula_medicamentos (formula_id,nombre,dosis,duracion,orden) VALUES ($1,$2,$3,$4,$5)',
        [formula.id, m.nombre, m.dosis||'', m.duracion||'', i+1]
      );
    }
    await query(
      'INSERT INTO notificaciones (user_id,mensaje,tipo) VALUES ($1,$2,$3)',
      [paciente_id, `Nueva fórmula médica ${hash} generada. En preparación.`, 'ok']
    );
    await audit(req, `Fórmula emitida: ${hash} · ${diagnostico}`);
    res.status(201).json({ ...formula, medicamentos });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/formulas/:id/reasignar ────────────────────────────
router.patch('/:id/reasignar', requireAuth, async (req, res) => {
  try {
    const { farmacia } = req.body;
    if (!farmacia) return res.status(400).json({ error: 'Farmacia requerida' });
    const { rows } = await query(
      `UPDATE formulas SET farmacia=$1, estado='en_camino' WHERE id=$2 RETURNING *`,
      [farmacia, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fórmula no encontrada' });
    await query(
      'INSERT INTO notificaciones (user_id,mensaje,tipo) VALUES ($1,$2,$3)',
      [rows[0].paciente_id,
       `Tu pedido fue reasignado a ${farmacia}. Ya está en camino.`, 'info']
    );
    await audit(req, `Fórmula ${rows[0].hash} reasignada a ${farmacia}`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/formulas/:id/despachar ────────────────────────────
router.patch('/:id/despachar', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE formulas SET estado='en_camino' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    await query(
      'INSERT INTO notificaciones (user_id,mensaje,tipo) VALUES ($1,$2,$3)',
      [rows[0].paciente_id,
       `Tu pedido ${rows[0].hash} está en camino desde ${rows[0].farmacia}.`, 'ok']
    );
    await audit(req, `Fórmula ${rows[0].hash} despachada`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/formulas/:id/entregar ────────────────────────────
router.patch('/:id/entregar', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE formulas SET estado='entregado'
       WHERE id=$1 AND (paciente_id=$2 OR $3 IN ('admin','superadmin','farmacia')) RETURNING *`,
      [req.params.id, req.user.id, req.user.rol]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada o sin permisos' });
    await audit(req, `Entrega confirmada: ${rows[0].hash}`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/formulas/:id/rating ──────────────────────────────
router.patch('/:id/rating', requireAuth, async (req, res) => {
  try {
    const { rating, comentario } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating debe ser entre 1 y 5' });
    const { rows } = await query(
      `UPDATE formulas SET rating=$1, rating_comentario=$2
       WHERE id=$3 AND paciente_id=$4 RETURNING *`,
      [rating, comentario||'', req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    await audit(req, `Entrega calificada: ${rows[0].hash} → ${rating}★`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
