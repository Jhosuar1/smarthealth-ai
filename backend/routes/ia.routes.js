// backend/routes/ia.routes.js
// IA siempre real — Gemini con reintentos, sin modo local
const router  = require('express').Router();
const https   = require('https');
const { requireAuth } = require('../middleware/auth');

const SYSTEM_MESSAGE = `Eres el asistente clínico IA de SmartHealth AI, sistema de gestión en salud de Pereira, Colombia.
Tienes conocimiento profundo en medicina general, farmacología, CIE-10 y guías clínicas colombianas (Minsalud).
Reglas:
- Responde SIEMPRE en español, de forma concisa, clara y profesional
- Para medicamentos incluye: indicación, dosis usual y advertencias clave
- Para síntomas usa: PRIORIDAD: [Crítica/Alta/Media/Baja] + tiempo de atención + justificación
- Para diagnósticos usa código CIE-10 cuando aplique
- Nunca reemplazas la consulta médica presencial
- Si la pregunta no es médica, responde amablemente desde el contexto del sistema SmartHealth AI`;

// ── POST /api/ia/claude ───────────────────────────────────────────
router.post('/claude', requireAuth, async (req, res) => {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
  const { prompt, max_tokens } = req.body;
  if (!prompt) return res.status(400).json({ text: 'Falta el prompt.' });

  if (!GEMINI_KEY) {
    return res.status(503).json({
      text: 'IA no configurada. Agrega GEMINI_API_KEY en las variables de entorno de Vercel.',
      source: 'error'
    });
  }

  // 3 intentos con espera exponencial
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const text = await tryGemini(prompt, max_tokens || 800, GEMINI_KEY);
      return res.json({ text, source: 'gemini' });
    } catch (err) {
      console.warn(`[IA] Gemini intento ${intento}/3 falló:`, err.message);
      if (intento < 3) {
        // Espera 1s entre reintentos (sin bloquear más tiempo)
        await new Promise(r => setTimeout(r, 1000 * intento));
      } else {
        // Los 3 intentos fallaron — devolver error descriptivo al frontend
        return res.status(502).json({
          text: `Error al conectar con Gemini después de 3 intentos: ${err.message}`,
          source: 'error'
        });
      }
    }
  }
});

// ── POST /api/ia/vision ── Análisis de imágenes/PDFs ─────────────
router.post('/vision', requireAuth, async (req, res) => {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
  const { prompt, imageBase64, mimeType, max_tokens } = req.body;

  if (!prompt || !imageBase64) {
    return res.status(400).json({ text: 'Faltan datos requeridos (prompt e imageBase64).' });
  }
  if (!GEMINI_KEY) {
    return res.status(503).json({
      text: 'Análisis de imágenes requiere GEMINI_API_KEY configurado en Vercel → Settings → Environment Variables.',
      source: 'error'
    });
  }

  const validMime = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
  const safeMime  = validMime.includes(mimeType) ? mimeType : 'image/jpeg';

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const text = await tryGeminiVision(prompt, imageBase64, safeMime, max_tokens || 1200, GEMINI_KEY);
      return res.json({ text, source: 'gemini-vision' });
    } catch (err) {
      console.warn(`[Vision] Gemini intento ${intento}/2 falló:`, err.message);
      if (intento < 2) {
        await new Promise(r => setTimeout(r, 1500));
      } else {
        return res.status(502).json({
          text: 'No se pudo analizar la imagen. Verifica que sea clara y menor a 5MB.',
          source: 'error'
        });
      }
    }
  }
});

// ── GET /api/ia/ping ── Estado sin auth ──────────────────────────
router.get('/ping', (req, res) => {
  const gemini = !!process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    mode: gemini ? 'gemini' : 'sin_configurar',
    gemini_configured: gemini,
    timestamp: new Date().toISOString()
  });
});

// ── Gemini text helper ────────────────────────────────────────────
function tryGemini(prompt, maxTokens, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_MESSAGE }] },
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.4,
        topP: 0.9
      }
    });
    const opts = {
      hostname: 'generativelanguage.googleapis.com', port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, apiRes => {
      let raw = '';
      apiRes.on('data', c => raw += c);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return reject(new Error('Gemini: ' + parsed.error.message));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Gemini: respuesta vacía'));
          const finish = parsed.candidates?.[0]?.finishReason;
          if (finish === 'SAFETY') return reject(new Error('Gemini: bloqueado por política de seguridad'));
          resolve(text);
        } catch (e) { reject(new Error('Gemini: error al parsear respuesta')); }
      });
    });
    req.on('error', err => reject(new Error('Gemini: error de red — ' + err.message)));
    req.setTimeout(28000, () => { req.destroy(); reject(new Error('Gemini: timeout (28s)')); });
    req.write(body);
    req.end();
  });
}

// ── Gemini vision helper ──────────────────────────────────────────
function tryGeminiVision(prompt, imageBase64, mimeType, maxTokens, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      }],
      systemInstruction: { parts: [{ text: SYSTEM_MESSAGE }] },
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 }
    });
    const opts = {
      hostname: 'generativelanguage.googleapis.com', port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, apiRes => {
      let raw = '';
      apiRes.on('data', c => raw += c);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return reject(new Error('Vision: ' + parsed.error.message));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Vision: respuesta vacía'));
          resolve(text);
        } catch (e) { reject(new Error('Vision: error al parsear')); }
      });
    });
    req.on('error', err => reject(new Error('Vision: error de red — ' + err.message)));
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Vision: timeout (45s)')); });
    req.write(body);
    req.end();
  });
}

module.exports = router;
