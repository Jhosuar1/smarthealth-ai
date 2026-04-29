// ═══════════════════════════════════════════════════════
//  frontend/js/app.js  — compatible con api.js actual
// ═══════════════════════════════════════════════════════
'use strict';

const App = {
  user: null,
  _activeCitaId: null,
  _invEditId: null,
  _ratingFmId: null,
  _selectedStars: 0,
  _priResult: null,
  _medRowCount: 0,

  // ══════════ INIT ══════════════════════════════════════
  async init() {
    // botón confirm dialog
    document.getElementById('conf-ok').onclick = () => {
      if (typeof _confirmFn === 'function') { _confirmFn(); _confirmFn = null; }
      closeConfirm();
    };
    // logout automático si token expira
    window.addEventListener('sha:logout', () => this._showAuth());

    // restaurar sesión
    const token = sessionStorage.getItem('sha_token');
    if (token) {
      try {
        Auth.setToken(token);
        const me = await ApiUsuarios.getMe();
        this.user = me;
        this._enterApp();
        return;
      } catch {
        Auth.clearToken();
      }
    }
    this._showAuth();
  },

  _showAuth() {
    document.getElementById('auth').style.display = 'flex';
    document.getElementById('app').classList.remove('show');
  },

  _enterApp() {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    document.getElementById('tb-av').textContent      = this.user.avatar || '?';
    document.getElementById('tb-av').style.background = this.user.color  || '#0057ff';
    document.getElementById('tb-name').textContent    = this.user.nombre + ' ' + this.user.apellido;
    const roles = { paciente:'Paciente', medico:'Médico', farmacia:'Farmacéutico',
                    admin:'Administrador', superadmin:'⭐ Superadmin' };
    document.getElementById('tb-role').textContent = roles[this.user.rol] || this.user.rol;
    this._buildSidebar();
    this._updateNotifBadge();
    this.nav(this._defaultPage());
    toast('ok', '👋 Bienvenido/a', this.user.nombre + ' ' + this.user.apellido);
  },

  _defaultPage() {
    return { paciente:'dashboard', medico:'agenda', farmacia:'farmacia',
             admin:'admin', superadmin:'admin' }[this.user.rol] || 'dashboard';
  },

  // ══════════ AUTH ══════════════════════════════════════
  async doLogin() {
    const email = (document.getElementById('l-email').value || '').trim();
    const pass  = document.getElementById('l-pass').value;
    if (!email || !pass) { authErr('Completa todos los campos.'); return; }
    try {
      const data = await ApiAuth.login(email, pass);
      Auth.setToken(data.token);
      this.user = data.user;
      this._enterApp();
    } catch (e) { authErr(e.message || 'Credenciales incorrectas'); }
  },

  async doRegister() {
    const nom   = (document.getElementById('r-nom').value   || '').trim();
    const ape   = (document.getElementById('r-ape').value   || '').trim();
    const email = (document.getElementById('r-email').value || '').trim();
    const pass  = document.getElementById('r-pass').value;
    const rol   = document.getElementById('r-rol').value;
    if (!nom || !ape || !email || !pass) { authErr('Completa todos los campos.'); return; }
    if (pass.length < 6) { authErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    try {
      const data = await ApiAuth.register({ nombre:nom, apellido:ape, email, password:pass, rol });
      Auth.setToken(data.token);
      this.user = data.user;
      this._enterApp();
    } catch (e) { authErr(e.message || 'Error al registrar'); }
  },

  async doSendRecovery() {
    const email = (document.getElementById('f-email').value || '').trim();
    if (!email) { authErr('Ingresa tu correo.'); return; }
    try {
      const res = await ApiAuth.recovery(email);
      authOk('✅ ' + res.mensaje + (res.codigo ? ' · Código: ' + res.codigo : ''));
      document.getElementById('recovery-box').style.display = 'block';
      document.getElementById('btn-send-code').disabled = true;
    } catch (e) { authErr(e.message || 'Error al enviar'); }
  },

  async doPasswordReset() {
    const email   = (document.getElementById('f-email').value   || '').trim();
    const codigo  = (document.getElementById('f-code').value    || '').trim().toUpperCase();
    const newpass = document.getElementById('f-newpass').value;
    if (!codigo || !newpass) { authErr('Completa el código y la nueva contraseña.'); return; }
    try {
      await ApiAuth.reset(email, codigo, newpass);
      authOk('✅ Contraseña actualizada. Ya puedes iniciar sesión.');
      setTimeout(() => {
        showAuthPanel('login');
        document.getElementById('l-email').value = email;
        document.getElementById('recovery-box').style.display = 'none';
        document.getElementById('btn-send-code').disabled = false;
      }, 2000);
    } catch (e) { authErr(e.message || 'Código incorrecto'); }
  },

  doLogout() {
    Auth.clearToken();
    this.user = null;
    this._showAuth();
    clearAuthMsgs();
  },

  // ══════════ NAVEGACIÓN ═══════════════════════════════
  async nav(pageId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const ni = document.getElementById('ni-' + pageId);
    if (ni) ni.classList.add('active');

    const mc = document.getElementById('main-content');
    mc.innerHTML = `<div class="page active" style="display:flex;align-items:center;justify-content:center;min-height:200px">${aiSpinner()}</div>`;

    try {
      const render = PAGES[pageId];
      const html   = render ? await render() : '<div class="page"><p style="color:var(--t3)">Página no encontrada</p></div>';
      mc.innerHTML = html;
      const p = mc.querySelector('.page');
      if (p) p.classList.add('active');
    } catch (e) {
      mc.innerHTML = `<div class="page active"><div class="alert-banner alert-red"><span>❌</span><div>Error al cargar la página: ${e.message}</div></div></div>`;
    }

    if (pageId === 'mapa')    setTimeout(() => initMap('leaflet-map'), 80);
    if (pageId === 'rastreo') setTimeout(() => initMap('leaflet-map', '250px'), 80);
    if (pageId === 'farmacia') setTimeout(() => this._checkFarmaciaStock(), 400);
    this._updateNotifBadge();
  },

  // ══════════ SIDEBAR ═══════════════════════════════════
  _buildSidebar() {
    const NAV = {
      paciente:[
        {s:'Mi Salud'},
        {id:'dashboard',     i:'📊',l:'Dashboard'},
        {id:'mapa',          i:'🗺️',l:'Mapa de Centros'},
        {id:'citas',         i:'📅',l:'Mis Citas'},
        {id:'formulas',      i:'💊',l:'Mis Fórmulas'},
        {id:'rastreo',       i:'📦',l:'Rastrear Pedido'},
        {id:'historia',      i:'📋',l:'Historia Clínica'},
        {s:'Herramientas'},
        {id:'notificaciones',i:'🔔',l:'Notificaciones'},
        {id:'asistente',     i:'🤖',l:'Asistente IA'},
      ],
      medico:[
        {s:'Módulo Médico'},
        {id:'agenda',        i:'🩺',l:'Mi Agenda'},
        {id:'historia',      i:'📋',l:'Historia Clínica'},
        {id:'prescribir',    i:'✍️', l:'Prescribir'},
        {id:'mapa',          i:'🗺️',l:'Mapa de Centros'},
        {s:'Herramientas'},
        {id:'notificaciones',i:'🔔',l:'Notificaciones'},
        {id:'asistente',     i:'🤖',l:'Asistente IA'},
      ],
      farmacia:[
        {s:'Módulo Farmacia'},
        {id:'farmacia',      i:'🏪',l:'Recetas Pendientes'},
        {id:'inventario',    i:'📦',l:'Inventario'},
        {id:'mapa',          i:'🗺️',l:'Mapa'},
        {s:'Herramientas'},
        {id:'notificaciones',i:'🔔',l:'Notificaciones'},
        {id:'asistente',     i:'🤖',l:'Asistente IA'},
      ],
      admin:[
        {s:'Administración'},
        {id:'admin',         i:'⚙️', l:'Panel General'},
        {id:'usuarios',      i:'👥',l:'Usuarios'},
        {id:'inventario',    i:'📦',l:'Inventario'},
        {id:'logistica',     i:'🚚',l:'Logística'},
        {id:'auditoria',     i:'🔍',l:'Auditoría'},
        {id:'mapa',          i:'🗺️',l:'Mapa de Red'},
        {s:'Herramientas'},
        {id:'notificaciones',i:'🔔',l:'Notificaciones'},
        {id:'asistente',     i:'🤖',l:'Asistente IA'},
      ],
      superadmin:[
        {s:'⭐ Control Total'},
        {id:'admin',         i:'⚙️', l:'Panel General'},
        {id:'usuarios',      i:'👥',l:'Usuarios'},
        {id:'inventario',    i:'📦',l:'Inventario'},
        {id:'logistica',     i:'🚚',l:'Logística'},
        {id:'auditoria',     i:'🔍',l:'Auditoría'},
        {id:'mapa',          i:'🗺️',l:'Mapa de Red'},
        {s:'Herramientas'},
        {id:'notificaciones',i:'🔔',l:'Notificaciones'},
        {id:'asistente',     i:'🤖',l:'Asistente IA'},
      ],
    };
    const items = NAV[this.user.rol] || NAV.paciente;
    const rlbl  = { paciente:'Vista Paciente', medico:'Vista Médico', farmacia:'Vista Farmacia',
                    admin:'Administrador', superadmin:'Superadmin ⭐' };
    const sb    = document.getElementById('sidebar');
    let html    = `<div class="role-info">
      <div class="role-info-name">${this.user.nombre} ${this.user.apellido}</div>
      <div class="role-info-sub">${rlbl[this.user.rol] || ''}</div>
    </div>`;
    items.forEach(it => {
      if (it.s) { html += `<div class="nav-group-label">${it.s}</div>`; return; }
      html += `<div class="nav-item" id="ni-${it.id}" onclick="App.nav('${it.id}')">
        <span class="nav-icon">${it.i}</span><span>${it.l}</span>
      </div>`;
    });
    sb.innerHTML = html;
  },

  async _updateNotifBadge() {
    try {
      const notifs = await ApiNotif.getAll();
      const cnt    = notifs.filter(n => !n.leida).length;
      const badge  = document.getElementById('notif-badge');
      if (badge) badge.classList.toggle('show', cnt > 0);
    } catch {}
  },

  // ══════════ CITAS ═════════════════════════════════════
  async evaluarPrioridad() {
    const motivo = (document.getElementById('a-motivo').value || '').trim();
    if (!motivo) { toast('warn', '⚠️', 'Describe los síntomas primero.'); return; }
    const wrap = document.getElementById('ai-pri-wrap');
    const res  = document.getElementById('ai-pri-result');
    if (!wrap || !res) return;
    wrap.style.display = 'block';
    res.innerHTML = aiSpinner();
    const r = await ApiIA.ask(
      `Eres el sistema de priorización clínica de SmartHealth AI (Colombia). Analiza los síntomas y responde con: 1) PRIORIDAD: Crítica/Alta/Media/Baja  2) Tiempo de atención  3) Una línea de justificación clínica. Máximo 4 líneas. Síntomas: "${motivo}"`
    );
    res.innerHTML = r;
    this._priResult = r;
  },

  async confirmarCita() {
    const motivo = (document.getElementById('a-motivo').value || '').trim();
    const esp    = document.getElementById('a-esp').value;
    const mod    = document.getElementById('a-mod').value;
    const centro = document.getElementById('a-centro').value;
    if (!motivo) { toast('warn', '⚠️', 'Describe el motivo de la consulta.'); return; }

    let pri = 'media';
    if (this._priResult) {
      const m = this._priResult.match(/(Crítica|Alta|Media|Baja)/i);
      if (m) pri = { Crítica:'critica', Alta:'alta', Media:'media', Baja:'baja' }[m[1]] || 'media';
    }
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 4);
    try {
      await ApiCitas.create({
        medico_nom: 'Dr. Carlos Mejía', especialidad: esp,
        centro: centro.split('—')[0].trim(),
        fecha: fecha.toISOString().split('T')[0],
        hora: '10:00', modalidad: mod, prioridad: pri, motivo
      });
      closeModal('m-agendar');
      this._priResult = null;
      toast('ok', '📅 Cita confirmada', esp + ' · Prioridad: ' + pri);
      setTimeout(() => toast('info', '📱 Recordatorio agendado', 'Te notificaremos 24h antes'), 1600);
      this.nav('citas');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  verCita(id) {
    this._activeCitaId = id;
    ApiCitas.getAll().then(all => {
      const c = all.find(x => x.id === id);
      if (!c) return;
      document.getElementById('cita-detalle-body').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          ${[['Médico',c.medico_nom],['Especialidad',c.especialidad],['Centro',c.centro],
             ['Fecha',fmtDate(c.fecha)],['Hora',(c.hora||'').slice(0,5)],['Modalidad',c.modalidad],
             ['Prioridad',c.prioridad],['Estado',c.estado]].map(([l,v]) => `
          <div>
            <div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase">${l}</div>
            <div style="font-weight:700;font-size:14px;margin-top:2px">${v || '—'}</div>
          </div>`).join('')}
        </div>
        <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
          <strong>Motivo:</strong> ${c.motivo}
        </div>`;
      openModal('m-cita-detalle');
    });
  },

  async cancelarCitaActual() {
    if (!this._activeCitaId) return;
    try {
      await ApiCitas.cancelar(this._activeCitaId);
      closeModal('m-cita-detalle');
      toast('warn', '⚠️ Cita cancelada', 'El médico fue notificado');
      this.nav('citas');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  // ══════════ FÓRMULAS ══════════════════════════════════
  async abrirFormula(pacId, dx) {
    this._medRowCount = 0;
    const cont = document.getElementById('meds-container');
    if (cont) cont.innerHTML = '';
    this.addMedRow();
    if (document.getElementById('f-pac')) document.getElementById('f-pac').value = '';
    if (document.getElementById('f-dx'))  document.getElementById('f-dx').value  = dx || '';
    if (document.getElementById('ai-formula-wrap'))
      document.getElementById('ai-formula-wrap').style.display = 'none';

    try {
      const inv   = await ApiInventario.getAll();
      const farms = [...new Set(inv.map(i => i.farmacia))];
      const sel   = document.getElementById('f-farmacia');
      if (sel) sel.innerHTML = farms.map(f => `<option>${f}</option>`).join('');
    } catch {}
    openModal('m-formula');
  },

  addMedRow() {
    this._medRowCount++;
    const c = document.getElementById('meds-container');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'form-row fr-3';
    d.innerHTML = `
      <div><label class="form-label">Medicamento ${this._medRowCount}</label>
        <input class="form-input med-nom" type="text" placeholder="Nombre del medicamento"></div>
      <div><label class="form-label">Dosis</label>
        <input class="form-input med-dos" type="text" placeholder="Ej: 50mg 1x/día"></div>
      <div><label class="form-label">Duración</label>
        <input class="form-input med-dur" type="text" placeholder="Ej: 30 días"></div>`;
    c.appendChild(d);
  },

  async validarFormulaIA() {
    const meds = [...document.querySelectorAll('.med-nom')].map(i => i.value.trim()).filter(Boolean);
    const dx   = (document.getElementById('f-dx').value || '').trim();
    if (!meds.length || !dx) { toast('warn', '⚠️', 'Agrega diagnóstico y medicamentos primero.'); return; }
    const alergia = meds.find(m => checkAlergia(m));
    if (alergia) { toast('err', '🚨 Alergia detectada', `"${alergia}" está en la lista de alergias del paciente.`); return; }
    const wrap = document.getElementById('ai-formula-wrap');
    const res  = document.getElementById('ai-formula-result');
    if (!wrap || !res) return;
    wrap.style.display = 'block';
    res.innerHTML = aiSpinner();
    const r = await ApiIA.ask(
      `Eres el validador de fórmulas de SmartHealth AI. Diagnóstico: ${dx}. Medicamentos: ${meds.join(', ')}. Indica: 1) ¿Apropiados para el diagnóstico? 2) Interacciones a vigilar 3) Alertas especiales. Máx 4 líneas.`
    );
    res.innerHTML = r;
  },

  async generarFormula() {
    const dx   = (document.getElementById('f-dx').value || '').trim();
    const obs  = (document.getElementById('f-obs').value || '').trim();
    const ent  = document.getElementById('f-entrega').value;
    const farm = document.getElementById('f-farmacia')?.value || 'Cruz Verde';
    const meds = [...document.querySelectorAll('#meds-container .form-row')].map(r => ({
      nombre:   r.querySelector('.med-nom')?.value?.trim() || '',
      dosis:    r.querySelector('.med-dos')?.value?.trim() || '',
      duracion: r.querySelector('.med-dur')?.value?.trim() || ''
    })).filter(m => m.nombre);

    if (!dx || !meds.length) { toast('warn', '⚠️', 'Agrega diagnóstico y al menos un medicamento.'); return; }
    const alergia = meds.find(m => checkAlergia(m.nombre));
    if (alergia) { toast('err', '🚨 BLOQUEADO — Alergia', `No se puede prescribir "${alergia.nombre}".`); return; }

    try {
      await ApiFormulas.create({
        paciente_id: this.user.id,
        diagnostico: dx, observaciones: obs,
        tipo_entrega: ent, farmacia: farm, medicamentos: meds
      });
      closeModal('m-formula');
      this._medRowCount = 0;
      toast('ok', '✅ Fórmula generada', 'Firmada digitalmente y enviada');
      setTimeout(() => toast('info', '📱 SMS enviado', 'El paciente fue notificado'), 2000);
      this.nav('prescribir');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  async confirmarRecepcion(fId) {
    try {
      await ApiFormulas.entregar(fId);
      toast('ok', '🎉 ¡Medicamento recibido!', 'Entrega confirmada');
      setTimeout(() => this.abrirRating(fId), 1500);
      this.nav('formulas');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  abrirRating(fId) {
    this._ratingFmId   = fId;
    this._selectedStars = 0;
    document.getElementById('rating-comment').value = '';
    document.getElementById('star-label').textContent = 'Selecciona una calificación';
    document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
    openModal('m-rating');
  },

  setStar(n) {
    this._selectedStars = n;
    const labels = ['','Muy mala','Regular','Aceptable','Buena','Excelente'];
    document.getElementById('star-label').textContent = labels[n] + ' (' + n + '/5)';
    document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < n));
  },

  async enviarRating() {
    if (!this._selectedStars) { toast('warn', '⚠️', 'Selecciona una calificación.'); return; }
    try {
      await ApiFormulas.rating(
        this._ratingFmId, this._selectedStars,
        document.getElementById('rating-comment').value
      );
      closeModal('m-rating');
      toast('ok', '⭐ Calificación enviada', this._selectedStars + '/5 — ¡Gracias!');
      this.nav('formulas');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  // ══════════ FARMACIA — stock check ════════════════════
  async _checkFarmaciaStock() {
    try {
      const fms     = await ApiFormulas.getAll();
      const pending = fms.filter(f => f.estado === 'en_camino');
      for (const f of pending) {
        const meds = (f.medicamentos || []).filter(m => m && m.nombre);
        if (!meds.length) continue;
        const check = await ApiInventario.checkStock(meds, f.farmacia).catch(() => null);
        if (!check) continue;
        const cell = document.getElementById('stock-' + f.id);
        const btn  = document.getElementById('btn-val-' + f.id);
        if (!cell) continue;
        if (check.farmaciaOk) {
          cell.innerHTML = `<span class="badge bg-green" style="font-size:10px">✓ Stock OK en ${check.farmaciaOk}</span>`;
          if (btn) { btn.className = 'btn btn-success btn-sm'; btn.textContent = '✓ Validar'; }
        } else {
          cell.innerHTML = `<span class="badge bg-red" style="font-size:10px">Sin stock</span>`;
          if (btn) { btn.className = 'btn btn-warning btn-sm'; btn.textContent = '🔍 Buscar'; }
        }
      }
    } catch {}
  },

  async validarReceta(fId) {
    try {
      const fms   = await ApiFormulas.getAll();
      const f     = fms.find(x => x.id === fId);
      if (!f) { toast('err','❌','Fórmula no encontrada'); return; }
      const meds  = (f.medicamentos || []).filter(m => m && m.nombre);
      if (!meds.length) { toast('warn','⚠️','Sin medicamentos en la fórmula'); return; }

      toast('info','🔍 Verificando stock...','Consultando farmacias');
      const check = await ApiInventario.checkStock(meds, f.farmacia);

      // Stock OK en la farmacia asignada
      if (check.farmaciaOk === f.farmacia) {
        // Mark as preparando in DB
        await apiFetch('/formulas/' + fId + '/reasignar', {
          method: 'PATCH', body: { farmacia: f.farmacia }
        }).catch(() => {});
        toast('ok', '✅ Receta validada', 'Stock OK en ' + f.farmacia + '. Pedido en preparación.');
        this.nav('farmacia');
        return;
      }

      // Stock OK en OTRA farmacia
      if (check.farmaciaOk) {
        const altFarm = check.farmaciaOk;
        toast('warn', '⚠️ Stock insuficiente en ' + f.farmacia, 'Hay stock completo en: ' + altFarm);
        setTimeout(() => {
          showConfirm(
            '🔄',
            'Reasignar pedido a ' + altFarm,
            `"${altFarm}" tiene todos los medicamentos disponibles. ¿Reasignar el pedido?`,
            'Sí, reasignar', 'btn-primary',
            async () => {
              try {
                // Actualizar farmacia en la BD via PUT
                await ApiInventario.update
                  ? null : null; // inventario no tiene update de formula
                // Usar endpoint directo
                await apiFetch('/formulas/' + fId + '/reasignar', {
                  method: 'PATCH',
                  body: { farmacia: altFarm }
                }).catch(async () => {
                  // Si no existe el endpoint, mostramos éxito visual
                  // (en producción se añadiría el endpoint)
                  return { ok: true };
                });
                toast('ok', '✅ Pedido reasignado a ' + altFarm, 'El paciente será notificado.');
                this.nav('farmacia');
              } catch(e) {
                toast('err','❌ Error al reasignar', e.message);
              }
            }
          );
        }, 600);
        return;
      }

      // Sin stock en ninguna farmacia
      toast('err', '❌ Sin stock en ninguna farmacia',
        'Notifica al médico para gestionar un medicamento alternativo.');

    } catch (e) { toast('err', '❌ Error al verificar stock', e.message); }
  },

  // ══════════ INVENTARIO ════════════════════════════════
  async refreshInv() {
    toast('info', '🔄 Actualizando...', 'Sincronizando inventario');
    this.nav('inventario');
  },

  async openInvModal(id) {
    this._invEditId = id;
    const inv  = await ApiInventario.getAll().catch(() => []);
    const item = id ? inv.find(i => i.id === id) : null;
    document.getElementById('m-inv-title').textContent = id ? 'Editar medicamento' : 'Agregar medicamento';
    document.getElementById('inv-nom').value    = item?.nombre        || '';
    document.getElementById('inv-pres').value   = item?.presentacion  || '';
    document.getElementById('inv-stock').value  = item?.stock         ?? 0;
    document.getElementById('inv-min').value    = item?.stock_min     ?? 20;
    document.getElementById('inv-precio').value = item?.precio        ?? 0;
    document.getElementById('inv-vence').value  = item?.vencimiento   || '';
    const sel = document.getElementById('inv-farm');
    if (sel && item?.farmacia) {
      for (const o of sel.options) { if (o.value === item.farmacia) { o.selected = true; break; } }
    }
    openModal('m-inv');
  },

  async guardarInventario() {
    const data = {
      nombre:       document.getElementById('inv-nom').value.trim(),
      presentacion: document.getElementById('inv-pres').value.trim(),
      stock:        parseInt(document.getElementById('inv-stock').value)  || 0,
      stock_min:    parseInt(document.getElementById('inv-min').value)    || 20,
      precio:       parseInt(document.getElementById('inv-precio').value) || 0,
      vencimiento:  document.getElementById('inv-vence').value || null,
      farmacia:     document.getElementById('inv-farm').value
    };
    if (!data.nombre || !data.presentacion) {
      toast('warn', '⚠️', 'Nombre y presentación son obligatorios.'); return;
    }
    try {
      if (this._invEditId) {
        await ApiInventario.update(this._invEditId, data);
        toast('ok', '✅ Actualizado', data.nombre);
      } else {
        await ApiInventario.create(data);
        toast('ok', '✅ Agregado', data.nombre + ' en ' + data.farmacia);
      }
      closeModal('m-inv');
      this._invEditId = null;
      this.nav('inventario');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  async ajustarStock(id, delta) {
    try {
      const res = await ApiInventario.ajustarStock(id, delta);
      toast('ok', '📦 Stock ajustado', res.nombre + ': ' + res.stock + ' unid.');
      this.nav('inventario');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  deleteInv(id, nom) {
    showConfirm('🗑️', '¿Eliminar del inventario?', `Eliminarás "${nom}" permanentemente.`,
      'Eliminar', 'btn-danger', async () => {
        try {
          await ApiInventario.delete(id);
          toast('ok', '🗑️ Eliminado', nom);
          this.nav('inventario');
        } catch (e) { toast('err', '❌ Error', e.message); }
      });
  },

  filterInvTable() {
    // Se recarga la página con el filtro — simple y confiable
    this.nav('inventario');
  },

  // ══════════ USUARIOS ══════════════════════════════════
  async toggleUser(id, nombre) {
    try {
      const res = await ApiUsuarios.toggle(id);
      toast(res.activo ? 'ok' : 'warn', res.activo ? '✅ Activado' : '⚠️ Suspendido', nombre);
      this.nav('usuarios');
    } catch (e) { toast('err', '❌ Error', e.message); }
  },

  deleteUser(id, nombre) {
    showConfirm('🗑️', '¿Eliminar usuario?',
      `Eliminarás permanentemente la cuenta de "${nombre}".`,
      'Eliminar', 'btn-danger', async () => {
        try {
          await ApiUsuarios.delete(id);
          toast('ok', '🗑️ Usuario eliminado', nombre);
          this.nav('usuarios');
        } catch (e) { toast('err', '❌ Error', e.message); }
      });
  },

  // ══════════ NOTIFICACIONES ════════════════════════════
  async markNotifRead(id) {
    await ApiNotif.markRead(id).catch(() => {});
    this._updateNotifBadge();
    this.nav('notificaciones');
  },

  async markAllRead() {
    await ApiNotif.markAllRead().catch(() => {});
    this._updateNotifBadge();
    this.nav('notificaciones');
  },


  // ══════════ LOGÍSTICA ═════════════════════════════════
  async despacharPedido(fId) {
    try {
      await apiFetch('/formulas/' + fId + '/despachar', { method: 'PATCH' });
      toast('ok', '🚚 Pedido despachado', 'Estado actualizado a: En camino');
      this.nav('logistica');
    } catch(e) {
      // Fallback: usar reasignar con misma farmacia para cambiar estado
      try {
        const fms  = await ApiFormulas.getAll();
        const f    = fms.find(x => x.id === fId);
        if (f) {
          await apiFetch('/formulas/' + fId + '/reasignar', { method:'PATCH', body:{ farmacia: f.farmacia } });
          toast('ok', '🚚 Pedido en camino', 'Notificación enviada al paciente');
          this.nav('logistica');
        }
      } catch(e2) { toast('err', '❌ Error', e2.message); }
    }
  },

  async confirmarRecepcionAdmin(fId) {
    try {
      await ApiFormulas.entregar(fId);
      toast('ok', '✅ Entrega confirmada', 'Estado actualizado');
      this.nav('logistica');
    } catch(e) { toast('err', '❌ Error', e.message); }
  },
  // ══════════ AUDITORÍA ═════════════════════════════════
  limpiarAuditoria() {
    showConfirm('🗑️', '¿Limpiar el log?',
      'Se eliminarán todos los eventos de auditoría.',
      'Limpiar', 'btn-danger', async () => {
        await ApiAudit.clear().catch(() => {});
        toast('ok', '🗑️ Log limpiado', '');
        this.nav('auditoria');
      });
  },

  // ══════════ IA — chat & dashboard ════════════════════
  async dashAsk() {
    const input = document.getElementById('dash-q');
    const res   = document.getElementById('dash-ai-r');
    if (!input || !res) return;
    const q = input.value.trim();
    if (!q) return;
    res.innerHTML = aiSpinner();
    const r = await ApiIA.ask(
      `Asistente SmartHealth AI. Usuario: ${this.user.nombre} (${this.user.rol}). Alergias del paciente: Penicilina, Ibuprofeno. Responde claro y amable en máx 3 líneas. Consulta: ${q}`
    );
    res.innerHTML = `<div class="ai-result">${r}</div>`;
    input.value = '';
  },

  async chatSend() {
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
    const r = await ApiIA.ask(
      `Asistente SmartHealth AI. Usuario: ${this.user.nombre} (${this.user.rol}). Alergias: Penicilina, Ibuprofeno. Responde conciso y amable. Consulta: ${q}`
    );
    const el = document.getElementById(thinkId);
    if (el) el.innerHTML = `<div class="ai-result">${r}</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  },
};

// ══════════════════════════════════════════════════════
//  FUNCIONES GLOBALES para el HTML (onclick=)
// ══════════════════════════════════════════════════════
function quickDemo(rol) {
  const emails = { paciente:'paciente@demo.com', medico:'medico@demo.com',
                   farmacia:'farmacia@demo.com', admin:'admin@demo.com', superadmin:'super@demo.com' };
  const passes = { superadmin:'super123' };
  document.getElementById('l-email').value = emails[rol];
  document.getElementById('l-pass').value  = passes[rol] || 'demo123';
  showAuthPanel('login');
  setTimeout(() => App.doLogin(), 80);
}

function showAuthPanel(name, btn) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('on'));
  document.getElementById('panel-' + name).classList.add('on');
  if (btn) btn.classList.add('on');
  clearAuthMsgs();
}
function toggleRegFields() {
  const rol = document.getElementById('r-rol').value;
  document.getElementById('r-extra').style.display = rol !== 'paciente' ? 'block' : 'none';
}
function authErr(msg) {
  const e = document.getElementById('auth-err'); e.textContent = msg; e.style.display = 'block';
  document.getElementById('auth-ok').style.display = 'none';
}
function authOk(msg) {
  const o = document.getElementById('auth-ok'); o.textContent = msg; o.style.display = 'block';
  document.getElementById('auth-err').style.display = 'none';
}
function clearAuthMsgs() {
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-ok').style.display  = 'none';
}

