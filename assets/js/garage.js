document.addEventListener('DOMContentLoaded', () => {
  const ORIGIN = window.location.origin;
  const SENSOR_URL = `${ORIGIN}/binary_sensor/Garage%20Door%20State`;
  const SWITCH_URL = `${ORIGIN}/switch/Garage%20Door%20Trigger`;

  document.head.innerHTML = `
    <!doctype html><html lang="da"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Garage</title><style>body {
                font-family:
                    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                background: #f5f5f5;
                display: flex;
                padding: 2rem 1rem;
            }

            .card {
                background: #fff;
                border-radius: 20px;
                padding: 2.5rem 2rem;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2rem;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
            }

            .status-icon {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition:
                    background 0.3s,
                    border-color 0.3s;
            }
            .status-icon.open {
                background: #e8f8ee;
                border: 1px solid #a3d9b8;
            }
            .status-icon.closed {
                background: #eef3ff;
                border: 1px solid #b3c6f7;
            }
            .status-icon.unknown {
                background: #f2f2f2;
                border: 1px solid #ddd;
            }

            .status-text {
                font-size: 24px;
                font-weight: 600;
                color: #111;
            }

            .status-sub {
                font-size: 13px;
                color: #aaa;
            }

            button {
                width: 100%;
                padding: 16px;
                border-radius: 14px;
                border: 1px solid #ddd;
                background: #fff;
                font-size: 16px;
                font-weight: 500;
                color: #111;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition:
                    background 0.15s,
                    opacity 0.2s;
            }
            button:active {
                background: #f2f2f2;
            }
            button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }</style>
  `;

  document.body.innerHTML = `
    <div class="card"><div id="status-icon" class="status-icon unknown"><svg id="icon-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><span id="status-text" class="status-text">—</span> <span id="status-sub" class="status-sub">forbinder…</span> <button id="trigger-btn" onclick="triggerDoor()" disabled><div class="spinner"></div><span class="btn-label">Åbn / luk / stop</span></button></div><script>const SENSOR_URL="/binary_sensor/Garage%20Door%20State",SWITCH_URL="/switch/Garage%20Door%20Trigger",iconOpen='<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d9e60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3H6L2 9l10 12L22 9z"/><line x1="2" y1="9" x2="22" y2="9"/></svg>',iconClosed='<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a6fdc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',iconUnknown='<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',iconEl=document.getElementById("status-icon"),textEl=document.getElementById("status-text"),subEl=document.getElementById("status-sub"),btn=document.getElementById("trigger-btn");function applyState(t){t?(iconEl.className="status-icon open",iconEl.innerHTML=iconOpen,textEl.textContent="Garage åben",subEl.textContent="Sensor: åben"):(iconEl.className="status-icon closed",iconEl.innerHTML=iconClosed,textEl.textContent="Garage lukket",subEl.textContent="Sensor: lukket")}async function poll(){try{const t=await fetch(SENSOR_URL);applyState("ON"!==(await t.json()).state),btn.disabled=!1}catch{iconEl.className="status-icon unknown",iconEl.innerHTML=iconUnknown,textEl.textContent="—",subEl.textContent="Connection error",btn.disabled=!0}}function setLoading(t){t?(btn.classList.add("loading"),btn.disabled=!0):(btn.classList.remove("loading"),btn.disabled=!1)}async function triggerDoor(){setLoading(!0);try{await fetch(SWITCH_URL+"/turn_on",{method:"POST"})}catch{}setTimeout(()=>setLoading(!1),1500)}poll(),setInterval(poll,2e3)</script>
  `;

  const iconOpen    = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d9e60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3H6L2 9l10 12L22 9z"/><line x1="2" y1="9" x2="22" y2="9"/></svg>`;
  const iconClosed  = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a6fdc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const iconUnknown = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  const iconEl = document.getElementById('status-icon');
  const textEl = document.getElementById('status-text');
  const subEl  = document.getElementById('status-sub');
  const btn    = document.getElementById('trigger-btn');

  function applyState(isOpen) {
    iconEl.className = isOpen ? 'status-icon open' : 'status-icon closed';
    iconEl.innerHTML = isOpen ? iconOpen : iconClosed;
    textEl.textContent = isOpen ? 'Garage open' : 'Garage closed';
    subEl.textContent  = isOpen ? 'Sensor: open' : 'Sensor: closed';
  }

  async function poll() {
    try {
      const res    = await fetch(SENSOR_URL);
      const sensor = await res.json();
      applyState(sensor.state === 'ON');
      btn.disabled = false;
    } catch {
      iconEl.className = 'status-icon unknown';
      iconEl.innerHTML = iconUnknown;
      textEl.textContent = '—';
      subEl.textContent  = 'Connection error';
      btn.disabled = true;
    }
  }

  function setLoading(on) {
    btn.classList.toggle('loading', on);
    btn.disabled = on;
  }

  window.triggerDoor = async function() {
    setLoading(true);
    try { await fetch(SWITCH_URL + '/turn_on', { method: 'POST' }); } catch {}
    setTimeout(() => setLoading(false), 1500);
  };

  poll();
  setInterval(poll, 2000);
});
