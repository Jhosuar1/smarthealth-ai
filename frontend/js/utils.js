// ═══════════════════════════════════════════════════════
//  frontend/js/utils.js
//  Funciones de utilidad compartidas por toda la app
// ═══════════════════════════════════════════════════════

// ── Formateo ──────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + (iso.includes('T') ? '' : 'T12:00')).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtCurrency(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)  return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} día${d > 1 ? 's' : ''}`;
}

// ── Clases CSS según datos ─────────────────────────────
function priClass(p) {
  return { critica:'bg-red', alta:'bg-orange', media:'bg-blue', baja:'bg-green' }[p] || 'bg-gray';
}
function priStripe(p) {
  return { critica:'pri-critica', alta:'pri-alta', media:'pri-media', baja:'pri-baja' }[p] || '';
}
function estadoClass(e) {
  return { en_camino:'bg-blue', entregado:'bg-green', cancelado:'bg-gray', activa:'bg-green', cancelada:'bg-gray', completada:'bg-teal' }[e] || 'bg-gray';
}
function stockClass(stock, min) {
  if (stock === 0)      return { cls:'bg-red',    lbl:'✗ Sin stock',   col:'var(--red)' };
  if (stock <= min)     return { cls:'bg-orange', lbl:'⚠ Stock bajo',  col:'var(--orange)' };
  return               { cls:'bg-green',  lbl:'✓ Disponible', col:'var(--green)' };
}

// ── Toast ─────────────────────────────────────────────
function toast(type, title, msg) {
  const icons = { ok:'✅', info:'ℹ️', warn:'⚠️', err:'❌' };
  const cls   = { ok:'',  info:'info', warn:'warn', err:'err' };
  const area  = document.getElementById('toast-area');
  if (!area) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (cls[type] || '');
  t.innerHTML = `<div class="toast-icon">${icons[type]||'ℹ️'}</div><div>
    <div class="toast-title">${title}</div>
    ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
  </div>`;
  area.appendChild(t);
  setTimeout(() => {
    t.style.cssText += 'opacity:0;transform:translateX(12px);transition:all .3s';
    setTimeout(() => t.remove(), 320);
  }, 3800);
}

// ── Confirm dialog ────────────────────────────────────
let _confirmFn = null;
function showConfirm(icon, title, msg, btnLabel, btnClass, fn) {
  _confirmFn = fn;
  document.getElementById('conf-icon').textContent  = icon;
  document.getElementById('conf-title').textContent = title;
  document.getElementById('conf-msg').textContent   = msg;
  const btn = document.getElementById('conf-ok');
  btn.textContent = btnLabel || 'Confirmar';
  btn.className   = 'btn ' + (btnClass || 'btn-danger');
  document.getElementById('confirm-dialog').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('open');
}
// El botón conf-ok llama a _confirmFn (se asigna en app.js después del DOMContentLoaded)

// ── Modal ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── AI Spinner ────────────────────────────────────────
function aiSpinner() {
  return `<div class="ai-spinner">
    <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
  </div>`;
}

// ── Tab switcher ──────────────────────────────────────
function switchTab(el, targetId) {
  const container = el.closest('.card') || el.closest('.page');
  container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const target = document.getElementById(targetId);
  if (target) target.classList.add('active');
}

// ── Alergia check (local, no necesita BD) ─────────────
const ALERGIAS_CONOCIDAS = ['penicilina', 'ibuprofeno'];
function checkAlergia(nombreMedicamento) {
  return ALERGIAS_CONOCIDAS.some(a => nombreMedicamento.toLowerCase().includes(a));
}
