// ═══════════════════════════════════════════════════════
//  frontend/js/map.js
//  Módulo del mapa OpenStreetMap + Leaflet
// ═══════════════════════════════════════════════════════

let _map = null;
let _pins = [];

const MAP_PLACES = [
  { name:'Hospital San Jorge',   type:'hospital', lat:4.8133, lng:-75.6961, info:'Urgencias, Cirugía, UCI',      dist:'4.2 km', stars:'⭐4.5', icon:'🏥' },
  { name:'Clínica Los Rosales',  type:'hospital', lat:4.8087, lng:-75.6826, info:'Cardiología, Neurología',      dist:'2.8 km', stars:'⭐4.7', icon:'🏥' },
  { name:'Centro de Salud Cuba', type:'hospital', lat:4.8021, lng:-75.7052, info:'Medicina General, Pediatría',  dist:'1.1 km', stars:'⭐4.2', icon:'🏥' },
  { name:'Clínica Comfamiliar',  type:'hospital', lat:4.8168, lng:-75.7012, info:'Medicina Interna',             dist:'3.0 km', stars:'⭐4.4', icon:'🏥' },
  { name:'Cruz Verde',           type:'farmacia', lat:4.8062, lng:-75.6960, info:'Stock 95% disponible',         dist:'1.2 km', stars:'⭐4.3', icon:'💊' },
  { name:'La Rebaja',            type:'farmacia', lat:4.8105, lng:-75.6880, info:'Stock 87% disponible',         dist:'3.5 km', stars:'⭐4.1', icon:'💊' },
  { name:'Comfamiliar',          type:'farmacia', lat:4.8190, lng:-75.7040, info:'Stock 92% disponible',         dist:'2.3 km', stars:'⭐4.6', icon:'💊' },
];

function initMap(containerId, height) {
  const el = document.getElementById(containerId || 'leaflet-map');
  if (!el) return;
  el.style.height = height || '390px';

  if (_map) { _map.remove(); _map = null; _pins = []; }

  _map = L.map(containerId || 'leaflet-map').setView([4.8087, -75.6963], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }).addTo(_map);

  // Pin usuario
  const uIcon = L.divIcon({
    html: `<div style="background:#0057ff;border:3px solid #fff;border-radius:50%;width:30px;height:30px;
                       display:flex;align-items:center;justify-content:center;font-size:14px;
                       box-shadow:0 2px 8px rgba(0,0,0,.3)">📍</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  });
  L.marker([4.8047, -75.6989], { icon: uIcon })
    .addTo(_map)
    .bindPopup('<div class="map-popup"><h4>📍 Tu ubicación</h4><p>Pereira, Risaralda</p></div>');

  // Pins de centros
  _pins = [];
  MAP_PLACES.forEach(p => {
    const color = p.type === 'hospital' ? '#ef4444' : '#10b981';
    const ic = L.divIcon({
      html: `<div style="background:${color};border:2.5px solid #fff;border-radius:50%;width:32px;height:32px;
                         display:flex;align-items:center;justify-content:center;font-size:14px;
                         box-shadow:0 2px 8px rgba(0,0,0,.25)">${p.icon}</div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16]
    });
    const marker = L.marker([p.lat, p.lng], { icon: ic }).addTo(_map);
    marker.bindPopup(`<div class="map-popup">
      <h4>${p.icon} ${p.name}</h4>
      <p>${p.info}<br>${p.stars} · ${p.dist}</p>
      <button onclick="scheduleFromMap('${p.name}')">📅 Agendar cita aquí</button>
    </div>`);
    marker._place = p;
    _pins.push(marker);
  });

  // Cards debajo del mapa
  const cardsEl = document.getElementById('map-cards');
  if (cardsEl) {
    cardsEl.innerHTML = MAP_PLACES.slice(0, 3).map(p => `
      <div class="card" style="cursor:pointer" onclick="_map&&_map.setView([${p.lat},${p.lng}],16)">
        <div class="card-b">
          <div style="display:flex;gap:9px;align-items:center">
            <div style="font-size:26px">${p.icon}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">${p.name}</div>
              <div style="font-size:11px;color:var(--t3)">${p.dist} · ${p.stars}</div>
              <div style="font-size:11px;color:var(--t3)">${p.info}</div>
            </div>
            <button class="btn btn-primary btn-sm"
              onclick="event.stopPropagation();scheduleFromMap('${p.name}')">Agendar</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Ruta de entrega (para página de rastreo)
  const routeEl = document.getElementById('delivery-route');
  if (routeEl) drawDeliveryRoute();
}

function drawDeliveryRoute() {
  if (!_map) return;
  const farmLat = 4.8062, farmLng = -75.6960;
  const homeLat = 4.8047, homeLng = -75.6989;
  const repLat  = 4.8054, repLng  = -75.6975;

  // Pin farmacia
  const fIcon = L.divIcon({
    html: `<div style="background:#10b981;border:2.5px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.25)">💊</div>`,
    className:'', iconSize:[30,30], iconAnchor:[15,15]
  });
  L.marker([farmLat, farmLng], { icon: fIcon }).addTo(_map).bindPopup('<b>Cruz Verde</b>');

  // Pin casa
  const hIcon = L.divIcon({
    html: `<div style="background:#0057ff;border:2.5px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.25)">🏠</div>`,
    className:'', iconSize:[30,30], iconAnchor:[15,15]
  });
  L.marker([homeLat, homeLng], { icon: hIcon }).addTo(_map).bindPopup('<b>Tu dirección</b>');

  // Pin repartidor
  const rIcon = L.divIcon({
    html: `<div style="background:#f59e0b;border:2.5px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.25)">🛵</div>`,
    className:'', iconSize:[30,30], iconAnchor:[15,15]
  });
  L.marker([repLat, repLng], { icon: rIcon }).addTo(_map).bindPopup('<b>Repartidor en camino</b>');

  // Línea de ruta
  L.polyline([[farmLat, farmLng], [repLat, repLng], [homeLat, homeLng]], {
    color: '#0057ff', weight: 3, opacity: 0.7, dashArray: '8,6'
  }).addTo(_map);

  _map.setView([repLat, repLng], 15);
}

function filterMapPins(query, showAll) {
  if (!_pins.length || !_map) return;
  const q = (query || '').toLowerCase();
  _pins.forEach(m => {
    const p   = m._place;
    const hit = showAll || !q || p.name.toLowerCase().includes(q) || p.type.includes(q);
    hit ? m.addTo(_map) : m.remove();
  });
}

function scheduleFromMap(name) {
  openModal('m-agendar');
  setTimeout(() => {
    const sel = document.getElementById('a-centro');
    if (!sel) return;
    for (const o of sel.options) {
      if (o.text.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
        o.selected = true; break;
      }
    }
  }, 100);
}
