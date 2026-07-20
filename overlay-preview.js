// Overlay tab: what's currently visible on the live output, a live preview of the widget you
// just added (or are just previewing), plus the full widget catalog as cards — each showing a
// real scaled-down render of that widget (via wh(), the exact function the real canvas uses)
// instead of a generic icon, with Preview/Configure/Copy link/favorite actions per card.

let overlayPreviewWidgetId = null;
let overlayDraftPreviewHtml = null;
let overlayDraftPreviewName = null;

const OWG_FAV_KEY = 'vyra-favorite-widgets';
function owgGetFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(OWG_FAV_KEY) || '[]')); }
  catch { return new Set(); }
}
function owgSaveFavorites(set) { localStorage.setItem(OWG_FAV_KEY, JSON.stringify([...set])); }

function owgOverlayUrl() {
  return location.protocol === 'file:' ? 'http://127.0.0.1:4173/overlay.html' : new URL('overlay.html', location.href).href;
}

function overlayPreviewHtml() {
  const visibleWidgets = state.widgets.filter(w => !w.hidden);
  const previewWidget = state.widgets.find(w => w.id === overlayPreviewWidgetId);
  const stageHtml = overlayDraftPreviewHtml || (previewWidget ? wh(previewWidget) : null);
  const stageName = overlayDraftPreviewHtml ? overlayDraftPreviewName : (previewWidget ? liveLayerName(previewWidget) : null);
  return `<div class="section-head"><div><h2>Overlay</h2><p>Widgets du lägger till här dyker upp direkt i din layout.</p></div></div>
  <div class="overlay-preview-sidebar">
    <h4>VAD SOM VISAS NU · ${visibleWidgets.length}</h4>
    <div class="overlay-widget-list">${visibleWidgets.length ? visibleWidgets.map(w => `<article><i>◇</i><span>${liveLayerName(w)}</span></article>`).join('') : '<p>Inga widgets är synliga just nu.</p>'}</div>
  </div>
  ${stageHtml ? `<div class="overlay-live-preview">
    <h4>SÅ HÄR SER DEN UT · ${stageName}</h4>
    <div class="overlay-live-preview-stage">${stageHtml}</div>
  </div>` : ''}
  <div class="overlay-widget-gallery">
    <h4>ALLA WIDGETS</h4>
    <p>Klicka på en widget för att lägga till den i din layout, eller använd Preview/Configure/länk-knapparna på kortet.</p>
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
  let html = null, name = null;
  try {
    originalClick();
    const w = state.widgets.find(x => x.id === selected);
    if (w) { html = wh(w); name = liveLayerName(w); }
  } catch (e) { /* leave html null, card falls back to its plain icon */ }
  state.widgets = savedWidgets;
  selected = savedSelected;
  overlayPreviewWidgetId = savedPreviewId;
  render = realRender; toast = realToast;
  return { html, name };
}

function scaleThumbnailToFit(thumb) {
  const inner = thumb.querySelector('.owg-thumb-inner');
  const widget = inner && inner.firstElementChild;
  if (!widget) return;
  const w = widget.offsetWidth || 300, h = widget.offsetHeight || 150;
  const scale = Math.min((thumb.clientWidth - 16) / w, (thumb.clientHeight - 16) / h, 1);
  inner.style.transform = `translate(-50%,-50%) scale(${scale})`;
}

// A stable per-card key for favorites — derived from the rendered name + its section heading,
// since the underlying catalog buttons don't share one consistent dataset attribute across the
// ~14 files that inject them (data-mvp-style, data-theme-template, data-ranking, etc.).
function owgCardKey(btn) {
  const clone = btn.cloneNode(true);
  clone.querySelector('.owg-thumb')?.remove();
  clone.querySelectorAll('.owg-add,.owg-actions,.owg-star').forEach(el => el.remove());
  const name = clone.querySelector('b')?.textContent?.trim() || clone.textContent.trim();
  const section = btn.closest('section')?.querySelector('h4')?.textContent?.trim() || '';
  return section + '::' + name;
}

// Sections/buttons here are the same catalog markup Layout uses (media.js/toplike-studio.js/
// last-x-alerts.js/custom-widgets.js/gift-fireworks.js all inject into any .widget-catalog they find).
// Clicking the card body still pushes straight into state.widgets like it always has. The extra
// actions (Preview/Configure/Copy link/star) are separate <span>s with stopPropagation — real
// nested <button> tags aren't valid inside the catalog's own <button>, so these stay non-button
// elements with click handlers, matching the .owg-add convention already established here.
function styleOverlayCatalogCards() {
  const gallery = document.querySelector('.overlay-widget-gallery .widget-catalog');
  if (!gallery) return;
  const favorites = owgGetFavorites();
  let generatedAny = false;
  gallery.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.owgWrapped) return;
    btn.dataset.owgWrapped = '1';
    const originalClick = btn.onclick;
    if (!originalClick) return;

    const { html: thumbHtml, name: widgetName } = overlayCatalogPreviewHtml(originalClick);
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

    const key = owgCardKey(btn);
    const star = document.createElement('span');
    star.className = 'owg-star' + (favorites.has(key) ? ' owg-star-active' : '');
    star.textContent = favorites.has(key) ? '★' : '☆';
    star.title = 'Favorit';
    star.onclick = e => {
      e.stopPropagation();
      const favs = owgGetFavorites();
      if (favs.has(key)) { favs.delete(key); star.classList.remove('owg-star-active'); star.textContent = '☆'; }
      else { favs.add(key); star.classList.add('owg-star-active'); star.textContent = '★'; }
      owgSaveFavorites(favs);
    };
    btn.prepend(star);

    const actions = document.createElement('div');
    actions.className = 'owg-actions';

    const configureBtn = document.createElement('span');
    configureBtn.className = 'owg-action owg-configure';
    configureBtn.textContent = '⚙ Configure';
    configureBtn.onclick = e => {
      e.stopPropagation();
      originalClick.call(btn, e);
      overlayPreviewWidgetId = selected;
      openConfigureModal(selected);
    };

    const previewBtn = document.createElement('span');
    previewBtn.className = 'owg-action owg-preview';
    previewBtn.textContent = '▶ Preview';
    previewBtn.onclick = e => {
      e.stopPropagation();
      const fresh = overlayCatalogPreviewHtml(originalClick);
      overlayDraftPreviewHtml = fresh.html;
      overlayDraftPreviewName = fresh.name;
      overlayPreviewWidgetId = null;
      render();
    };

    const linkBtn = document.createElement('span');
    linkBtn.className = 'owg-action owg-copylink';
    linkBtn.textContent = '🔗 Länk';
    linkBtn.title = 'Kopierar länken till hela overlayn (widgets har ingen egen enskild länk — alla visas i samma overlay)';
    linkBtn.onclick = async e => {
      e.stopPropagation();
      const url = owgOverlayUrl();
      try { await navigator.clipboard.writeText(url); toast('Overlaylänk kopierad'); }
      catch { toast('Kunde inte kopiera länken'); }
    };

    const row = document.createElement('div');
    row.className = 'owg-action-row';
    row.append(previewBtn, linkBtn);
    actions.append(configureBtn, row);
    btn.append(actions);

    const add = document.createElement('span');
    add.className = 'owg-add';
    add.textContent = '+ Lägg till i Layout';
    btn.append(add);

    btn.onclick = function (e) {
      originalClick.call(btn, e);
      overlayPreviewWidgetId = selected;
      overlayDraftPreviewHtml = null;
      overlayDraftPreviewName = null;
      render();
    };
  });
  if (generatedAny) save();
}

function bindOverlayPreview() {
  styleOverlayCatalogCards();
}

// The Configure modal: the widget is already added (selected === owgConfigureWidgetId) by the
// time this opens, so this reuses the SAME props()/wh() functions Layout's own properties panel
// uses — no per-widget settings UI to duplicate. The tricky part is that every existing bind()
// wrap across ~14 files gates its input-wiring on `view==='editor'`, and this modal is shown while
// view is still 'overlay'. Rather than touch every one of those files, bindConfigureModal()
// briefly flips the global `view` to 'editor' (a plain variable, not tied to which DOM is visible)
// so that existing chain runs and finds this modal's inputs by the same ids it always looks for
// (#propX, #dataColor, etc.), then flips it back — the modal's own DOM is untouched by that,
// since render() only ever rewrites #view's contents and this modal lives outside of it.
let owgConfigureWidgetId = null;

function openConfigureModal(widgetId) {
  owgConfigureWidgetId = widgetId;
  renderConfigureModal();
}

function closeConfigureModal() {
  owgConfigureWidgetId = null;
  document.querySelector('.owg-configure-modal')?.remove();
  render();
}

function renderConfigureModal() {
  const w = state.widgets.find(x => x.id === owgConfigureWidgetId);
  if (!w) { closeConfigureModal(); return; }
  let modal = document.querySelector('.owg-configure-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'owg-configure-modal';
    document.body.append(modal);
  }
  modal.innerHTML = `<div class="owg-configure-panel">
    <header><h3>Configure ${liveLayerName(w)}</h3><button class="owg-configure-close" type="button">×</button></header>
    <div class="owg-configure-settings properties">${props()}</div>
  </div>
  <div class="owg-configure-preview">
    <h4>PREVIEW</h4>
    <div class="owg-configure-preview-stage">${wh(w)}</div>
  </div>
  <button class="owg-configure-done" type="button">Close</button>
  <button id="testEvent" hidden></button><button id="saveProject" hidden></button>`;
  modal.querySelector('.owg-configure-close').onclick = closeConfigureModal;
  modal.querySelector('.owg-configure-done').onclick = closeConfigureModal;
  bindConfigureModal();
}

// studio.js's base bind() unconditionally wires #testEvent/#saveProject (the Layout
// toolbar buttons) whenever view==='editor', with no null-check — since this modal
// never renders the real Layout DOM, those two hidden dummy buttons above exist purely
// so that unguarded access doesn't throw and abort the rest of the bind() chain before
// it reaches each widget's own settings wiring (e.g. heartGoalBind).
function bindConfigureModal() {
  if (!owgConfigureWidgetId) return;
  const realView = view;
  view = 'editor';
  try { bind(); } finally { view = realView; }
}

const overlayPreviewRender = render;
render = function () {
  // While the Configure modal is open, only refresh the modal itself — the gallery behind it is
  // hidden anyway, and rebuilding all 52 cards' thumbnails on every settings tweak inside the
  // modal would be pure waste. closeConfigureModal() calls render() again once it's gone, which
  // brings the (by-then-visible) Overlay view back in sync in one go.
  if (owgConfigureWidgetId) { renderConfigureModal(); return; }
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
