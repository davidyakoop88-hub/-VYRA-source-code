// Overlay tab: what's currently visible on the live output, a live preview of the widget you
// just added, plus the full widget catalog as add-to-layout cards — each card showing a real
// scaled-down render of that widget (via wh(), the exact function the real canvas uses) instead
// of a generic icon, so the gallery actually looks like what you're about to add.

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
    <p>Klicka på en widget för att lägga till den i din layout.</p>
    <input class="widget-search" placeholder="Sök widget...">
    <div class="widget-catalog"></div>
  </div>`;
}

// Dry-runs a catalog button's own creation logic (push+save+render+toast), reads back the widget
// it would have created via wh() — the exact renderer the real canvas uses — then undoes the push.
// render/toast are reassignable (matching this codebase's monkey-patch convention) so they're
// swapped for no-ops here to avoid a real re-render/toast per button; save() is declared `const`
// in studio.js and can't be swapped the same way, so it's left to write for real (harmless — it's
// a synchronous localStorage.setItem, and styleOverlayCatalogCards() does one corrective save()
// after the whole batch to flush the true state back once every dry-run has undone its push).
function overlayCatalogPreviewHtml(originalClick) {
  const savedWidgets = state.widgets.slice();
  const savedSelected = selected, savedPreviewId = overlayPreviewWidgetId;
  const realRender = render, realToast = toast;
  render = () => {}; toast = () => {};
  let html = null;
  try {
    originalClick();
    const w = state.widgets.find(x => x.id === selected);
    if (w) html = wh(w);
  } catch (e) { /* leave html null, card falls back to its plain icon */ }
  state.widgets = savedWidgets;
  selected = savedSelected;
  overlayPreviewWidgetId = savedPreviewId;
  render = realRender; toast = realToast;
  return html;
}

function scaleThumbnailToFit(thumb) {
  const inner = thumb.querySelector('.owg-thumb-inner');
  const widget = inner && inner.firstElementChild;
  if (!widget) return;
  const w = widget.offsetWidth || 300, h = widget.offsetHeight || 150;
  const scale = Math.min((thumb.clientWidth - 16) / w, (thumb.clientHeight - 16) / h, 1);
  inner.style.transform = `translate(-50%,-50%) scale(${scale})`;
}

// Sections/buttons here are the same catalog markup Layout uses (media.js/toplike-studio.js/
// last-x-alerts.js/custom-widgets.js/gift-fireworks.js all inject into any .widget-catalog they find).
// Clicking a card still pushes straight into state.widgets like it always has — we just also
// remember which widget was just added so overlayPreviewHtml() can render it live, and generate
// a one-time real-render thumbnail for the card itself.
function styleOverlayCatalogCards() {
  const gallery = document.querySelector('.overlay-widget-gallery .widget-catalog');
  if (!gallery) return;
  let generatedAny = false;
  gallery.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.owgWrapped) return;
    btn.dataset.owgWrapped = '1';
    const originalClick = btn.onclick;
    if (!originalClick) return;

    const thumbHtml = overlayCatalogPreviewHtml(originalClick);
    generatedAny = true;
    if (thumbHtml) {
      const icon = btn.querySelector('i');
      const thumb = document.createElement('div');
      thumb.className = 'owg-thumb';
      thumb.innerHTML = `<div class="owg-thumb-inner">${thumbHtml}</div>`;
      btn.prepend(thumb);
      if (icon) icon.remove();
      scaleThumbnailToFit(thumb);
    }

    const add = document.createElement('span');
    add.className = 'owg-add';
    add.textContent = '+ Lägg till';
    btn.append(add);

    btn.onclick = function (e) {
      originalClick.call(btn, e);
      overlayPreviewWidgetId = selected;
      render();
    };
  });
  if (generatedAny) save();
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
