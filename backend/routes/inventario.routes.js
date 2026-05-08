// backend/routes/inventario.routes.js
const router = require('express').Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

// GET /api/inventario
router.get('/', requireAuth, async (req, res) => {
  try {
    const { farmacia, q } = req.query;
    let sql = 'SELECT * FROM inventario WHERE activo = TRUE';
    const params = [];
    if (farmacia) { params.push(farmacia); sql += ` AND farmacia = $${params.length}`; }
    if (q) { params.push(`%${q}%`); sql += ` AND (nombre ILIKE $${params.length} OR presentacion ILIKE $${params.length})`; }
    sql += ' ORDER BY farmacia, nombre';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventario/check — Verifica stock de lista de medicamentos
router.post('/check', requireAuth, async (req, res) => {
  try {
    const { medicamentos, farmacia } = req.body; // [{nombre}]
    if (!medicamentos?.length) return res.status(400).json({ error: 'Lista de medicamentos requerida' });

    const FARMACIAS = ['Cruz Verde','Comfamiliar','La Rebaja'];
    const resultado = {};

    for (const farm of FARMACIAS) {
      resultado[farm] = {};
      for (const med of medicamentos) {
        const base = med.nombre.split(' ')[0];
        const { rows } = await query(
          `SELECT stock FROM inventario WHERE nombre ILIKE $1 AND farmacia = $2 AND activo = TRUE LIMIT 1`,
          [`%${base}%`, farm]
        );
        resultado[farm][med.nombre] = rows[0]?.stock || 0;
      }
    }

    // Determinar qué farmacia tiene todo
    const farmaciaOk = FARMACIAS.find(farm =>
      medicamentos.every(med => resultado[farm][med.nombre] > 0)
    );

    res.json({ resultado, farmaciaOk: farmaciaOk || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventario — Agregar medicamento
router.post('/', requireAuth, requireRole('admin','superadmin','farmacia'), async (req, res) => {
  try {
    const { nombre, presentacion, farmacia, stock, stock_min, precio, vencimiento } = req.body;
    if (!nombre || !presentacion || !farmacia) return res.status(400).json({ error: 'Nombre, presentación y farmacia requeridos' });

    const { rows } = await query(
      `INSERT INTO inventario (nombre,presentacion,farmacia,stock,stock_min,precio,vencimiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, presentacion, farmacia, stock||0, stock_min||20, precio||0, vencimiento||null]
    );
    await audit(req, `Inventario: agregado "${nombre}" en ${farmacia}`, 'inventario');
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inventario/:id — Editar
router.put('/:id', requireAuth, requireRole('admin','superadmin','farmacia'), async (req, res) => {
  try {
    const { nombre, presentacion, farmacia, stock, stock_min, precio, vencimiento } = req.body;
    const { rows } = await query(
      `UPDATE inventario SET nombre=$1,presentacion=$2,farmacia=$3,stock=$4,stock_min=$5,precio=$6,vencimiento=$7
       WHERE id=$8 AND activo=TRUE RETURNING *`,
      [nombre, presentacion, farmacia, stock, stock_min, precio, vencimiento||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    await audit(req, `Inventario: actualizado "${nombre}" stock=${stock}`, 'inventario');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/inventario/:id/stock — Ajustar stock
router.patch('/:id/stock', requireAuth, requireRole('admin','superadmin','farmacia'), async (req, res) => {
  try {
    const { delta } = req.body; // número positivo o negativo
    if (delta === undefined) return res.status(400).json({ error: 'delta requerido' });
    const { rows } = await query(
      `UPDATE inventario SET stock = GREATEST(0, stock + $1) WHERE id = $2 AND activo = TRUE RETURNING *`,
      [delta, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    await audit(req, `Stock ajustado: ${rows[0].nombre} → ${rows[0].stock} (${delta>0?'+':''}${delta})`, 'inventario');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inventario/:id — Solo superadmin
router.delete('/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { rows } = await query(
      'UPDATE inventario SET activo = FALSE WHERE id = $1 RETURNING nombre, farmacia',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    await audit(req, `Inventario: eliminado "${rows[0].nombre}" de ${rows[0].farmacia}`, 'inventario');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
