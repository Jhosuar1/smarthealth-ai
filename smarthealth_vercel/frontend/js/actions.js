// ═══════════════════════════════════════════════════════════════
//  frontend/js/actions.js
//  Toda la lógica de acciones: citas, fórmulas, inventario,
//  usuarios, rating, chat IA, dashboard AI
// ═══════════════════════════════════════════════════════════════

// ─── CITAS ───────────────────────────────────────────────────────
async function evaluarPrioridad() {
  const motivo = (document.getElementById('a-motivo')?.value || '').trim();
  if (!motivo) { toast('warn', '⚠️', 'Describe los síntomas primero.'); return; }
  const wrap = document.getElementById('ai-pri-wrap');
  const res  = document.getElementById('ai-pri-result');
  if (!wrap || !res) return;
  wrap.style.display = 'block';
  res.innerHTML = aiSpinner();
  const r = await ApiIA.ask(`Eres el sistema de priorización clínica de SmartHealth AI (Colombia). Analiza los siguientes síntomas y responde con: 1) PRIORIDAD: Crítica / Alta / Media / Baja 2) Tiempo recomendado de atención 3) Una línea de justificación clínica. Sé breve (máx 4 líneas). Síntomas: "${motivo}"`);
  res.innerHTML = r;
  priResult = r;
}

