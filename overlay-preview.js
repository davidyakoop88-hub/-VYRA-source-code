// Overlay tab: what's currently visible on the live output, a live preview of the widget you
// just added (rendered with the exact same wh() function the real canvas/overlay uses, so it's
// never a fake mockup), plus the full widget catalog as add-to-layout cards.

let overlayPreviewWidgetId = null;

function overlayPreviewHtml() {
  const visibleWidgets = state.widgets.filter(w => !w.hidden);
  const previewWidget = state.widgets.find(w => w.id === overlayPreviewWidgetId);
  return `<div class="section-head"><div><h2>Overlay</h2><p>Widgets du lägger till här dyker upp direkt i din layout.</p></div></div>
  <div class="overlay-preview-sidebar">
    <h4>VAD SOM VISAS NU · ${visibleWidgets.length}</h4>
    <div class="overlay-widget-list">${visibleWidgets.length ? visibleWidgets.map(w => `<article><i>◇</i><span>${liveLayerName(w)}</span></article>`).join('') : '<p>Inga widgets är synliga just nu.</p>'}</div>
  </div>
  ${previewWidget ? `<div class="overlay-live-preview">
    <h4>SÅ HÄR SER DEN UT · ${liveLayerName(previewWidget)}</h4>
    <div class="overlay-live-preview-stage">${wh(previewWidget)}</div>
  </div>` : ''}
  <div class="overlay-widget-gallery">
    <h4>ALLA WIDGETS</h4>
    <p>Klicka på en widget för att lägga till den i din layout — den visas direkt här ovan så du ser exakt hur den ser ut.</p>
    <input class="widget-search" placeholder="Sök widget...">
    <div class="widget-catalog"></div>
  </div>`;
}

// Sections/buttons here are the same catalog markup Layout uses (media.js/toplike-studio.js/
// last-x-alerts.js/custom-widgets.js/gift-fireworks.js all inject into any .widget-catalog they find),
// just restyled as cards. Clicking one still pushes straight into state.widgets like it always has —
// we just also remember which widget was just added so overlayPreviewHtml() can render it live.
function styleOverlayCatalogCards() {
  const gallery = document.querySelector('.overlay-widget-gallery .widget-catalog');
  if (!gallery) return;
  gallery.querySelectorAll('button').forEach(btn => {
    if (btn.querySelector('.owg-add')) return;
    const add = document.createElement('span');
    add.className = 'owg-add';
    add.textContent = '+ Lägg till';
    btn.append(add);
    if (btn.dataset.owgWrapped) return;
    btn.dataset.owgWrapped = '1';
    const originalClick = btn.onclick;
    if (!originalClick) return;
    btn.onclick = function (e) {
      originalClick.call(btn, e);
      overlayPreviewWidgetId = selected;
      render();
    };
  });
}

function bindOverlayPreview() {
  styleOverlayCatalogCards();
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
