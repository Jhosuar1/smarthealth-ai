// backend/middleware/audit.js — Log de auditoría automático
const { query } = require('../config/db');

const audit = async (req, accion, tabla = null) => {
  try {
    const userId  = req.user?.id   || null;
    const nombre  = req.user ? `${req.user.nombre} ${req.user.apellido}` : 'Sistema';
    const ip      = req.ip || req.connection?.remoteAddress || null;
    await query(
      'INSERT INTO auditoria (user_id, user_nombre, accion, tabla, ip) VALUES ($1,$2,$3,$4,$5)',
      [userId, nombre, accion, tabla, ip]
    );
  } catch (err) {
    console.warn('[Audit] No se pudo registrar:', err.message);
  }
};

module.exports = { audit };