async function confirmarCita() {
  const motivo = (document.getElementById('a-motivo')?.value || '').trim();
  const esp    = document.getElementById('a-esp')?.value;
  const mod    = document.getElementById('a-mod')?.value;
  const centro = document.getElementById('a-centro')?.value;
  if (!motivo) { toast('warn', '⚠️', 'Describe el motivo de la consulta.'); return; }

  let pri = 'media';
  if (priResult) {
    const m = priResult.match(/(Crítica|Alta|Media|Baja)/i);
    if (m) pri = { Crítica:'critica', Alta:'alta', Media:'media', Baja:'baja' }[m[1]] || 'media';
  }

  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 4);

  try {
    await ApiCitas.create({
      medico_nom:  'Dr. Carlos Mejía',
      especialidad: esp,
      centro:      (centro||'').split('—')[0].trim(),
      fecha:       fecha.toISOString().split('T')[0],
      hora:        '10:00',
      modalidad:   mod,
      prioridad:   pri,
      motivo
    });
    closeModal('m-agendar');
    priResult = null;
    toast('ok', '📅 Cita confirmada', `${esp} · Prioridad: ${pri}`);
    setTimeout(() => toast('info', '📱 Notificación enviada', 'Recordatorio agendado 24h antes'), 1600);
    nav('citas');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

async function verCita(id) {
  const citas = await ApiCitas.getAll().catch(() => []);
  const c = citas.find(x => x.id === id);
  if (!c) return;
  activeCitaId = id;
  document.getElementById('cita-detalle-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      ${[['Médico',c.medico_nom],['Especialidad',c.especialidad],['Centro',c.centro],['Fecha',fmtDate(c.fecha)],['Hora',c.hora?.slice(0,5)],['Modalidad',c.modalidad],['Prioridad',c.prioridad],['Estado',c.estado]].map(([l,v])=>`<div><div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase">${l}</div><div style="font-weight:700;font-size:14px;margin-top:2px">${v||'—'}</div></div>`).join('')}
    </div>
    <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:13px"><strong>Motivo:</strong> ${c.motivo}</div>`;
  openModal('m-cita-detalle');
}

async function cancelarCitaActual() {
  try {
    await ApiCitas.cancelar(activeCitaId);
    closeModal('m-cita-detalle');
    toast('warn', '⚠️ Cita cancelada', 'El médico fue notificado');
    nav('citas');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

// ─── FÓRMULAS ────────────────────────────────────────────────────
const ALERGIAS = ['penicilina', 'ibuprofeno'];

function abrirFormula(pac, dx) {
  medRowCount = 0;
  const cont = document.getElementById('meds-container');
  if (cont) cont.innerHTML = '';
  addMedRow();
  if (document.getElementById('f-pac')) document.getElementById('f-pac').value = pac || '';
  if (document.getElementById('f-dx'))  document.getElementById('f-dx').value  = dx  || '';
  if (document.getElementById('f-obs')) document.getElementById('f-obs').value = '';
  if (document.getElementById('ai-formula-wrap')) document.getElementById('ai-formula-wrap').style.display = 'none';

  // Cargar farmacias del inventario
  ApiInventario.getAll().then(inv => {
    const farms = [...new Set(inv.map(i => i.farmacia))];
    const sel = document.getElementById('f-farmacia');
    if (sel) sel.innerHTML = farms.map(f => `<option>${f}</option>`).join('');
  }).catch(() => {});

  openModal('m-formula');
}

function addMedRow() {
  medRowCount++;
  const c = document.getElementById('meds-container');
  if (!c) return;
  const d = document.createElement('div');
  d.className = 'form-row fr-3';
  d.innerHTML = `
    <div><label class="form-label">Medicamento ${medRowCount}</label><input class="form-input med-nom" type="text" placeholder="Nombre del medicamento"></div>
    <div><label class="form-label">Dosis</label><input class="form-input med-dos" type="text" placeholder="Ej: 50mg 1x/día"></div>
    <div><label class="form-label">Duración</label><input class="form-input med-dur" type="text" placeholder="Ej: 30 días"></div>`;
  c.appendChild(d);
}

async function validarFormulaIA() {
  const meds = [...document.querySelectorAll('.med-nom')].map(i => i.value.trim()).filter(Boolean);
  const dx   = (document.getElementById('f-dx')?.value || '').trim();
  if (!meds.length || !dx) { toast('warn', '⚠️', 'Agrega diagnóstico y al menos un medicamento.'); return; }

  const alergia = meds.find(m => ALERGIAS.some(a => m.toLowerCase().includes(a)));
  if (alergia) { toast('err', '🚨 ALERGIA', `"${alergia}" en lista de alergias del paciente.`); return; }

  const wrap = document.getElementById('ai-formula-wrap');
  const res  = document.getElementById('ai-formula-result');
  if (!wrap || !res) return;
  wrap.style.display = 'block';
  res.innerHTML = aiSpinner();
  const r = await ApiIA.ask(`Eres el validador de fórmulas de SmartHealth AI (Colombia). Analiza: Diagnóstico: ${dx}. Medicamentos: ${meds.join(', ')}. Indica: 1) ¿Apropiados para el diagnóstico? 2) Interacciones a vigilar 3) Alertas especiales. Máximo 4 líneas.`);
  res.innerHTML = r;
}

async function generarFormula() {
  const pac      = document.getElementById('f-pac')?.value?.trim() || 'Paciente';
  const dx       = (document.getElementById('f-dx')?.value || '').trim();
  const obs      = document.getElementById('f-obs')?.value?.trim() || '';
  const entrega  = document.getElementById('f-entrega')?.value || 'domicilio';
  const farmacia = document.getElementById('f-farmacia')?.value || 'Cruz Verde';
  const meds     = [...document.querySelectorAll('#meds-container .form-row')].map(r => ({
    nombre:  r.querySelector('.med-nom')?.value?.trim() || '',
    dosis:   r.querySelector('.med-dos')?.value?.trim() || '',
    duracion:r.querySelector('.med-dur')?.value?.trim() || ''
  })).filter(m => m.nombre);

  if (!dx || !meds.length) { toast('warn', '⚠️', 'Agrega diagnóstico y al menos un medicamento.'); return; }

  // Bloqueo de alergias
  const alergia = meds.find(m => ALERGIAS.some(a => m.nombre.toLowerCase().includes(a)));
  if (alergia) { toast('err', '🚨 BLOQUEADO', `"${alergia.nombre}" está en la lista de alergias. No se puede prescribir.`); return; }

  try {
    await ApiFormulas.create({
      paciente_id:  'u1', // En producción vendría del selector de paciente
      diagnostico:  dx,
      observaciones: obs,
      tipo_entrega: entrega,
      farmacia,
      medicamentos: meds
    });
    closeModal('m-formula');
    medRowCount = 0;
    toast('ok', '✅ Fórmula generada', 'Firmada digitalmente y enviada');
    setTimeout(() => toast('info', '💊 Farmacia notificada', farmacia + ' recibió la receta'), 1500);
    setTimeout(() => toast('info', '📱 Paciente notificado', 'SMS enviado al paciente'), 2800);
    nav('prescribir');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

// ─── FARMACIA: validar receta con verificación de stock real ─────
async function validarRecetaFarmacia(formulaId, farmaciaActual) {
  try {
    // Obtener medicamentos de la fórmula
    const fms  = await ApiFormulas.getAll();
    const f    = fms.find(x => x.id === formulaId);
    if (!f) return;

    const meds = (f.medicamentos || []).filter(Boolean).map(m => ({ nombre: m.nombre }));

    // Verificar stock vía API
    const check = await ApiInventario.checkStock(meds, farmaciaActual);

    if (check.farmaciaOk === farmaciaActual) {
      // La farmacia actual tiene todo
      toast('ok', '✅ Receta validada', 'Stock confirmado en ' + farmaciaActual + '. Enviando a logística.');
    } else if (check.farmaciaOk) {
      // Otra farmacia tiene stock
      const alt = check.farmaciaOk;
      toast('warn', '⚠️ Stock insuficiente en ' + farmaciaActual, 'Stock disponible en: ' + alt);
      setTimeout(() => {
        showConfirm('🔄', 'Reasignar a ' + alt,
          `"${alt}" tiene todos los medicamentos disponibles. ¿Reasignar el pedido?`,
          'Reasignar', 'btn-primary',
          async () => {
            toast('ok', '✅ Reasignada a ' + alt, 'Pedido enviado');
            await nav('farmacia');
          }
        );
      }, 600);
    } else {
      toast('err', '❌ Sin stock en ninguna farmacia', 'Contacta al médico para gestionar incidencia.');
    }
  } catch (e) { toast('err', '❌ Error', e.message); }
}

// ─── INVENTARIO ──────────────────────────────────────────────────
async function filterInvTable(q) {
  const farm = document.getElementById('inv-farm-f')?.value || '';
  try {
    const params = {};
    if (q)    params.q       = q;
    if (farm) params.farmacia = farm;
    const inv     = await ApiInventario.getAll(params);
    const canEdit = ['superadmin','admin','farmacia'].includes(CU?.rol);
    const isSA    = CU?.rol === 'superadmin';
    const today   = Date.now();
    const soon90  = today + 90*86400000;

    const rows = inv.map(i => {
      const pct = i.stock===0?0:Math.min(100,Math.round(i.stock/Math.max(i.stock,i.stock_min*3)*100));
      const col = i.stock===0?'var(--red)':i.stock<=i.stock_min?'var(--orange)':'var(--green)';
      const stC = i.stock===0?'bg-red':i.stock<=i.stock_min?'bg-orange':'bg-green';
      const stL = i.stock===0?'✗ Sin stock':i.stock<=i.stock_min?'⚠ Stock bajo':'✓ Disponible';
      const vD  = i.vencimiento ? new Date(i.vencimiento).getTime() : null;
      const eW  = vD && vD<=soon90 ? ' ⚠️' : '';
      return `<tr>
        <td><strong>${i.nombre}</strong></td><td style="font-size:12px">${i.presentacion}</td>
        <td><span class="badge bg-gray">${i.farmacia}</span></td>
        <td><strong>${i.stock}</strong> unid.</td>
        <td><div class="inv-bar"><div class="inv-fill" style="width:${pct}%;background:${col}"></div></div></td>
        <td style="font-size:12px">${i.precio?'$'+Number(i.precio).toLocaleString('es-CO'):'—'}</td>
        <td style="font-size:11px;color:${eW?'var(--orange)':'var(--t3)'}">${i.vencimiento||'—'}${eW}</td>
        <td><span class="badge ${stC}">${stL}</span></td>
        ${canEdit?`<td><div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="openInvModal('${i.id}')">✏️</button>
          <button class="btn btn-outline btn-sm" onclick="ajustarStock('${i.id}',10)">+10</button>
          ${isSA?`<button class="btn btn-danger btn-sm" onclick="deleteInv('${i.id}','${i.nombre}')">🗑️</button>`:''}
        </div></td>`:''}
      </tr>`;
    }).join('') || `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--t3)">Sin resultados para "${q}"</td></tr>`;

    const tbody = document.getElementById('inv-tbody');
    if (tbody) tbody.innerHTML = rows;
  } catch {}
}

function openInvModal(id) {
  invEditId = id;
  document.getElementById('m-inv-title').textContent = id ? 'Editar medicamento' : 'Agregar medicamento';

  if (!id) {
    ['inv-nom','inv-pres','inv-vence'].forEach(x => { const el=document.getElementById(x); if(el) el.value=''; });
    ['inv-stock','inv-precio'].forEach(x => { const el=document.getElementById(x); if(el) el.value='0'; });
    const min = document.getElementById('inv-min'); if(min) min.value='20';
    openModal('m-inv'); return;
  }

  ApiInventario.getAll().then(inv => {
    const item = inv.find(i => i.id === id);
    if (!item) return;
    ['nom','pres','vence'].forEach(k => {
      const el = document.getElementById('inv-' + k);
      if (el) el.value = item[k === 'nom' ? 'nombre' : k === 'pres' ? 'presentacion' : 'vencimiento'] || '';
    });
    const s = document.getElementById('inv-stock');   if(s) s.value = item.stock ?? 0;
    const m = document.getElementById('inv-min');     if(m) m.value = item.stock_min ?? 20;
    const p = document.getElementById('inv-precio');  if(p) p.value = item.precio ?? 0;
    const f = document.getElementById('inv-farm');
    if (f) for (const o of f.options) if (o.value===item.farmacia) { o.selected=true; break; }
    openModal('m-inv');
  });
}

async function guardarInventario() {
  const nombre      = document.getElementById('inv-nom')?.value?.trim();
  const presentacion= document.getElementById('inv-pres')?.value?.trim();
  const stock       = parseInt(document.getElementById('inv-stock')?.value) || 0;
  const stock_min   = parseInt(document.getElementById('inv-min')?.value)   || 20;
  const precio      = parseInt(document.getElementById('inv-precio')?.value)|| 0;
  const vencimiento = document.getElementById('inv-vence')?.value || null;
  const farmacia    = document.getElementById('inv-farm')?.value || 'Cruz Verde';

  if (!nombre || !presentacion) { toast('warn', '⚠️', 'Nombre y presentación son obligatorios.'); return; }

  try {
    if (invEditId) {
      await ApiInventario.update(invEditId, { nombre, presentacion, farmacia, stock, stock_min, precio, vencimiento });
      toast('ok', '✅ Actualizado', nombre + ' en ' + farmacia);
    } else {
      await ApiInventario.create({ nombre, presentacion, farmacia, stock, stock_min, precio, vencimiento });
      toast('ok', '✅ Agregado', nombre + ' al inventario de ' + farmacia);
    }
    closeModal('m-inv');
    invEditId = null;
    nav('inventario');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

async function ajustarStock(id, delta) {
  try {
    const item = await ApiInventario.ajustarStock(id, delta);
    toast('ok', '📦 Stock ajustado', (item.nombre||'Medicamento') + ': ' + item.stock + ' unid.');
    nav('inventario');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

function deleteInv(id, nombre) {
  showConfirm('🗑️', '¿Eliminar del inventario?',
    `Eliminarás "${nombre}" permanentemente.`, 'Eliminar', 'btn-danger',
    async () => {
      try {
        await ApiInventario.delete(id);
        toast('ok', '🗑️ Eliminado', nombre);
        nav('inventario');
      } catch (e) { toast('err', '❌ Error', e.message); }
    }
  );
}

// ─── USUARIOS ────────────────────────────────────────────────────
function deleteUser(id, nombre) {
  showConfirm('🗑️', '¿Eliminar usuario?',
    `Se eliminará permanentemente la cuenta de "${nombre}". Esta acción no se puede deshacer.`,
    'Eliminar', 'btn-danger',
    async () => {
      try {
        await ApiUsuarios.delete(id);
        toast('ok', '🗑️ Eliminado', nombre);
        nav('usuarios');
      } catch (e) { toast('err', '❌ Error', e.message); }
    }
  );
}

async function toggleUser(id, nombre) {
  try {
    const res = await ApiUsuarios.toggle(id);
    toast(res.activo ? 'ok' : 'warn', res.activo ? '✅ Cuenta activada' : '⚠️ Cuenta suspendida', nombre);
    nav('usuarios');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

// ─── ENTREGA + RATING ────────────────────────────────────────────
async function confirmarRecepcion(fId) {
  try {
    await ApiFormulas.entregar(fId);
    toast('ok', '🎉 ¡Medicamento recibido!', 'Entrega confirmada');
    setTimeout(() => abrirRating(fId), 1500);
    nav('formulas');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

function abrirRating(fId) {
  ratingFormulaId = fId;
  selectedStars   = 0;
  const comment = document.getElementById('rating-comment');
  if (comment) comment.value = '';
  document.getElementById('star-label').textContent = 'Selecciona una calificación';
  document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
  openModal('m-rating');
}

function setStar(n) {
  selectedStars = n;
  const labels = ['', 'Muy mala', 'Regular', 'Aceptable', 'Buena', 'Excelente'];
  const el = document.getElementById('star-label');
  if (el) el.textContent = labels[n] + ' (' + n + '/5)';
  document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < n));
}

async function enviarRating() {
  if (!selectedStars) { toast('warn', '⚠️', 'Selecciona una calificación.'); return; }
  const comment = document.getElementById('rating-comment')?.value?.trim() || '';
  try {
    await ApiFormulas.rating(ratingFormulaId, selectedStars, comment);
    closeModal('m-rating');
    toast('ok', '⭐ Calificación enviada', selectedStars + '/5 — ¡Gracias!');
    nav('formulas');
  } catch (e) { toast('err', '❌ Error', e.message); }
}

// ─── DASHBOARD IA ────────────────────────────────────────────────
async function dashAsk() {
  const input = document.getElementById('dash-q');
  const res   = document.getElementById('dash-ai-r');
  if (!input || !res) return;
  const q = input.value.trim();
  if (!q) return;
  res.innerHTML = aiSpinner();
  const r = await ApiIA.ask(`Asistente SmartHealth AI. Usuario: ${CU?.nombre} (${CU?.rol}). Responde claro y amable en máx 3 líneas. Consulta: ${q}`);
  res.innerHTML = `<div class="ai-result">${r}</div>`;
  input.value = '';
}

// ─── CHAT ASISTENTE ──────────────────────────────────────────────
async function chatSend() {
  const input = document.getElementById('chat-input');
  const msgs  = document.getElementById('chat-messages');
  if (!input || !msgs) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = '';

  msgs.innerHTML += `<div class="chat-user-msg">${q}</div>`;
  const thinkId = 'think-' + Date.now();
  msgs.innerHTML += `<div class="chat-ai-msg" id="${thinkId}">${aiSpinner()}</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  const r = await ApiIA.ask(`Asistente de salud SmartHealth AI Colombia. Usuario: ${CU?.nombre} (${CU?.rol}). Alergias del paciente registradas: Penicilina, Ibuprofeno. Responde conciso, claro y amable. Consulta: ${q}`);
  const thinkEl = document.getElementById(thinkId);
  if (thinkEl) thinkEl.innerHTML = `<div class="ai-result">${r}</div>`;
  msgs.scrollTop = msgs.scrollHeight;
}
