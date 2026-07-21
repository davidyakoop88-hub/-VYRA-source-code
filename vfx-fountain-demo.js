// vfx-fountain-demo.js — Milestone 2 dev-only demo. Only present in the page at all
// when ?vfxdemo=2 loaded it (see the loader in media.js). Builds a full
// VFX.FountainEmitter — crystal hearts, sparkles, trails, layered depth, the source
// portal, entrance sequence — with the extended debug panel. The original
// Milestone 1 simple demo (?vfxdemo=1, vfx-demo.js) is untouched and still works as
// a regression baseline.
(function () {
  function mount() {
    if (window.VFX_FOUNTAIN_DEMO) return;

    const mountEl = document.createElement('div');
    mountEl.id = 'vfx-fountain-demo-root';
    Object.assign(mountEl.style, { position: 'fixed', inset: '0', zIndex: 100000, pointerEvents: 'none' });
    document.body.appendChild(mountEl);

    const engine = new VFX.Engine({ mountEl, quality: VFX.QualityMode.AUTO, debug: false });

    const qualityName = engine.diagnostics.quality;
    const budget = VFX.FOUNTAIN_QUALITY_BUDGETS[qualityName] || VFX.FOUNTAIN_QUALITY_BUDGETS.high;

    const emitter = new VFX.FountainEmitter({
      textureRegistry: engine.textures,
      width: engine.renderer.width,
      height: engine.renderer.height,
      budget,
      seed: 20260721
    });

    const scene = engine.createScene('fountain-m2');
    scene.addLayer('fountain');
    scene.addSystem('fountain', emitter);
    engine.setActiveScene('fountain-m2');

    const debugPanel = new VFX.FountainDebugPanel(engine, emitter);

    // keep the emitter's normalized geometry responsive to the renderer's actual size
    let lastW = engine.renderer.width, lastH = engine.renderer.height;
    let lastQuality = qualityName;
    const syncFrame = () => {
      if (!window.VFX_FOUNTAIN_DEMO) return;
      const w = engine.renderer.width, h = engine.renderer.height;
      if (w !== lastW || h !== lastH) { emitter.resize(w, h); lastW = w; lastH = h; }
      const q = engine.diagnostics.quality;
      if (q !== lastQuality) { emitter.setQualityBudget(VFX.FOUNTAIN_QUALITY_BUDGETS[q] || budget); lastQuality = q; }
      debugPanel.update();
      requestAnimationFrame(syncFrame);
    };
    requestAnimationFrame(syncFrame);

    engine.start();

    window.VFX_FOUNTAIN_DEMO = { engine, scene, emitter, debugPanel, mountEl, unmount };
    console.log('[VFX fountain demo] mounted —', engine.diagnostics, emitter.diagnostics());
  }

  function unmount() {
    if (!window.VFX_FOUNTAIN_DEMO) return;
    const { engine, debugPanel, mountEl } = window.VFX_FOUNTAIN_DEMO;
    window.VFX_FOUNTAIN_DEMO = null; // stop syncFrame's rAF loop first
    debugPanel.destroy();
    engine.destroy();
    mountEl.remove();
    console.log('[VFX fountain demo] unmounted');
  }

  window.VFX_FOUNTAIN_DEMO_MOUNT = mount;
  window.VFX_FOUNTAIN_DEMO_UNMOUNT = unmount;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
