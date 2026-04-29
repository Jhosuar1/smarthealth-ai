// ═══════════════════════════════════════════════════════════════
//  frontend/js/api.js
//  Cliente HTTP centralizado — todas las llamadas al backend
//  Reemplaza el localStorage anterior por llamadas REST reales
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';

// ─── Token JWT (se guarda en memoria + sessionStorage) ──────────
let _token = sessionStorage.getItem('sha_token') || null;

const Auth = {
  setToken(t) { _token = t; sessionStorage.setItem('sha_token', t); },
  clearToken() { _token = null; sessionStorage.removeItem('sha_token'); },
  getToken() { return _token; },
  isLoggedIn() { return !!_token; }
};

// ─── Fetch con JWT automático ────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (_token) headers['Authorization'] = 'Bearer ' + _token;

  const res = await fetch(API_BASE + path, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  // Token expirado → logout automático
  if (res.status === 401) {
    Auth.clearToken();
    window.dispatchEvent(new Event('sha:logout'));
    throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ─── AUTH ────────────────────────────────────────────────────────
const ApiAuth = {
  login:    (email, password) => apiFetch('/auth/login',    { method:'POST', body:{ email, password } }),
  register: (data)            => apiFetch('/auth/register', { method:'POST', body: data }),
  recovery: (email)           => apiFetch('/auth/recovery', { method:'POST', body:{ email } }),
  reset:    (email, codigo, newPassword) => apiFetch('/auth/reset', { method:'POST', body:{ email, codigo, newPassword } }),
};

// ─── CITAS ───────────────────────────────────────────────────────
const ApiCitas = {
  getAll:   ()   => apiFetch('/citas'),
  create:   (d)  => apiFetch('/citas',             { method:'POST',  body: d }),
  cancelar: (id) => apiFetch(`/citas/${id}/cancelar`, { method:'PATCH' }),
};

// ─── FÓRMULAS ────────────────────────────────────────────────────
const ApiFormulas = {
  getAll:   ()          => apiFetch('/formulas'),
  create:   (d)         => apiFetch('/formulas',                    { method:'POST',  body: d }),
  entregar: (id)        => apiFetch(`/formulas/${id}/entregar`,     { method:'PATCH' }),
  rating:   (id, r, c)  => apiFetch(`/formulas/${id}/rating`,       { method:'PATCH', body:{ rating:r, comentario:c } }),
};

// ─── INVENTARIO ──────────────────────────────────────────────────
const ApiInventario = {
  getAll:      (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch('/inventario' + (qs ? '?' + qs : ''));
  },
  checkStock:  (medicamentos, farmacia) => apiFetch('/inventario/check', { method:'POST', body:{ medicamentos, farmacia } }),
  create:      (d)    => apiFetch('/inventario',            { method:'POST',   body: d }),
  update:      (id,d) => apiFetch(`/inventario/${id}`,     { method:'PUT',    body: d }),
  ajustarStock:(id,delta) => apiFetch(`/inventario/${id}/stock`, { method:'PATCH', body:{ delta } }),
  delete:      (id)   => apiFetch(`/inventario/${id}`,     { method:'DELETE' }),
};

// ─── USUARIOS ────────────────────────────────────────────────────
const ApiUsuarios = {
  getAll:  ()   => apiFetch('/usuarios'),
  getMe:   ()   => apiFetch('/usuarios/me'),
  toggle:  (id) => apiFetch(`/usuarios/${id}/toggle`, { method:'PATCH' }),
  delete:  (id) => apiFetch(`/usuarios/${id}`,        { method:'DELETE' }),
};

// ─── NOTIFICACIONES ──────────────────────────────────────────────
const ApiNotif = {
  getAll:     ()   => apiFetch('/notificaciones'),
  markRead:   (id) => apiFetch(`/notificaciones/${id}/leer`,  { method:'PATCH' }),
  markAllRead:()   => apiFetch('/notificaciones/leer-todas',  { method:'PATCH' }),
};

// ─── AUDITORÍA ───────────────────────────────────────────────────
const ApiAudit = {
  getAll: () => apiFetch('/auditoria'),
  clear:  () => apiFetch('/auditoria/limpiar', { method:'DELETE' }),
};

// ─── IA (Claude) ─────────────────────────────────────────────────
const ApiIA = {
  ask: (prompt, max_tokens) => apiFetch('/ia/claude', { method:'POST', body:{ prompt, max_tokens } })
    .then(d => d.text)
    .catch(() => respuestaSimuladaLocal(prompt)),
};

// ─── Respuestas simuladas locales (si la IA no está disponible) ──
function respuestaSimuladaLocal(p) {
  const t = p.toLowerCase();
  if (t.includes('pecho') || t.includes('respirar') || t.includes('desmay'))
    return 'PRIORIDAD: 🚨 Crítica\nAtención: Inmediata — urgencias.\nLos síntomas pueden indicar emergencia cardiovascular o respiratoria.';
  if (t.includes('prioridad') || t.includes('síntoma') || t.includes('dolor') || t.includes('fiebre')) {
    if (t.includes('fuerte') || t.includes('vómit') || t.includes('sangr'))
      return 'PRIORIDAD: ⚠️ Alta\nAtención: En las próximas 24 horas.\nSíntomas moderadamente graves que requieren evaluación pronta.';
    if (t.includes('control') || t.includes('diabetes') || t.includes('hta') || t.includes('cróni'))
      return 'PRIORIDAD: ℹ️ Media\nAtención: En 48–72 horas.\nConsulta de control de patología crónica estable.';
    return 'PRIORIDAD: ✅ Baja\nAtención: Hasta 7 días.\nLos síntomas no sugieren urgencia clínica inmediata.';
  }
  if (t.includes('losartán') || t.includes('losartan'))
    return 'Losartán (ARA II): para HTA y protección renal en DM2. Vigilar hiperpotasemia e hipotensión ortostática. Contraindicado en embarazo. Tomar a la misma hora cada día.';
  if (t.includes('metformina'))
    return 'Metformina: antidiabético de primera línea para DM2. Siempre con alimentos. Contraindicado si TFG <30 ml/min. Suspender antes de cirugía o contraste radiológico.';
  if (t.includes('atorvastatina'))
    return 'Atorvastatina: estatina para reducir LDL. Tomar por la noche. Vigilar mialgias. Evitar jugo de toronja. Control de transaminasas al inicio del tratamiento.';
  if (t.includes('cita') || t.includes('agendar'))
    return 'Para agendar: ve a "Mis Citas" → "Nueva cita". Describe síntomas con detalle y presiona "Evaluar prioridad" para que el sistema determine la urgencia antes de confirmar.';
  if (t.includes('hipertensión') || t.includes('presión'))
    return 'HTA: presión >140/90 mmHg. Síntomas: cefalea, mareos, visión borrosa. Muchas veces asintomática. Meta terapéutica: <130/80 en diabéticos. Control semanal de TA.';
  if (t.includes('diabetes'))
    return 'DM2: glucemia en ayunas >126 mg/dL o HbA1c >6.5%. Control con dieta, ejercicio y Metformina. Meta HbA1c <7%. Revisión de pies en cada consulta.';
  if (t.includes('medicamento') || t.includes('fórmula') || t.includes('formula') || t.includes('activo'))
    return 'Medicamentos activos: Losartán 50mg (1/día, HTA), Metformina 850mg (2/día con comidas, DM2), Atorvastatina 20mg (1/noche, colesterol). No modifiques dosis sin consultar al médico.';
  if (t.includes('inventario') || t.includes('stock') || t.includes('farmacia'))
    return 'El sistema verifica stock en tiempo real. Si Cruz Verde no tiene disponibilidad, busca automáticamente en Comfamiliar y La Rebaja y propone reasignar el pedido.';
  return 'SmartHealth AI: entendí tu consulta. Respondo con base en el contexto médico disponible. Para consultas urgentes, agenda una cita con tu médico tratante.';
}
