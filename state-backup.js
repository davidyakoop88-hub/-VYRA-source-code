(function () {
  // Safety net against localStorage being wiped between sessions (incognito/private browsing, OBS
  // Browser Source "Shutdown source when not visible" + non-persistent storage, browser "clear on
  // exit" settings, etc.) — none of which VYRA's own code controls or can detect in advance.
  //
  // server.ps1's new /api/state endpoint writes the posted state to a JSON file on disk next to the
  // server (vyra-state-backup.json), which survives all of the above since it isn't browser storage
  // at all. This script keeps that file in sync with localStorage, and restores from it on load if
  // localStorage came up empty.

  function currentWidgetCount() {
    try { return (JSON.parse(localStorage.getItem('vyra-state') || '{}').widgets || []).length; }
    catch { return 0; }
  }

  // Restore-on-load: only when local state looks empty, so a real (non-empty) session is never
  // silently overwritten by an older backup.
  // A widget missing both title and type would render as literal "undefined" text through the
  // base fallback renderer (see studio.js) — sanitize anything coming back from disk before it's
  // allowed to reach the real layout, since this file can hold stale data from as far back as it
  // was first created.
  function sanitizeWidget(w) {
    if (!w || typeof w !== 'object' || !w.id) return null;
    if (!w.title) w.title = w.type || 'Widget';
    return w;
  }

  if (currentWidgetCount() === 0) {
    fetch('/api/state').then(r => r.ok ? r.json() : null).then(backup => {
      if (!backup || !Array.isArray(backup.widgets) || !backup.widgets.length) return;
      backup.widgets = backup.widgets.map(sanitizeWidget).filter(Boolean);
      if (!backup.widgets.length) return;
      localStorage.setItem('vyra-state', JSON.stringify(backup));
      if (typeof state === 'object' && state) {
        Object.assign(state, backup);
        if (typeof render === 'function') render();
      }
      console.log('[VYRA] Återställde ' + backup.widgets.length + ' widgets från säkerhetskopian.');
    }).catch(() => {});
  }

  // Keep the on-disk backup in sync whenever localStorage actually changes. Polling localStorage
  // (rather than wrapping the const-bound save()) because save is declared with const in studio.js
  // and can't be reassigned from another script the way bind/props/wh/render are.
  const SYNC_VISIBLE_MS = 3000;
  const SYNC_HIDDEN_MS = 12000;
  let lastSynced = localStorage.getItem('vyra-state');
  let syncTimer = null;

  function nextSyncDelay() {
    return document.visibilityState === 'hidden' ? SYNC_HIDDEN_MS : SYNC_VISIBLE_MS;
  }

  function scheduleSync(delay = nextSyncDelay()) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncLoop, delay);
  }

  function syncLoop() {
    const current = localStorage.getItem('vyra-state');
    if (current !== lastSynced && current) {
      lastSynced = current;
      fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: current }).catch(() => {});
    }
    scheduleSync();
  }

  document.addEventListener('visibilitychange', () => scheduleSync());
  scheduleSync();
})();
