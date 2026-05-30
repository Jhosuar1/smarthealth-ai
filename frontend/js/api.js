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
  getAll:       ()   => apiFetch('/usuarios'),
  getPacientes: (q)  => apiFetch('/usuarios/pacientes' + (q ? '?q='+encodeURIComponent(q) : '')),
  getMe:        ()   => apiFetch('/usuarios/me'),
  toggle:       (id) => apiFetch(`/usuarios/${id}/toggle`, { method:'PATCH' }),
  delete:       (id) => apiFetch(`/usuarios/${id}`,        { method:'DELETE' }),
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
  // Siempre Gemini real. Si falla muestra error claro, nunca simulación.
  ask: (prompt, max_tokens) =>
    apiFetch('/ia/claude', { method:'POST', body:{ prompt, max_tokens: max_tokens || 800 } })
      .then(d => d.text || '— Sin respuesta —')
      .catch(err => `⚠️ No se pudo conectar con la IA: ${err.message}. Intenta de nuevo.`),

  askFull: (prompt, max_tokens) =>
    apiFetch('/ia/claude', { method:'POST', body:{ prompt, max_tokens: max_tokens || 800 } })
      .then(d => ({ text: d.text || '— Sin respuesta —', source: d.source || 'gemini' }))
      .catch(err => ({ text: `⚠️ No se pudo conectar con la IA: ${err.message}. Intenta de nuevo.`, source: 'error' })),

  askWithImage: (prompt, imageBase64, mimeType, max_tokens) =>
    apiFetch('/ia/vision', { method:'POST', body:{ prompt, imageBase64, mimeType, max_tokens: max_tokens || 1200 } })
      .then(d => d.text || '— Sin respuesta —')
      .catch(err => `⚠️ Error al analizar la imagen: ${err.message}`),
};


