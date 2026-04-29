// ═══════════════════════════════════════════════════════════════
//  frontend/js/pages.js
//  Renderers de todas las páginas — cada función async retorna HTML
// ═══════════════════════════════════════════════════════════════

const PAGES = {

// ─── DASHBOARD ──────────────────────────────────────────────────
async dashboard() {
  const [citas, formulas, notifs] = await Promise.all([
    ApiCitas.getAll().catch(() => []),
    ApiFormulas.getAll().catch(() => []),
    ApiNotif.getAll().catch(() => []),
  ]);
  const activas  = citas.filter(c => c.estado === 'activa');
  const enCamino = formulas.filter(f => f.estado === 'en_camino');
  const unread   = notifs.filter(n => !n.leida).length;

  const citasHTML = activas.length === 0
    ? `<p style="text-align:center;color:var(--t3);font-size:13px;padding:16px">Sin citas programadas. <span style="color:var(--blue);cursor:pointer" onclick="openModal('m-agendar')">Agenda una →</span></p>`
    : activas.slice(0,3).map(c => {
        const d = new Date(c.fecha + 'T12:00');
        return `<div class="appt-card" onclick="verCita('${c.id}')">
          <div class="appt-date"><div class="appt-day">${d.getDate()}</div><div class="appt-month">${d.toLocaleDateString('es',{month:'short'})}</div></div>
          <div class="appt-info">
            <div class="pri-stripe ${priStripe(c.prioridad)}"></div>
            <div class="appt-dr">${c.medico_nom}</div>
            <div class="appt-spec">${c.especialidad} · ${c.centro}</div>
            <div class="appt-meta">🕐 ${c.hora?.slice(0,5)} · ${c.modalidad}</div>
          </div>
          <span class="badge ${priClass(c.prioridad)}">${c.prioridad}</span>
        </div>`;
      }).join('');

  const pedidoHTML = enCamino.length === 0
    ? `<div style="text-align:center;padding:20px;color:var(--t3)"><div style="font-size:36px">📭</div><p style="font-size:13px;margin-top:8px">Sin pedidos activos</p></div>`
    : enCamino.map(f => {
        const meds = (f.medicamentos || []).filter(Boolean);
        return `<div style="padding:12px;background:var(--bg);border-radius:8px;margin-bottom:10px">
          <div style="display:flex;gap:9px;align-items:center;margin-bottom:12px">
            <span style="font-size:24px">💊</span>
            <div><div style="font-weight:700;font-size:13px">${meds.map(m=>m.nombre).join(', ')||'Medicamentos'}</div>
            <div style="font-size:11px;color:var(--t3)">${f.farmacia}</div></div>
            <span class="badge bg-blue" style="margin-left:auto">En camino</span>
          </div>
          <div class="tracker-list">
            <div class="track-step done"><div class="track-ic">✓</div><div><div class="track-label">Fórmula generada</div><div class="track-sub">${f.creado_en?.slice(0,10)}</div></div></div>
            <div class="track-step done"><div class="track-ic">✓</div><div><div class="track-label">Receta validada</div></div></div>
            <div class="track-step active"><div class="track-ic">🛵</div><div><div class="track-label">En camino</div><div class="track-sub">~25 min estimados</div></div></div>
            <div class="track-step"><div class="track-ic">📬</div><div><div class="track-label">Entregado</div></div></div>
          </div>
        </div>`;
      }).join('');

  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Panel de Salud</h1><p>Bienvenido/a, ${App.user.nombre}. Tu resumen de hoy.</p></div>
      <button class="btn btn-primary" onclick="openModal('m-agendar')">📅 Nueva cita</button>
    </div>
    <div class="alert-banner alert-red" style="margin-bottom:16px">
      <span>🚨</span><div><strong>Alergias registradas:</strong> Penicilina · Ibuprofeno — El sistema bloquea estas sustancias en prescripciones automáticamente.</div>
    </div>
    <div class="stats stats-4" style="margin-bottom:18px">
      <div class="stat"><div class="stat-ic" style="background:var(--blue-l)">📅</div><div class="stat-lbl">Próximas citas</div><div class="stat-val">${activas.length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--green-l)">💊</div><div class="stat-lbl">Fórmulas activas</div><div class="stat-val">${formulas.filter(f=>f.estado!=='entregado').length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--orange-l)">🚚</div><div class="stat-lbl">Pedidos en curso</div><div class="stat-val">${enCamino.length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--purple-l)">🔔</div><div class="stat-lbl">Notificaciones</div><div class="stat-val">${unread}</div><div class="stat-sub">Sin leer</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h"><span>📅</span><div class="card-title">Próximas citas</div><button class="btn btn-primary btn-sm" onclick="nav('citas')">Ver todas</button></div>
        <div class="card-b">${citasHTML}</div>
      </div>
      <div class="card">
        <div class="card-h"><span>📦</span><div class="card-title">Pedidos activos</div><button class="btn btn-outline btn-sm" onclick="nav('rastreo')">Rastrear</button></div>
        <div class="card-b">${pedidoHTML}</div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>🤖</span><div class="card-title">Pregunta al asistente IA</div></div>
      <div class="card-b">
        <div style="display:flex;gap:9px">
          <input id="dash-q" class="form-input" style="flex:1" placeholder="¿Qué quieres saber sobre tu salud?" onkeydown="if(event.key==='Enter')App.dashAsk()">
          <button class="btn btn-primary" onclick="App.dashAsk()">Preguntar</button>
        </div>
        <div id="dash-ai-r" style="margin-top:10px"></div>
      </div>
    </div>
  </div>`;
},

// ─── MAPA ────────────────────────────────────────────────────────
async mapa() {
  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Mapa de Centros de Salud</h1><p>Hospitales, clínicas y farmacias en Pereira, Risaralda</p></div>
      <button class="btn btn-primary" onclick="openModal('m-agendar')">📅 Agendar cita</button>
    </div>
    <div style="display:flex;gap:9px;margin-bottom:12px">
      <input id="map-search" class="form-input" style="flex:1" placeholder="🔍 Buscar centro de salud o farmacia..." oninput="filterMapPins(this.value)">
      <button class="btn btn-outline" onclick="filterMapPins('',true)">Todos</button>
      <button class="btn btn-outline" onclick="filterMapPins('hospital')">🏥 Hospitales</button>
      <button class="btn btn-outline" onclick="filterMapPins('farmacia')">💊 Farmacias</button>
    </div>
    <div id="leaflet-map" style="height:390px"></div>
    <div class="g3" style="margin-top:12px" id="map-cards"></div>
  </div>`;
},

// ─── CITAS ───────────────────────────────────────────────────────
async citas() {
  const all    = await ApiCitas.getAll().catch(() => []);
  const activas = all.filter(c => c.estado === 'activa');
  const pasadas = all.filter(c => c.estado !== 'activa');

  const renderAppt = c => {
    const d = new Date(c.fecha + 'T12:00');
    return `<div class="appt-card" onclick="verCita('${c.id}')">
      <div class="appt-date"><div class="appt-day">${d.getDate()}</div><div class="appt-month">${d.toLocaleDateString('es',{month:'short'})}</div></div>
      <div class="appt-info">
        <div class="pri-stripe ${priStripe(c.prioridad)}"></div>
        <div class="appt-dr">${c.medico_nom}</div>
        <div class="appt-spec">${c.especialidad} · ${c.centro}</div>
        <div class="appt-meta">🕐 ${c.hora?.slice(0,5)} · ${c.modalidad}</div>
      </div>
      <span class="badge ${priClass(c.prioridad)}">${c.prioridad}</span>
    </div>`;
  };

  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Mis Citas Médicas</h1><p>Gestiona tus citas con priorización clínica automática</p></div>
      <div class="page-hdr-actions">
        <button class="btn btn-outline" onclick="nav('mapa')">🗺️ Ver mapa</button>
        <button class="btn btn-primary btn-lg" onclick="openModal('m-agendar')">📅 Nueva cita</button>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h"><span>🔜</span><div class="card-title">Próximas (${activas.length})</div></div>
        <div class="card-b">${activas.length === 0 ? '<p style="text-align:center;color:var(--t3);font-size:13px;padding:16px">Sin citas programadas</p>' : activas.map(renderAppt).join('')}</div>
      </div>
      <div class="card">
        <div class="card-h"><span>📊</span><div class="card-title">Sistema de Priorización IA</div></div>
        <div class="card-b">
          <p style="font-size:13px;color:var(--t3);margin-bottom:14px">El sistema evalúa tus síntomas y asigna prioridad automáticamente:</p>
          ${[['🚨 Crítica','pri-critica','Urgencias vitales — Atención inmediata','red-l'],
             ['⚠️ Alta','pri-alta','Síntomas graves — Máx. 24 horas','orange-l'],
             ['ℹ️ Media','pri-media','Control rutinario — Máx. 72 horas','blue-l'],
             ['✅ Baja','pri-baja','Revisión preventiva — Hasta 7 días','green-l']].map(([l,cls,d,bg])=>`
          <div style="display:flex;gap:9px;align-items:center;padding:9px;border-radius:7px;background:var(--${bg});margin-bottom:7px">
            <div class="pri-stripe ${cls}" style="width:4px;height:30px;flex-shrink:0;border-radius:2px"></div>
            <div><div style="font-weight:700;font-size:13px">${l}</div><div style="font-size:11px;color:var(--t3)">${d}</div></div>
          </div>`).join('')}
        </div>
      </div>
    </div>
    ${pasadas.length > 0 ? `
    <div class="card" style="margin-top:14px">
      <div class="card-h"><span>📁</span><div class="card-title">Historial</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl"><thead><tr><th>Fecha</th><th>Médico</th><th>Especialidad</th><th>Estado</th></tr></thead>
        <tbody>${pasadas.map(c=>`<tr><td>${fmtDate(c.fecha)}</td><td>${c.medico_nom}</td><td>${c.especialidad}</td><td><span class="badge ${estadoClass(c.estado)}">${c.estado}</span></td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
  </div>`;
},

// ─── FÓRMULAS ────────────────────────────────────────────────────
async formulas() {
  const fms = await ApiFormulas.getAll().catch(() => []);
  if (!fms.length) return `<div class="page"><div class="page-hdr"><div><h1>Mis Fórmulas Médicas</h1></div></div><div class="card"><div class="card-b" style="text-align:center;padding:40px"><div style="font-size:48px">💊</div><p style="color:var(--t3);margin-top:12px">Sin fórmulas registradas</p></div></div></div>`;

  const renderRx = f => {
    const meds = (f.medicamentos || []).filter(Boolean);
    return `<div class="rx-wrap">
      <div class="rx-header">
        <div>
          <div style="font-size:10px;opacity:.7">FÓRMULA ELECTRÓNICA · SmartHealth AI</div>
          <div style="font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:800;margin-top:2px">Resolución 2654/2019 · Colombia</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px">${f.hash}</div>
          <span class="badge" style="background:rgba(255,255,255,.15);color:#fff;margin-top:6px;display:inline-flex">Vigente ✓</span>
        </div>
      </div>
      <div class="rx-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          <div><div style="font-size:9px;color:var(--t3);font-weight:700">DIAGNÓSTICO</div><div style="font-weight:600;font-size:12px">${f.diagnostico}</div></div>
          <div><div style="font-size:9px;color:var(--t3);font-weight:700">FARMACIA</div><div style="font-weight:600;font-size:13px">${f.farmacia}</div></div>
          <div><div style="font-size:9px;color:var(--t3);font-weight:700">ESTADO</div><span class="badge ${estadoClass(f.estado)}">${f.estado.replace('_',' ')}</span></div>
        </div>
        ${meds.map((m,i)=>`<div class="rx-med-row"><div class="rx-med-num">${i+1}</div><div><div style="font-weight:700;font-size:13px">${m.nombre}</div><div style="font-size:11px;color:var(--t3)">${m.dosis} · ${m.duracion}</div></div></div>`).join('')}
        ${f.observaciones ? `<div style="margin-top:10px;padding:9px;background:var(--bg);border-radius:7px;font-size:12px"><strong>Obs:</strong> ${f.observaciones}</div>` : ''}
        <div style="margin-top:12px;display:flex;gap:7px;flex-wrap:wrap">
          ${f.estado==='en_camino' ? `<button class="btn btn-primary btn-sm" onclick="nav('rastreo')">📦 Rastrear</button><button class="btn btn-success btn-sm" onclick="confirmarRecepcion('${f.id}')">✅ Confirmar recepción</button>` : ''}
          ${f.estado==='entregado'&&!f.rating ? `<button class="btn btn-outline btn-sm" onclick="abrirRating('${f.id}')">⭐ Calificar entrega</button>` : ''}
          ${f.rating ? `<span style="font-size:12px;color:var(--t3)">${'⭐'.repeat(f.rating)} ${f.rating}/5</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  return `<div class="page">
    <div class="page-hdr"><div><h1>Mis Fórmulas Médicas</h1><p>Recetas electrónicas emitidas</p></div></div>
    ${fms.map(renderRx).join('')}
  </div>`;
},

// ─── RASTREO ─────────────────────────────────────────────────────
async rastreo() {
  const fms = await ApiFormulas.getAll().catch(() => []);
  const f   = fms.find(x => x.estado === 'en_camino');
  if (!f) return `<div class="page"><div class="page-hdr"><div><h1>Rastrear Pedido</h1></div></div><div class="card"><div class="card-b" style="text-align:center;padding:40px"><div style="font-size:48px">📭</div><p style="color:var(--t3);margin-top:10px">Sin pedidos activos</p><button class="btn btn-primary" style="margin-top:14px" onclick="nav('formulas')">Ver mis fórmulas</button></div></div></div>`;
  const meds = (f.medicamentos||[]).filter(Boolean);
  return `<div class="page">
    <div class="page-hdr"><div><h1>Rastrear Pedido</h1><p>${f.hash} · ${f.farmacia}</p></div></div>
    <div class="g2">
      <div class="card">
        <div class="card-h"><span>🚚</span><div class="card-title">${f.hash}</div><span class="badge bg-blue">En camino</span></div>
        <div class="card-b">
          <div style="background:var(--bg);border-radius:9px;padding:13px;margin-bottom:16px">
            ${meds.map(m=>`<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>💊 ${m.nombre}</span><span style="color:var(--green);font-weight:600">✓</span></div>`).join('')}
            <div style="border-top:1px solid var(--border);margin-top:9px;padding-top:9px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--t3)">Farmacia</span><strong>${f.farmacia}</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--t3)">Tiempo estimado</span><strong style="color:var(--blue)">~25 minutos</strong></div>
            </div>
          </div>
          <div class="tracker-list">
            <div class="track-step done"><div class="track-ic">✓</div><div><div class="track-label">Fórmula generada</div><div class="track-sub">${f.creado_en?.slice(0,10)}</div></div></div>
            <div class="track-step done"><div class="track-ic">✓</div><div><div class="track-label">Receta validada</div></div></div>
            <div class="track-step done"><div class="track-ic">✓</div><div><div class="track-label">Medicamento preparado</div></div></div>
            <div class="track-step active"><div class="track-ic">🛵</div><div><div class="track-label">En camino</div><div class="track-sub">~25 min</div></div></div>
            <div class="track-step"><div class="track-ic">📬</div><div><div class="track-label">Entregado</div></div></div>
          </div>
          <button class="btn btn-success" style="width:100%;margin-top:14px" onclick="confirmarRecepcion('${f.id}')">✅ Confirmar recepción</button>
        </div>
      </div>
      <div id="leaflet-map" style="height:400px;border-radius:var(--r);overflow:hidden;z-index:1"></div>
    </div>
  </div>`;
},

// ─── HISTORIA CLÍNICA ────────────────────────────────────────────
async historia() {
  return `<div class="page">
    <div class="page-hdr"><div><h1>Historia Clínica Digital</h1><p>${App.user.nombre} ${App.user.apellido} · ID: PAC-2026-00089</p></div></div>
    <div class="g2">
      <div class="card" style="max-width:250px">
        <div class="card-b">
          <div style="text-align:center;margin-bottom:14px">
            <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--teal));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;margin:0 auto 8px">${App.user.avatar||'?'}</div>
            <div style="font-weight:800;font-size:15px">${App.user.nombre} ${App.user.apellido}</div>
            <div style="font-size:11px;color:var(--t3)">PAC-2026-00089</div>
          </div>
          ${[['Edad','45 años'],['Sexo','Femenino'],['Sangre','O+'],['EPS','Salud Total'],['Tel','310-2234567']].map(([l,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--t3)">${l}</span><span style="font-weight:600">${v}</span></div>`).join('')}
          <div style="margin-top:10px"><div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:5px">ALERGIAS</div><span class="badge bg-red">Penicilina</span>&nbsp;<span class="badge bg-orange">Ibuprofeno</span></div>
        </div>
      </div>
      <div class="card" style="flex:1">
        <div class="card-b" style="padding-top:0">
          <div class="tabs">
            <div class="tab active" onclick="switchTab(this,'hc1')">Diagnósticos</div>
            <div class="tab" onclick="switchTab(this,'hc2')">Medicamentos</div>
            <div class="tab" onclick="switchTab(this,'hc3')">Laboratorios</div>
            <div class="tab" onclick="switchTab(this,'hc4')">Evolución</div>
          </div>
          <div id="hc1" class="tab-panel active">
            <table class="tbl"><thead><tr><th>Fecha</th><th>Diagnóstico (CIE-10)</th><th>Estado</th></tr></thead><tbody>
              <tr><td>Ene 2023</td><td>I10 — Hipertensión arterial esencial</td><td><span class="badge bg-orange">Crónico</span></td></tr>
              <tr><td>Mar 2023</td><td>E11 — Diabetes mellitus tipo 2</td><td><span class="badge bg-orange">Crónico</span></td></tr>
              <tr><td>Jun 2024</td><td>E78.0 — Hipercolesterolemia</td><td><span class="badge bg-blue">Controlada</span></td></tr>
            </tbody></table>
          </div>
          <div id="hc2" class="tab-panel"><table class="tbl"><thead><tr><th>Medicamento</th><th>Dosis</th><th>Desde</th><th>Estado</th></tr></thead><tbody>
            <tr><td>Losartán 50mg</td><td>1/día</td><td>Ene 2023</td><td><span class="badge bg-green">Activo</span></td></tr>
            <tr><td>Metformina 850mg</td><td>2/día</td><td>Mar 2023</td><td><span class="badge bg-green">Activo</span></td></tr>
            <tr><td>Atorvastatina 20mg</td><td>1/noche</td><td>Jun 2024</td><td><span class="badge bg-green">Activo</span></td></tr>
          </tbody></table></div>
          <div id="hc3" class="tab-panel"><table class="tbl"><thead><tr><th>Examen</th><th>Resultado</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
            <tr><td>Glucemia ayunas</td><td>126 mg/dL</td><td>15 Mar 2026</td><td><span class="badge bg-orange">Alta</span></td></tr>
            <tr><td>HbA1c</td><td>7.2%</td><td>15 Mar 2026</td><td><span class="badge bg-orange">Límite</span></td></tr>
            <tr><td>TA</td><td>138/88 mmHg</td><td>20 Mar 2026</td><td><span class="badge bg-orange">Elevada</span></td></tr>
            <tr><td>Colesterol</td><td>185 mg/dL</td><td>15 Mar 2026</td><td><span class="badge bg-green">Normal</span></td></tr>
          </tbody></table></div>
          <div id="hc4" class="tab-panel">
            <div class="act-feed">
              <div class="act-item"><div class="act-dot" style="background:var(--blue)"></div><div><div class="act-text"><strong>Dr. Mejía:</strong> TA 138/88. Glucemia 126. Ajuste de dosis. Control en 30 días.</div><div class="act-time">20 Mar 2026</div></div></div>
              <div class="act-item"><div class="act-dot" style="background:var(--green)"></div><div><div class="act-text"><strong>Dra. Ríos:</strong> Ecocardiograma normal. FEVI 65%. Mantiene tratamiento.</div><div class="act-time">02 Feb 2026</div></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
},

// ─── AGENDA (médico) ─────────────────────────────────────────────
async agenda() {
  const [citas, formulas] = await Promise.all([ApiCitas.getAll().catch(()=>[]), ApiFormulas.getAll().catch(()=>[])]);
  const priB = { critica:'bg-red', alta:'bg-orange', media:'bg-blue', baja:'bg-green' };
  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Agenda Médica</h1><p>Dr. ${App.user.nombre} ${App.user.apellido}</p></div>
      <button class="btn btn-primary" onclick="abrirFormula()">✍️ Nueva fórmula</button>
    </div>
    <div class="stats stats-3" style="margin-bottom:18px">
      <div class="stat"><div class="stat-ic" style="background:var(--blue-l)">📅</div><div class="stat-lbl">Citas hoy</div><div class="stat-val">${citas.filter(c=>c.estado==='activa').length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--orange-l)">⚠️</div><div class="stat-lbl">Urgentes</div><div class="stat-val">${citas.filter(c=>c.prioridad==='alta'||c.prioridad==='critica').length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--green-l)">✍️</div><div class="stat-lbl">Fórmulas emitidas</div><div class="stat-val">${formulas.length}</div></div>
    </div>
    <div class="card">
      <div class="card-h"><span>🗓️</span><div class="card-title">Pacientes del día — por prioridad clínica</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl"><thead><tr><th>Hora</th><th>Paciente</th><th>Motivo</th><th>Prioridad</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>${citas.filter(c=>c.estado==='activa').map((c,i)=>`<tr>
          <td style="font-weight:700">${c.hora?.slice(0,5)}</td>
          <td><div style="font-weight:600;font-size:13px">${c.paciente_nombre||'Paciente'}</div></td>
          <td style="font-size:12px;max-width:180px">${c.motivo}</td>
          <td><span class="badge ${priB[c.prioridad]||'bg-gray'}">${c.prioridad}</span></td>
          <td><span class="badge ${i===0?'bg-green':'bg-orange'}">${i===0?'Atendida':'En espera'}</span></td>
          <td><button class="btn btn-primary btn-sm" onclick="abrirFormula('${c.paciente_nombre||''}','${c.motivo||''}')">Prescribir</button></td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">No hay citas</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
},

// ─── PRESCRIBIR ──────────────────────────────────────────────────
async prescribir() {
  const fms = await ApiFormulas.getAll().catch(() => []);
  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Prescribir</h1><p>Fórmulas médicas electrónicas</p></div>
      <button class="btn btn-primary btn-lg" onclick="abrirFormula()">✍️ Nueva fórmula</button>
    </div>
    <div class="card">
      <div class="card-h"><span>📋</span><div class="card-title">Fórmulas emitidas por mí</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl"><thead><tr><th>ID</th><th>Paciente</th><th>Diagnóstico</th><th>Fecha</th><th>Estado</th></tr></thead>
        <tbody>${fms.map(f=>`<tr><td style="font-family:'JetBrains Mono',monospace;font-size:10px">${f.hash}</td><td>${f.paciente_nombre||'Paciente'}</td><td>${f.diagnostico}</td><td>${f.creado_en?.slice(0,10)}</td><td><span class="badge ${estadoClass(f.estado)}">${f.estado}</span></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--t3)">Sin fórmulas emitidas</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
},

// ─── FARMACIA ────────────────────────────────────────────────────
async farmacia() {
  const fms = await ApiFormulas.getAll().catch(() => []);
  const pending = fms.filter(f => f.estado === 'en_camino');
  return `<div class="page">
    <div class="page-hdr"><div><h1>Gestión de Farmacia</h1><p>${App.user.nombre} ${App.user.apellido} · Cruz Verde, Pereira</p></div></div>
    <div class="stats stats-3" style="margin-bottom:18px">
      <div class="stat"><div class="stat-ic" style="background:var(--orange-l)">📋</div><div class="stat-lbl">Recetas pendientes</div><div class="stat-val">${pending.length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--blue-l)">📦</div><div class="stat-lbl">En preparación</div><div class="stat-val">5</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--green-l)">✅</div><div class="stat-lbl">Entregados hoy</div><div class="stat-val">18</div></div>
    </div>
    <div class="card">
      <div class="card-h"><span>📋</span><div class="card-title">Recetas — validación de stock en tiempo real</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl"><thead><tr><th>ID Fórmula</th><th>Paciente</th><th>Medicamentos</th><th>Prioridad</th><th>Acciones</th></tr></thead>
        <tbody>
          ${pending.length === 0
            ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--t3)">Sin recetas pendientes en este momento</td></tr>'
            : pending.map(f => {
                const meds = (f.medicamentos||[]).filter(Boolean);
                return `<tr>
                  <td style="font-family:'JetBrains Mono',monospace;font-size:10px">${f.hash}</td>
                  <td>${f.paciente_nombre||'Paciente'}</td>
                  <td style="font-size:12px">${meds.map(m=>m.nombre).join(', ')}</td>
                  <td><span class="badge bg-orange">Alta</span></td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-success btn-sm" onclick="validarRecetaFarmacia('${f.id}','${f.farmacia||'Cruz Verde'}')">✓ Validar</button>
                    <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="toast('err','❌ Rechazada','Se notificó al médico')">Rechazar</button>
                  </td>
                </tr>`;
              }).join('')}
        </tbody></table>
      </div>
    </div>
  </div>`;
},

// ─── INVENTARIO ──────────────────────────────────────────────────
async inventario() {
  const inv = await ApiInventario.getAll().catch(() => []);
  const canEdit = ['superadmin','admin','farmacia'].includes(App.user.rol);
  const isSA    = App.user.rol === 'superadmin';
  const today   = Date.now();
  const soon90  = today + 90*86400000;
  const noStock  = inv.filter(i => i.stock === 0);
  const lowStock = inv.filter(i => i.stock > 0 && i.stock <= i.stock_min);
  const expiring = inv.filter(i => i.vencimiento && new Date(i.vencimiento).getTime() <= soon90 && i.stock > 0);

  const rows = inv.map(i => {
    const pct = i.stock === 0 ? 0 : Math.min(100, Math.round(i.stock / Math.max(i.stock, i.stock_min * 3) * 100));
    const col = i.stock === 0 ? 'var(--red)' : i.stock <= i.stock_min ? 'var(--orange)' : 'var(--green)';
    const stCls = i.stock === 0 ? 'bg-red' : i.stock <= i.stock_min ? 'bg-orange' : 'bg-green';
    const stLbl = i.stock === 0 ? '✗ Sin stock' : i.stock <= i.stock_min ? '⚠ Stock bajo' : '✓ Disponible';
    const vDate = i.vencimiento ? new Date(i.vencimiento).getTime() : null;
    const expW  = vDate && vDate <= soon90 ? ' ⚠️' : '';
    return `<tr>
      <td><strong>${i.nombre}</strong></td>
      <td style="font-size:12px">${i.presentacion}</td>
      <td><span class="badge bg-gray">${i.farmacia}</span></td>
      <td><strong>${i.stock}</strong> unid.</td>
      <td style="min-width:90px"><div class="inv-bar"><div class="inv-fill" style="width:${pct}%;background:${col}"></div></div></td>
      <td style="font-size:12px">${i.precio ? '$'+Number(i.precio).toLocaleString('es-CO') : '—'}</td>
      <td style="font-size:11px;color:${expW?'var(--orange)':'var(--t3)'}">${i.vencimiento||'—'}${expW}</td>
      <td><span class="badge ${stCls}">${stLbl}</span></td>
      ${canEdit ? `<td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="openInvModal('${i.id}')">✏️</button>
          <button class="btn btn-outline btn-sm" onclick="ajustarStock('${i.id}',10)">+10</button>
          ${isSA ? `<button class="btn btn-danger btn-sm" onclick="deleteInv('${i.id}','${i.nombre}')">🗑️</button>` : ''}
        </div>
      </td>` : ''}
    </tr>`;
  }).join('');

  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Inventario Farmacéutico</h1><p>Stock en tiempo real · ${inv.length} medicamentos</p></div>
      <div class="page-hdr-actions">
        <button class="btn btn-outline" onclick="nav('inventario')">🔄 Actualizar</button>
        ${canEdit ? `<button class="btn ${isSA?'btn-gold':'btn-primary'}" onclick="openInvModal(null)">+ Agregar${isSA?' ⭐':''}</button>` : ''}
      </div>
    </div>
    ${noStock.length  ? `<div class="alert-banner alert-red"><span>🚨</span><div><strong>Sin stock:</strong> ${noStock.map(i=>i.nombre+' ('+i.farmacia+')').join(', ')} — El sistema buscará en otras farmacias al validar.</div></div>` : ''}
    ${lowStock.length ? `<div class="alert-banner alert-orange"><span>⚠️</span><div><strong>Stock bajo:</strong> ${lowStock.map(i=>i.nombre+': '+i.stock+' unid.').join(', ')}</div></div>` : ''}
    ${expiring.length ? `<div class="alert-banner alert-orange"><span>📅</span><div><strong>Vence pronto:</strong> ${expiring.map(i=>i.nombre+' — '+i.vencimiento).join(', ')}</div></div>` : ''}
    <div style="display:flex;gap:9px;margin-bottom:12px">
      <input id="inv-search" class="form-input" style="flex:1" placeholder="🔍 Buscar medicamento..." oninput="filterInvTable(this.value)">
      <select id="inv-farm-f" class="form-input" style="width:auto" onchange="filterInvTable(document.getElementById('inv-search').value)">
        <option value="">Todas las farmacias</option>
        <option>Cruz Verde</option><option>Comfamiliar</option><option>La Rebaja</option>
      </select>
    </div>
    <div class="card">
      <div class="card-b card-b-flush">
        <table class="tbl" id="inv-table">
          <thead><tr><th>Medicamento</th><th>Presentación</th><th>Farmacia</th><th>Stock</th><th>Disponibilidad</th><th>Precio</th><th>Vence</th><th>Estado</th>${canEdit?'<th>Acciones</th>':''}</tr></thead>
          <tbody id="inv-tbody">${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
},

// ─── USUARIOS ────────────────────────────────────────────────────
async usuarios() {
  if (!['admin','superadmin'].includes(App.user.rol)) return `<div class="page"><div class="page-hdr"><h1>Acceso denegado</h1></div></div>`;
  const users = await ApiUsuarios.getAll().catch(() => []);
  const rolBadge = { paciente:'bg-blue', medico:'bg-purple', farmacia:'bg-teal', admin:'bg-red', superadmin:'bg-gold' };
  return `<div class="page">
    <div class="page-hdr"><div><h1>Gestión de Usuarios</h1><p>${users.length} usuarios registrados</p></div></div>
    <div class="card">
      <div class="card-h"><span>👥</span><div class="card-title">Todos los usuarios</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Acciones</th></tr></thead>
        <tbody>${users.map(u=>`<tr>
          <td><div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${u.color||'#666'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;flex-shrink:0">${u.avatar||'?'}</div>
            <span style="font-weight:600">${u.nombre} ${u.apellido}</span>
          </div></td>
          <td style="font-size:12px;color:var(--t3)">${u.email}</td>
          <td><span class="badge ${rolBadge[u.rol]||'bg-gray'}">${u.rol}</span></td>
          <td><span class="badge ${u.activo?'bg-green':'bg-red'}">${u.activo?'Activo':'Suspendido'}</span></td>
          <td style="font-size:11px;color:var(--t3)">${u.ultimo_login ? new Date(u.ultimo_login).toLocaleDateString('es-CO') : 'Nunca'}</td>
          <td>${u.id===App.user.id ? `<span style="font-size:11px;color:var(--t3)">Eres tú</span>` : `
            <div style="display:flex;gap:5px">
              <button class="btn btn-outline btn-sm" onclick="toggleUser('${u.id}','${u.nombre} ${u.apellido}')">${u.activo?'Suspender':'Activar'}</button>
              <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}','${u.nombre} ${u.apellido}')">🗑️ Eliminar</button>
            </div>`}
          </td>
        </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  </div>`;
},

// ─── ADMIN PANEL ─────────────────────────────────────────────────
async admin() {
  const [users, citas, fms, inv, logs] = await Promise.all([
    ApiUsuarios.getAll().catch(()=>[]),
    ApiCitas.getAll().catch(()=>[]),
    ApiFormulas.getAll().catch(()=>[]),
    ApiInventario.getAll().catch(()=>[]),
    ApiAudit.getAll().catch(()=>[]),
  ]);
  const noStock = inv.filter(i=>i.stock===0).length;
  const lastLogs = logs.slice(0,6);
  return `<div class="page">
    <div class="page-hdr"><div><h1>${App.user.rol==='superadmin'?'⭐ ':''}Panel de Administración</h1><p>Control total del sistema SmartHealth AI</p></div></div>
    ${noStock>0 ? `<div class="alert-banner alert-red"><span>🚨</span><div><strong>${noStock} medicamentos sin stock.</strong> <span style="cursor:pointer;font-weight:700;text-decoration:underline" onclick="nav('inventario')">Revisar inventario →</span></div></div>` : ''}
    <div class="stats stats-4" style="margin-bottom:18px">
      <div class="stat"><div class="stat-ic" style="background:var(--blue-l)">👥</div><div class="stat-lbl">Usuarios</div><div class="stat-val">${users.length}</div><div class="stat-sub">${users.filter(u=>u.activo).length} activos</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--green-l)">📅</div><div class="stat-lbl">Citas totales</div><div class="stat-val">${citas.length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--orange-l)">💊</div><div class="stat-lbl">Fórmulas</div><div class="stat-val">${fms.length}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--teal-l)">⬆️</div><div class="stat-lbl">Uptime</div><div class="stat-val" style="font-size:20px">99.9%</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h"><span>📊</span><div class="card-title">Monitoreo del sistema</div></div>
        <div class="card-b">
          ${[['CPU','23%',23,'green'],['RAM','48%',48,'green'],['Storage','35%',35,'green'],['API req/min','1,240',62,'blue']].map(([l,v,p,c])=>`
          <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${l}</span><span style="font-weight:600">${v}</span></div>
          <div class="inv-bar"><div class="inv-fill" style="width:${p}%;background:var(--${c})"></div></div></div>`).join('')}
          <div style="padding:10px;background:var(--green-l);border-radius:8px;display:flex;gap:8px;align-items:center">
            <span>✅</span><div><div style="font-weight:700;font-size:13px;color:#065f46">Todos los servicios operativos</div><div style="font-size:11px;color:#047857">API · PostgreSQL · IA · Leaflet</div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><span>🔍</span><div class="card-title">Últimos eventos</div><button class="btn btn-outline btn-sm" onclick="nav('auditoria')">Ver todo</button></div>
        <div class="card-b act-feed">
          ${lastLogs.length===0 ? '<p style="color:var(--t3);font-size:13px">Sin eventos registrados aún.</p>'
            : lastLogs.map(l=>`<div class="act-item"><div class="act-dot" style="background:var(--blue)"></div><div><div class="act-text" style="font-size:12px">${l.accion}</div><div class="act-time">${new Date(l.creado_en).toLocaleString('es-CO')} · ${l.user_nombre||'Sistema'}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="g3" style="margin-top:14px">
      <div class="card" style="cursor:pointer" onclick="nav('usuarios')"><div class="card-b" style="text-align:center;padding:20px"><div style="font-size:32px">👥</div><div style="font-weight:700;margin-top:8px">Gestionar usuarios</div><div style="font-size:12px;color:var(--t3)">Crear · Suspender · Eliminar</div></div></div>
      <div class="card" style="cursor:pointer" onclick="nav('inventario')"><div class="card-b" style="text-align:center;padding:20px"><div style="font-size:32px">📦</div><div style="font-weight:700;margin-top:8px">Inventario</div><div style="font-size:12px;color:var(--t3)">${noStock} sin stock</div></div></div>
      <div class="card" style="cursor:pointer" onclick="nav('auditoria')"><div class="card-b" style="text-align:center;padding:20px"><div style="font-size:32px">🔍</div><div style="font-weight:700;margin-top:8px">Auditoría</div><div style="font-size:12px;color:var(--t3)">${logs.length} eventos</div></div></div>
    </div>
  </div>`;
},

// ─── LOGÍSTICA ───────────────────────────────────────────────────
async logistica() {
  const fms = await ApiFormulas.getAll().catch(() => []);
  const activas  = fms.filter(f => ['pendiente','preparando','en_camino'].includes(f.estado));
  const entregadas = fms.filter(f => f.estado === 'entregado').length;
  const pendientes = fms.filter(f => f.estado === 'pendiente').length;
  const enCamino   = fms.filter(f => f.estado === 'en_camino').length;
  const preparando = fms.filter(f => f.estado === 'preparando').length;

  const estadoBadge = {
    pendiente:  '<span class="badge bg-orange">⏳ Pendiente</span>',
    preparando: '<span class="badge bg-teal">📦 Preparando</span>',
    en_camino:  '<span class="badge bg-blue">🛵 En camino</span>',
    entregado:  '<span class="badge bg-green">✅ Entregado</span>',
  };

  const rows = activas.length === 0
    ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">No hay entregas activas en este momento</td></tr>'
    : activas.map(f => {
        const meds = (f.medicamentos||[]).filter(m=>m&&m.nombre).map(m=>m.nombre).join(', ');
        return `<tr>
          <td style="font-family:'JetBrains Mono',monospace;font-size:10px">${f.hash}</td>
          <td>${f.paciente_nombre||'Paciente'}</td>
          <td style="font-size:12px">${meds||'—'}</td>
          <td><span class="badge bg-gray">${f.farmacia||'—'}</span></td>
          <td>${estadoBadge[f.estado]||f.estado}</td>
          <td style="white-space:nowrap;display:flex;gap:4px">
            ${f.estado==='pendiente' ? `
              <button class="btn btn-primary btn-sm" onclick="despacharPedido('${f.id}')">🚚 Despachar</button>` : ''}
            ${f.estado==='en_camino' ? `
              <button class="btn btn-success btn-sm" onclick="confirmarRecepcionAdmin('${f.id}')">✅ Entregado</button>` : ''}
            ${f.estado==='preparando' ? `
              <button class="btn btn-primary btn-sm" onclick="despacharPedido('${f.id}')">🛵 En camino</button>` : ''}
          </td>
        </tr>`;
      }).join('');

  return `<div class="page">
    <div class="page-hdr"><div><h1>Logística y Entregas</h1><p>Gestión de pedidos en tiempo real</p></div>
      <button class="btn btn-outline" onclick="App.nav('logistica')">🔄 Actualizar</button>
    </div>
    <div class="stats stats-4" style="margin-bottom:18px">
      <div class="stat"><div class="stat-ic" style="background:var(--orange-l)">⏳</div><div class="stat-lbl">Pendientes</div><div class="stat-val">${pendientes}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--teal-l)">📦</div><div class="stat-lbl">Preparando</div><div class="stat-val">${preparando}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--blue-l)">🛵</div><div class="stat-lbl">En camino</div><div class="stat-val">${enCamino}</div></div>
      <div class="stat"><div class="stat-ic" style="background:var(--green-l)">✅</div><div class="stat-lbl">Entregados hoy</div><div class="stat-val">${entregadas}</div></div>
    </div>
    <div class="card">
      <div class="card-h"><span>🚚</span><div class="card-title">Entregas activas — datos reales</div></div>
      <div class="card-b card-b-flush">
        <table class="tbl">
          <thead><tr><th>Hash</th><th>Paciente</th><th>Medicamentos</th><th>Farmacia</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
},


// ─── AUDITORÍA ───────────────────────────────────────────────────
async auditoria() {
  const logs = await ApiAudit.getAll().catch(() => []);
  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Log de Auditoría</h1><p>${logs.length} eventos registrados</p></div>
      <button class="btn btn-outline" onclick="showConfirm('🗑️','¿Limpiar log?','Se eliminarán todos los eventos de auditoría permanentemente.','Limpiar','btn-danger',()=>ApiAudit.clear().then(()=>{toast('ok','🗑️ Log limpiado','');nav('auditoria');}))">🗑️ Limpiar</button>
    </div>
    <div class="card">
      <div class="card-b card-b-flush">
        ${logs.length===0 ? '<p style="text-align:center;padding:30px;color:var(--t3)">Sin eventos</p>'
          : `<table class="tbl"><thead><tr><th>Fecha/Hora</th><th>Acción</th><th>Usuario</th></tr></thead>
             <tbody>${logs.map(l=>`<tr><td style="font-family:'JetBrains Mono',monospace;font-size:10px;white-space:nowrap">${new Date(l.creado_en).toLocaleString('es-CO')}</td><td style="font-size:13px">${l.accion}</td><td style="font-size:11px;color:var(--t3)">${l.user_nombre||'Sistema'}</td></tr>`).join('')}</tbody>
             </table>`}
      </div>
    </div>
  </div>`;
},

// ─── NOTIFICACIONES ──────────────────────────────────────────────
async notificaciones() {
  const notifs = await ApiNotif.getAll().catch(() => []);
  const unread = notifs.filter(n => !n.leida).length;
  return `<div class="page">
    <div class="page-hdr">
      <div><h1>Notificaciones</h1><p>${unread} sin leer</p></div>
      ${unread>0 ? `<button class="btn btn-outline" onclick="App.markAllRead()">Marcar todas como leídas</button>` : ''}
    </div>
    <div class="card">
      <div class="card-b act-feed">
        ${notifs.length===0 ? '<p style="text-align:center;padding:20px;color:var(--t3)">Sin notificaciones</p>'
          : notifs.map(n=>`<div class="act-item" style="opacity:${n.leida?.65:1};cursor:pointer" onclick="ApiNotif.markRead('${n.id}').then(()=>{App._updateNotifBadge();App.nav('notificaciones')})">
              <div class="act-dot" style="background:${n.tipo==='ok'?'var(--green)':n.tipo==='warn'?'var(--orange)':'var(--blue)'}"></div>
              <div style="flex:1"><div class="act-text" style="font-weight:${n.leida?400:600}">${n.mensaje}</div>
              <div class="act-time">${new Date(n.creado_en).toLocaleString('es-CO')}</div></div>
              ${!n.leida ? '<span class="badge bg-blue" style="font-size:9px">Nuevo</span>' : ''}
            </div>`).join('')}
      </div>
    </div>
  </div>`;
},

// ─── ASISTENTE IA ─────────────────────────────────────────────────
async asistente() {
  return `<div class="page">
    <div class="page-hdr"><div><h1>🤖 Asistente SmartHealth AI</h1><p>Pregúntame sobre salud, medicamentos, citas o el sistema</p></div></div>
    <div class="card">
      <div class="card-b">
        <div id="chat-messages" class="chat-messages">
          <div class="chat-ai-msg"><div class="ai-result">¡Hola! Soy el asistente de SmartHealth AI. Puedo ayudarte con preguntas sobre medicamentos, síntomas, citas médicas o cómo usar el sistema. ¿En qué te puedo ayudar?</div></div>
        </div>
        <div style="display:flex;gap:9px">
          <input id="chat-input" class="form-input" style="flex:1" placeholder="Escribe tu consulta..." onkeydown="if(event.key==='Enter')App.chatSend()">
          <button class="btn btn-primary" onclick="App.chatSend()">Enviar →</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          ${['¿Qué medicamentos tengo activos?','¿Cómo agendar una cita?','Interacciones del Losartán','¿Síntomas de hipertensión?'].map(q=>`<button class="btn btn-ghost btn-sm" style="font-size:11px;border:1px solid var(--border)" onclick="document.getElementById('chat-input').value='${q}';App.chatSend()">${q}</button>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
},

};
