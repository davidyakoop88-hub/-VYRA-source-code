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
  if (currentWidgetCount() === 0) {
    fetch('/api/state').then(r => r.ok ? r.json() : null).then(backup => {
      if (!backup || !Array.isArray(backup.widgets) || !backup.widgets.length) return;
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
  let lastSynced = localStorage.getItem('vyra-state');
  setInterval(() => {
    const current = localStorage.getItem('vyra-state');
    if (current === lastSynced || !current) return;
    lastSynced = current;
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: current }).catch(() => {});
  }, 3000);
})();
