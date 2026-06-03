// backend/routes/ia.routes.js
// IA siempre real — OpenAI con reintentos, sin modo local
const router  = require('express').Router();
const https   = require('https');
const { requireAuth } = require('../middleware/auth');

const OPENAI_MODEL        = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

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
  const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
  const { prompt, max_tokens } = req.body;
  if (!prompt) return res.status(400).json({ text: 'Falta el prompt.' });

  if (!OPENAI_KEY) {
    return res.status(503).json({
      text: 'IA no configurada. Agrega OPENAI_API_KEY en las variables de entorno.',
      source: 'error'
    });
  }

  // 3 intentos con espera exponencial
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const text = await tryOpenAI(prompt, max_tokens || 800, OPENAI_KEY);
      return res.json({ text, source: 'openai' });
    } catch (err) {
      console.warn(`[IA] OpenAI intento ${intento}/3 falló:`, err.message);
      if (intento < 3) {
        // Espera 1s entre reintentos (sin bloquear más tiempo)
        await new Promise(r => setTimeout(r, 1000 * intento));
      } else {
        // Los 3 intentos fallaron — devolver error descriptivo al frontend
        return res.status(502).json({
          text: `Error al conectar con OpenAI después de 3 intentos: ${err.message}`,
          source: 'error'
        });
      }
    }
  }
});

// ── POST /api/ia/vision ── Análisis de imágenes/PDFs ─────────────
router.post('/vision', requireAuth, async (req, res) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
  const { prompt, imageBase64, mimeType, max_tokens } = req.body;

  if (!prompt || !imageBase64) {
    return res.status(400).json({ text: 'Faltan datos requeridos (prompt e imageBase64).' });
  }
  if (!OPENAI_KEY) {
    return res.status(503).json({
      text: 'Análisis de imágenes requiere OPENAI_API_KEY configurado en las variables de entorno.',
      source: 'error'
    });
  }

  const validMime = ['image/jpeg','image/png','image/webp','image/gif'];
  const safeMime  = validMime.includes(mimeType) ? mimeType : 'image/jpeg';

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const text = await tryOpenAIVision(prompt, imageBase64, safeMime, max_tokens || 1200, OPENAI_KEY);
      return res.json({ text, source: 'openai-vision' });
    } catch (err) {
      console.warn(`[Vision] OpenAI intento ${intento}/2 falló:`, err.message);
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
  const openai = !!process.env.OPENAI_API_KEY;
  res.json({
    status: 'ok',
    mode: openai ? 'openai' : 'sin_configurar',
    openai_configured: openai,
    timestamp: new Date().toISOString()
  });
});

// ── Helper genérico para llamar a la API de OpenAI ────────────────
function callOpenAI(payload, maxTokens, apiKey, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'api.openai.com', port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const apiReq = https.request(opts, apiRes => {
      let raw = '';
      apiRes.on('data', c => raw += c);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) return reject(new Error(label + ': ' + parsed.error.message));
          const text = parsed.choices?.[0]?.message?.content;
          if (!text) return reject(new Error(label + ': respuesta vacía'));
          resolve(text.trim());
        } catch (e) { reject(new Error(label + ': error al parsear respuesta')); }
      });
    });
    apiReq.on('error', err => reject(new Error(label + ': error de red — ' + err.message)));
    apiReq.setTimeout(timeoutMs, () => { apiReq.destroy(); reject(new Error(label + `: timeout (${timeoutMs/1000}s)`)); });
    apiReq.write(body);
    apiReq.end();
  });
}

// ── OpenAI text helper ────────────────────────────────────────────
function tryOpenAI(prompt, maxTokens, apiKey) {
  return callOpenAI({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_MESSAGE },
      { role: 'user',   content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.4,
    top_p: 0.9
  }, maxTokens, apiKey, 28000, 'OpenAI');
}

// ── OpenAI vision helper ──────────────────────────────────────────
function tryOpenAIVision(prompt, imageBase64, mimeType, maxTokens, apiKey) {
  return callOpenAI({
    model: OPENAI_VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_MESSAGE },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
        ]
      }
    ],
    max_tokens: maxTokens,
    temperature: 0.3
  }, maxTokens, apiKey, 45000, 'Vision');
}

module.exports = router;
