(function () {
  const isOverlayView = new URLSearchParams(location.search).has('overlay');

  function currentWidgetCount() {
    try { return (JSON.parse(localStorage.getItem('vyra-state') || '{}').widgets || []).length; }
    catch { return 0; }
  }

  function sanitizeWidget(w) {
    if (!w || typeof w !== 'object' || !w.id) return null;
    if (!w.title) w.title = w.type || 'Widget';
    return w;
  }

  function applyBackup(backup, reason) {
    if (!backup || !Array.isArray(backup.widgets) || !backup.widgets.length) return;
    backup.widgets = backup.widgets.map(sanitizeWidget).filter(Boolean);
    if (!backup.widgets.length) return;
    localStorage.setItem('vyra-state', JSON.stringify(backup));
    if (typeof state === 'object' && state) {
      Object.assign(state, backup);
      if (typeof render === 'function') render();
    }
    console.log('[VYRA] Återställde ' + backup.widgets.length + ' widgets från säkerhetskopian (' + reason + ').');
  }

  if (isOverlayView || currentWidgetCount() === 0) {
    fetch('/api/state').then(r => r.ok ? r.json() : null).then(backup => {
      applyBackup(backup, isOverlayView ? 'overlay' : 'empty-local-state');
    }).catch(() => {});
  }

  let lastSynced = localStorage.getItem('vyra-state');

  function syncNow(force = false) {
    const current = localStorage.getItem('vyra-state');
    if (!current || (!force && current === lastSynced)) return;
    lastSynced = current;
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: current
    }).catch(() => {});
  }

  if (!isOverlayView && currentWidgetCount() > 0) syncNow(true);
  setInterval(() => syncNow(false), 3000);
  addEventListener('beforeunload', () => syncNow(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncNow(true);
  });
})();
