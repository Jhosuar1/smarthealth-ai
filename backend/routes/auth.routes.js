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
    const { nombre, apellido, email, password, rol, registro_prof, habeas_consent } = req.body;
    if (!nombre || !apellido || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (!['paciente','medico','farmacia'].includes(rol)) return res.status(400).json({ error: 'Rol no permitido en registro público' });

    const existing = await query('SELECT id FROM usuarios WHERE email = LOWER($1)', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    const hash   = await bcrypt.hash(password, 10);
    const avatar = nombre[0].toUpperCase() + apellido[0].toUpperCase();
    const colors = { paciente:'#0057ff', medico:'#8b5cf6', farmacia:'#10b981' };

    const consentVal = habeas_consent !== undefined ? habeas_consent : true;

    const { rows } = await query(
      `INSERT INTO usuarios (nombre,apellido,email,password,rol,avatar,color,registro_prof,habeas_consent,habeas_fecha)
       VALUES ($1,$2,LOWER($3),$4,$5,$6,$7,$8,$9,NOW()) RETURNING id,nombre,apellido,email,rol,avatar,color`,
      [nombre, apellido, email, hash, rol, avatar, colors[rol]||'#0057ff', registro_prof||null, consentVal]
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

// POST /api/auth/recovery — Código de recuperación enviado al correo real
router.post('/recovery', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const { rows } = await query(
      'SELECT id, nombre FROM usuarios WHERE email = LOWER($1) AND activo = TRUE',
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontramos una cuenta activa con ese correo' });

    const user = rows[0];
    await query('UPDATE tokens_recuperacion SET usado = TRUE WHERE user_id = $1 AND usado = FALSE', [user.id]);

    // Código formato: AB-12 (fácil de escribir en móvil)
    const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '0123456789';
    const codigo = [0,1].map(() => chars[Math.floor(Math.random()*chars.length)]).join('') + '-' +
                   [0,1].map(() => digits[Math.floor(Math.random()*10)]).join('');

    await query('INSERT INTO tokens_recuperacion (user_id, codigo) VALUES ($1, $2)', [user.id, codigo]);
    await audit({ user, ip: req.ip }, `Recuperación de contraseña solicitada: ${email}`);

    const RESEND_KEY = process.env.RESEND_API_KEY || '';

    if (RESEND_KEY) {
      // ── Enviar email real con Resend (funciona para CUALQUIER correo) ──
      try {
        const https = require('https');
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:16px">
            <div style="background:linear-gradient(135deg,#0057ff,#0040b8);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
              <div style="font-size:32px;margin-bottom:8px">🏥</div>
              <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">SmartHealth AI</h1>
              <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">Sistema Integral de Gestión en Salud · Pereira</p>
            </div>
            <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
              <p style="color:#334155;font-size:15px;margin-top:0">Hola, <strong>${user.nombre}</strong> 👋</p>
              <p style="color:#64748b;font-size:14px;line-height:1.6">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa este código:</p>
              <div style="text-align:center;margin:24px 0">
                <div style="display:inline-block;background:#eff6ff;border:2px solid #2563eb;border-radius:12px;padding:18px 40px">
                  <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:900;color:#1d4ed8;letter-spacing:8px">${codigo}</span>
                </div>
              </div>
              <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:16px 0">
                <p style="margin:0;font-size:13px;color:#92400e">⏰ Este código expira en <strong>30 minutos</strong>. Solo funciona una vez.</p>
              </div>
              <p style="color:#94a3b8;font-size:12px;margin-bottom:0">Si no solicitaste este cambio, ignora este mensaje. Tu cuenta está segura.</p>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">SmartHealth AI · Pereira, Colombia · Este es un correo automático</p>
          </div>`;

        const payload = JSON.stringify({
          from: 'SmartHealth AI <noreply@smarthealth-ai.app>',
          to:   [email],
          subject: `🔐 Tu código de recuperación: ${codigo}`,
          html:  emailHtml
        });

        await new Promise((resolve, reject) => {
          const reqR = https.request({
            hostname: 'api.resend.com', port: 443, path: '/emails', method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          }, resR => {
            let raw = '';
            resR.on('data', c => raw += c);
            resR.on('end', () => {
              const parsed = JSON.parse(raw);
              if (parsed.id) resolve(parsed);
              else reject(new Error(parsed.message || 'Resend error: ' + raw));
            });
          });
          reqR.on('error', reject);
          reqR.setTimeout(15000, () => { reqR.destroy(); reject(new Error('Resend timeout')); });
          reqR.write(payload);
          reqR.end();
        });

        return res.json({ ok: true, mensaje: `Código enviado a ${email}. Revisa tu bandeja de entrada o spam.` });
      } catch (mailErr) {
        console.error('[Email/Resend]', mailErr.message);
        // Si falla el envío, devolver el código de todas formas (modo demo)
        return res.json({ ok: true, codigo, mensaje: `No se pudo enviar el email (${mailErr.message}). Tu código es:` });
      }
    }

    // Sin RESEND_API_KEY: modo demo — devolver código en respuesta
    res.json({ ok: true, codigo, mensaje: `Código generado para ${user.nombre}` });
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
