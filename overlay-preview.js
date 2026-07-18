// Overlay tab: what's currently visible on the live output, plus the full widget catalog
// as add-to-layout cards. No scene preview/iframe here — that lives in Action & Event's
// scene links (action-scenes.js) instead.

function overlayPreviewHtml() {
  const visibleWidgets = state.widgets.filter(w => !w.hidden);
  return `<div class="section-head"><div><h2>Overlay</h2><p>Widgets du lägger till här dyker upp direkt i din layout.</p></div></div>
  <div class="overlay-preview-sidebar">
    <h4>VAD SOM VISAS NU · ${visibleWidgets.length}</h4>
    <div class="overlay-widget-list">${visibleWidgets.length ? visibleWidgets.map(w => `<article><i>◇</i><span>${liveLayerName(w)}</span></article>`).join('') : '<p>Inga widgets är synliga just nu.</p>'}</div>
  </div>
  <div class="overlay-widget-gallery">
    <h4>ALLA WIDGETS</h4>
    <p>Klicka på en widget för att lägga till den i din layout.</p>
    <input class="widget-search" placeholder="Sök widget...">
    <div class="widget-catalog"></div>
  </div>`;
}

// Sections/buttons here are the same catalog markup Layout uses (media.js/toplike-studio.js/
// last-x-alerts.js/custom-widgets.js/gift-fireworks.js all inject into any .widget-catalog they find),
// just restyled as cards — clicking one still pushes straight into state.widgets like it always has.
function styleOverlayCatalogCards() {
  const gallery = document.querySelector('.overlay-widget-gallery .widget-catalog');
  if (!gallery) return;
  gallery.querySelectorAll('button').forEach(btn => {
    if (btn.querySelector('.owg-add')) return;
    const add = document.createElement('span');
    add.className = 'owg-add';
    add.textContent = '+ Lägg till';
    btn.append(add);
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
