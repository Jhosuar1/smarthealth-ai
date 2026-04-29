// backend/routes/ia.routes.js — Proxy a Claude API
const router  = require('express').Router();
const https   = require('https');
const { requireAuth } = require('../middleware/auth');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';

router.post('/claude', requireAuth, (req, res) => {
  const { prompt, max_tokens } = req.body;
  if (!prompt) return res.status(400).json({ text: 'Falta el prompt.' });

  if (!API_KEY) {
    return res.json({ text: respuestaSimulada(prompt) });
  }

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const opts = {
    hostname: 'api.anthropic.com', port: 443, path: '/v1/messages', method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
      'x-api-key': API_KEY, 'anthropic-version': '2023-06-01'
    }
  };

  const apiReq = https.request(opts, apiRes => {
    let raw = '';
    apiRes.on('data', c => raw += c);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error) return res.json({ text: 'Error API: ' + parsed.error.message });
        res.json({ text: parsed.content?.[0]?.text || 'Sin respuesta.' });
      } catch { res.status(500).json({ text: 'Error interno.' }); }
    });
  });
  apiReq.on('error', err => res.status(500).json({ text: 'Error: ' + err.message }));
  apiReq.setTimeout(30000, () => { apiReq.destroy(); res.status(504).json({ text: 'Timeout.' }); });
  apiReq.write(body);
  apiReq.end();
});

function respuestaSimulada(p) {
  const t = p.toLowerCase();
  if (t.includes('pecho') || t.includes('respirar')) return 'PRIORIDAD: Crítica\nAtención inmediata — urgencias.\nSíntomas cardiovasculares o respiratorios.';
  if (t.includes('prioridad') || t.includes('síntoma') || t.includes('dolor')) {
    if (t.includes('control') || t.includes('diabetes') || t.includes('hta')) return 'PRIORIDAD: Media\nAtención en 48-72 horas.\nControl de patología crónica estable.';
    return 'PRIORIDAD: Baja\nAtención hasta 7 días.\nSíntomas sin urgencia clínica inmediata.';
  }
  if (t.includes('losartan') || t.includes('losartán')) return 'Losartán (ARA II): tratamiento de HTA. Vigilar hiperpotasemia. Contraindicado en embarazo.';
  if (t.includes('metformina')) return 'Metformina: antidiabético primera línea DM2. Siempre con alimentos. Contraindicado TFG<30.';
  return 'SmartHealth AI: recibí tu consulta. Configura ANTHROPIC_API_KEY en .env para respuestas con IA real.';
}

module.exports = router;
