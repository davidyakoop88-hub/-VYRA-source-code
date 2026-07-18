// A real in-app preview of the live overlay output — embeds the exact same ?overlay=1&scene=N page
// used by OBS/TikTok LIVE Studio (see action-scenes.js's own sceneUrl()/heartbeat, replicated here in
// miniature rather than reached into, matching this codebase's established sibling-file convention),
// so what's shown here is pixel-for-pixel what actually goes out, at the correct aspect ratio.

let currentOverlayScene = 1;
function overlaySceneUrl(n) { return `${location.origin}${location.pathname}?overlay=1&scene=${n}`; }

function overlayPreviewHtml() {
  const visibleWidgets = state.widgets.filter(w => !w.hidden);
  return `<div class="section-head"><div><h2>Overlay</h2><p>Så här ser din riktiga overlay ut just nu — samma länk du klistrar in i OBS eller TikTok LIVE Studio.</p></div></div>
  <div class="overlay-preview-layout">
    <div class="overlay-preview-stage">
      <div class="overlay-scene-bar">
        <label>Scen<select id="overlaySceneSelect">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${currentOverlayScene === i + 1 ? 'selected' : ''}>Scen ${i + 1}</option>`).join('')}</select></label>
        <span class="overlay-scene-status" id="overlaySceneStatus"><i></i> Offline</span>
      </div>
      <div class="overlay-frame-wrap"><iframe id="overlayPreviewFrame" src="${overlaySceneUrl(currentOverlayScene)}"></iframe></div>
      <div class="overlay-link-row"><input readonly id="overlayLinkInput" value="${overlaySceneUrl(currentOverlayScene)}"><button id="overlayCopyBtn" type="button">Kopiera</button><button id="overlayOpenBtn" type="button">Öppna ↗</button></div>
      <small class="overlay-res-hint">Rekommenderad Browser Source-storlek: <b>1080 × 1920</b></small>
    </div>
    <div class="overlay-preview-sidebar">
      <h4>VAD SOM VISAS NU · ${visibleWidgets.length}</h4>
      <div class="overlay-widget-list">${visibleWidgets.length ? visibleWidgets.map(w => `<article><i>◇</i><span>${liveLayerName(w)}</span></article>`).join('') : '<p>Inga widgets är synliga just nu.</p>'}</div>
    </div>
  </div>`;
}

function updateOverlaySceneStatus() {
  const statusEl = document.querySelector('#overlaySceneStatus');
  if (!statusEl) return;
  const lastSeen = Number(localStorage.getItem('vyra-scene-heartbeat-' + currentOverlayScene) || 0);
  const online = Date.now() - lastSeen < 6000;
  statusEl.classList.toggle('online', online);
  statusEl.classList.toggle('offline', !online);
  statusEl.innerHTML = `<i></i> ${online ? 'Online' : 'Offline'}`;
}
setInterval(() => { if (view === 'overlay') updateOverlaySceneStatus(); }, 2000);

function bindOverlayPreview() {
  const select = document.querySelector('#overlaySceneSelect');
  if (select) select.onchange = e => { currentOverlayScene = +e.target.value; render(); };
  const copyBtn = document.querySelector('#overlayCopyBtn');
  if (copyBtn) copyBtn.onclick = async () => {
    const url = overlaySceneUrl(currentOverlayScene);
    try { await navigator.clipboard.writeText(url); toast('Länk för Scen ' + currentOverlayScene + ' kopierad'); }
    catch { const input = document.querySelector('#overlayLinkInput'); input.select(); document.execCommand('copy'); toast('Scenlänken kopierad'); }
  };
  const openBtn = document.querySelector('#overlayOpenBtn');
  if (openBtn) openBtn.onclick = () => window.open(overlaySceneUrl(currentOverlayScene), '_blank', 'noopener');
  updateOverlaySceneStatus();
}

const overlayPreviewRender = render;
render = function () {
  if (view === 'overlay') {
    $('#view').innerHTML = overlayPreviewHtml();
    $('#title').textContent = 'Overlay';
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    bind();
    return;
  }
  overlayPreviewRender();
};
const overlayPreviewBind = bind;
bind = function () { overlayPreviewBind(); if (view === 'overlay') bindOverlayPreview(); };
