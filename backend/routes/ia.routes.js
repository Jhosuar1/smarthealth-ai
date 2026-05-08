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
    max_tokens: max_tokens || 600,
    system: 'Eres el asistente clínico IA de SmartHealth AI, un sistema de gestión en salud de Pereira, Colombia. Tienes conocimiento en medicina general, farmacología, CIE-10 y guías clínicas colombianas. Responde siempre en español, de forma concisa, clara y profesional. Cuando des prioridades clínicas usa el formato: PRIORIDAD: [Crítica/Alta/Media/Baja]. Cuando hables de medicamentos incluye indicación, dosis usual y advertencias clave. Nunca reemplazas la consulta médica presencial.',
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

  // ── Priorización clínica ──────────────────────────────────────
  if (t.includes('prioridad') || t.includes('síntoma') || t.includes('evalua')) {
    if (t.includes('pecho') || t.includes('infarto') || t.includes('respirar') || t.includes('desmay') || t.includes('convuls'))
      return 'PRIORIDAD: Crítica\nTiempo de atención: Inmediato (< 15 min)\nJustificación clínica: Síntomas sugestivos de emergencia cardiovascular o neurológica. Activar código de urgencias.';
    if (t.includes('fiebre alta') || t.includes('39') || t.includes('40') || t.includes('vomit') && t.includes('dolor') || t.includes('fractura') || t.includes('sangr'))
      return 'PRIORIDAD: Alta\nTiempo de atención: < 2 horas\nJustificación clínica: Cuadro agudo con riesgo de deterioro. Requiere evaluación médica urgente.';
    if (t.includes('control') || t.includes('diabetes') || t.includes('hta') || t.includes('hipertens') || t.includes('cronic'))
      return 'PRIORIDAD: Media\nTiempo de atención: 24–72 horas\nJustificación clínica: Control de patología crónica estable. Sin signos de descompensación aguda.';
    if (t.includes('gripa') || t.includes('resfri') || t.includes('leve') || t.includes('malestar') || t.includes('tos sin'))
      return 'PRIORIDAD: Baja\nTiempo de atención: Hasta 7 días\nJustificación clínica: Síntomas leves sin criterios de urgencia. Manejo ambulatorio.';
    return 'PRIORIDAD: Media\nTiempo de atención: 48 horas\nJustificación clínica: Síntomas inespecíficos que requieren evaluación médica sin urgencia inmediata.';
  }

  // ── Medicamentos ──────────────────────────────────────────────
  if (t.includes('losartan') || t.includes('losartán'))
    return '💊 Losartán Potásico (ARA II)\n• Indicación: Hipertensión arterial, nefropatía diabética\n• Dosis usual: 50–100 mg/día\n• Advertencias: Vigilar hiperpotasemia, creatinina y TA. Contraindicado en embarazo (Cat. D).\n• Interacciones: AINEs reducen efecto. Suplementos de potasio con precaución.';
  if (t.includes('metformina'))
    return '💊 Metformina (Biguanida)\n• Indicación: Diabetes mellitus tipo 2, primera línea\n• Dosis usual: 500–2550 mg/día con alimentos\n• Advertencias: Contraindicada si TFG < 30. Suspender 48h antes de contraste IV.\n• Beneficio adicional: Reducción de eventos cardiovasculares en DM2.';
  if (t.includes('atorvastatin') || t.includes('atorvastatina'))
    return '💊 Atorvastatina (Estatina)\n• Indicación: Dislipidemia, prevención cardiovascular\n• Dosis usual: 10–80 mg/día nocturno\n• Advertencias: Monitorear CPK y transaminasas. Evitar con jugo de toronja.\n• Objetivo: LDL < 100 mg/dL (< 70 en alto riesgo CV).';
  if (t.includes('amoxicilina') || t.includes('amoxicilín'))
    return '💊 Amoxicilina (Aminopenicilina)\n• Indicación: Infecciones bacterianas de vías respiratorias, urinarias, piel\n• Dosis usual: 500 mg c/8h o 875 mg c/12h por 7–10 días\n• Advertencias: Confirmar ausencia de alergia a penicilinas. Ajustar en IR.\n• Resistencia: No usar sin cultivo si hay sospecha de resistencia local.';
  if (t.includes('ibuprofeno'))
    return '💊 Ibuprofeno (AINE)\n• Indicación: Dolor leve-moderado, fiebre, inflamación\n• Dosis usual: 400 mg c/8h con alimentos, máximo 1200 mg/día\n• Advertencias: Evitar en úlcera péptica, IR, embarazo tercer trimestre, adultos mayores.\n• Alternativa más segura en riesgo GI: Usar con omeprazol protector.';
  if (t.includes('omeprazol'))
    return '💊 Omeprazol (IBP)\n• Indicación: ERGE, úlcera péptica, protección gástrica con AINEs\n• Dosis usual: 20 mg/día antes del desayuno\n• Advertencias: Uso prolongado asociado a hipomagnesemia y riesgo de C. difficile.\n• Duración recomendada: Máximo 8 semanas salvo indicación especializada.';

  // ── Diagnósticos CIE-10 ────────────────────────────────────────
  if (t.includes('i10') || t.includes('hipertensión') || t.includes('hipertension'))
    return '🩺 I10 — Hipertensión arterial esencial\n• Meta terapéutica: TA < 130/80 mmHg\n• Tratamiento primera línea: IECA o ARA II + tiazida o calcioantagonista\n• Modificaciones del estilo de vida: Dieta DASH, ejercicio aeróbico 150 min/semana, restricción de sodio\n• Seguimiento: Control mensual hasta meta, luego cada 3–6 meses.';
  if (t.includes('e11') || t.includes('diabetes'))
    return '🩺 E11 — Diabetes mellitus tipo 2\n• Meta: HbA1c < 7% (individualizar según paciente)\n• Primera línea: Metformina + cambios de estilo de vida\n• Seguimiento: HbA1c c/3 meses, microalbuminuria y fondo de ojo anual\n• Riesgo CV: Considerar iSGLT2 o arGLP1 si ECV establecida.';
  if (t.includes('j06') || t.includes('j00') || t.includes('respiratoria') || t.includes('gripa'))
    return '🩺 J06 — Infección aguda vías respiratorias superiores\n• Etiología: Viral en > 80% de casos. Antibióticos NO indicados de rutina.\n• Tratamiento: Sintomático — paracetamol, hidratación, reposo\n• Antibiótico si: Fiebre > 38.5°C > 3 días, exudado amigdalino, dolor facial intenso\n• Duración media: 7–10 días de evolución natural.';

  // ── Respuesta genérica ────────────────────────────────────────
  return '🤖 SmartHealth AI — Asistente Clínico\n\nRecibí tu consulta. Puedo ayudarte con:\n• Priorización de síntomas (describe los síntomas del paciente)\n• Información de medicamentos (nombre del fármaco)\n• Guías de diagnósticos CIE-10\n• Recomendaciones clínicas basadas en evidencia\n\nPara respuestas con IA generativa completa, configura ANTHROPIC_API_KEY en las variables de entorno.';
}

module.exports = router;
