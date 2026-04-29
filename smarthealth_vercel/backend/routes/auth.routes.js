// backend/routes/auth.routes.js — Login, registro, recuperación
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { query } = require('../config/db');
const { signToken } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query('SELECT * FROM usuarios WHERE email = LOWER($1)', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!user.activo) return res.status(403).json({ error: 'Cuenta suspendida. Contacta al administrador.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);
    await audit({ user, ip: req.ip }, `Login exitoso: ${user.email}`);

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol, avatar: user.avatar, color: user.color }
    });
  } catch (err) {
    console.error('[Auth/login]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol, registro_prof } = req.body;
    if (!nombre || !apellido || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (!['paciente','medico','farmacia'].includes(rol)) return res.status(400).json({ error: 'Rol no permitido en registro público' });

    const existing = await query('SELECT id FROM usuarios WHERE email = LOWER($1)', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    const hash   = await bcrypt.hash(password, 10);
    const avatar = nombre[0].toUpperCase() + apellido[0].toUpperCase();
    const colors = { paciente:'#0057ff', medico:'#8b5cf6', farmacia:'#10b981' };

    const { rows } = await query(
      `INSERT INTO usuarios (nombre,apellido,email,password,rol,avatar,color,registro_prof)
       VALUES ($1,$2,LOWER($3),$4,$5,$6,$7,$8) RETURNING id,nombre,apellido,email,rol,avatar,color`,
      [nombre, apellido, email, hash, rol, avatar, colors[rol]||'#0057ff', registro_prof||null]
    );
    const user = rows[0];
    await audit({ user, ip: req.ip }, `Nuevo usuario registrado: ${user.email} (${rol})`);

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Auth/register]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/recovery — Genera código de recuperación
router.post('/recovery', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const { rows } = await query('SELECT id, nombre FROM usuarios WHERE email = LOWER($1) AND activo = TRUE', [email]);
    if (!rows.length) return res.status(404).json({ error: 'No encontramos una cuenta activa con ese correo' });

    const user = rows[0];
    // Invalidar códigos anteriores
    await query('UPDATE tokens_recuperacion SET usado = TRUE WHERE user_id = $1 AND usado = FALSE', [user.id]);

    const codigo = (Math.random().toString(36).slice(2,4) + '-' + Math.random().toString(36).slice(2,4)).toUpperCase();
    await query(
      'INSERT INTO tokens_recuperacion (user_id, codigo) VALUES ($1, $2)',
      [user.id, codigo]
    );
    await audit({ user, ip: req.ip }, `Código de recuperación generado para: ${email}`);

    // En producción aquí enviarías el email con EmailJS/Nodemailer
    // Por ahora retornamos el código (modo demo)
    res.json({ ok: true, codigo, mensaje: `Código generado para ${user.nombre}. En producción se enviaría al correo.` });
  } catch (err) {
    console.error('[Auth/recovery]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/reset — Cambia la contraseña con el código
router.post('/reset', async (req, res) => {
  try {
    const { email, codigo, newPassword } = req.body;
    if (!email || !codigo || !newPassword) return res.status(400).json({ error: 'Todos los campos requeridos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Contraseña debe tener al menos 6 caracteres' });

    const { rows: userRows } = await query('SELECT id FROM usuarios WHERE email = LOWER($1)', [email]);
    if (!userRows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const userId = userRows[0].id;

    const { rows: tokenRows } = await query(
      `SELECT id FROM tokens_recuperacion
       WHERE user_id = $1 AND codigo = $2 AND usado = FALSE AND expira_en > NOW()`,
      [userId, codigo.toUpperCase()]
    );
    if (!tokenRows.length) return res.status(400).json({ error: 'Código incorrecto o expirado' });

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE usuarios SET password = $1 WHERE id = $2', [hash, userId]);
    await query('UPDATE tokens_recuperacion SET usado = TRUE WHERE id = $1', [tokenRows[0].id]);
    await audit({ user: {id: userId}, ip: req.ip }, `Contraseña restablecida para: ${email}`);

    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('[Auth/reset]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