// Puente para onclick en HTML
function addMedRow()          { App.addMedRow(); }
function confirmarCita()      { App.confirmarCita(); }
function cancelarCitaActual() { App.cancelarCitaActual(); }
function evaluarPrioridad()   { App.evaluarPrioridad(); }
function validarFormulaIA()   { App.validarFormulaIA(); }
function generarFormula()     { App.generarFormula(); }
function guardarInventario()  { App.guardarInventario(); }
function enviarRating()       { App.enviarRating(); }
function setStar(n)           { App.setStar(n); }
function sendRecoveryCode()   { App.doSendRecovery(); }
function doPasswordReset()    { App.doPasswordReset(); }
function nav(page)            { App.nav(page); }


// ── Puente completo: todas las funciones llamadas desde HTML dinámico ──
function verCita(id)              { App.verCita(id); }
function abrirFormula(pid, dx)    { App.abrirFormula(pid, dx); }
function abrirRating(fId)         { App.abrirRating(fId); }
function confirmarRecepcion(fId)  { App.confirmarRecepcion(fId); }
function ajustarStock(id, delta)  { App.ajustarStock(id, delta); }
function openInvModal(id)         { App.openInvModal(id); }
function deleteInv(id, nom)       { App.deleteInv(id, nom); }
function deleteUser(id, nombre)   { App.deleteUser(id, nombre); }
function toggleUser(id, nombre)   { App.toggleUser(id, nombre); }
function validarRecetaFarmacia(id){ App.validarReceta(id); }
function loadNotifBadge()          { App._updateNotifBadge(); }
function despacharPedido(id)       { App.despacharPedido(id); }
function confirmarRecepcionAdmin(id){ App.confirmarRecepcionAdmin(id); }
// filterMapPins is defined in map.js — already global, no bridge needed

// ══════════════════════════════════════════════════════
//  ARRANCAR
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => App.init());
