// backend/middleware/auth.js — Verificación de JWT
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthealth_dev_secret_cambiar_en_produccion';

// Verifica el token JWT en cada request protegido
const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    // Verificar que el usuario siga activo en la BD
    const { rows } = await query('SELECT id, nombre, apellido, rol, activo FROM usuarios WHERE id = $1', [payload.id]);
    if (!rows.length || !rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o suspendido' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado' });
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Solo permite ciertos roles
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!roles.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permisos para esta acción' });
  next();
};

// Genera un token JWT
const signToken = (user) => jwt.sign(
  { id: user.id, rol: user.rol, nombre: user.nombre },
  JWT_SECRET,
  { expiresIn: '8h' }
);

module.exports = { requireAuth, requireRole, signToken };
