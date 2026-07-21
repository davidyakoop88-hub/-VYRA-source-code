// vfx-engine.js — top-level orchestrator and the module other code is meant to talk
// to. Owns the renderer, fixed-timestep ticker, quality/performance monitors, the
// procedural texture cache, and a registry of Scenes. destroy() tears every one of
// those down in dependency order — this is the single cleanup path the "mount/
// unmount" and "no leaked listeners/contexts" requirements are verified against.
window.VFX = window.VFX || {};

VFX.Engine = class Engine {
  /** @param {VFX.VfxEngineOptions} opts */
  constructor(opts) {
    if (!opts?.mountEl) throw new Error('[VFX] Engine requires opts.mountEl');
    this.mountEl = opts.mountEl;

    this.perf = new VFX.PerformanceMonitor();
    this.quality = new VFX.QualityManager(this.perf, opts.quality || VFX.QualityMode.AUTO);
    const initialPreset = this.quality.resolve();

    this.renderer = new VFX.Renderer(this.mountEl, { resolutionScale: initialPreset.resolutionScale });
    this.textures = new VFX.TextureRegistry(this.renderer.app.renderer);

    this.scenes = new Map();
    this.activeScene = null;
    this._currentPreset = initialPreset;
    this._skipCounter = 0;

    this.debug = opts.debug ? new VFX.DebugOverlay(this) : null;

    this.ticker = new VFX.Ticker(
      dt => this._fixedUpdate(dt),
      (_alpha, now) => this._render(now)
    );

    this._destroyed = false;
  }

  createScene(name) {
    const scene = new VFX.Scene(name);
    this.scenes.set(name, scene);
    return scene;
  }

  setActiveScene(name) {
    if (this.activeScene) this.activeScene.unmount();
    const scene = this.scenes.get(name);
    if (!scene) { this.activeScene = null; return; }
    scene.mount(this.renderer.stage);
    this.activeScene = scene;
  }

  start() { this.ticker.start(); }
  stop() { this.ticker.stop(); }

  _fixedUpdate(dt) {
    const preset = this.quality.resolve();
    if (preset.name !== this._currentPreset.name) {
      this.renderer.setResolutionScale(preset.resolutionScale);
      this.activeScene?.applyQuality?.(preset);
    }
    this._currentPreset = preset;

    this._skipCounter++;
    if (this._skipCounter % preset.tickSkip !== 0) return;
    const effectiveDt = dt * preset.tickSkip;

    this.activeScene?.update(effectiveDt, this.ticker.simTime, preset.turbulence);
  }

  _render(now) {
    this.perf.tick(now);
    this.renderer.renderFrame();
    this.debug?.update();
  }

  get diagnostics() {
    return {
      fps: this.perf.fps,
      avgFrameMs: this.perf.avgFrameMs,
      quality: this._currentPreset.name,
      activeParticles: this.activeScene?.totalActiveCount ?? 0,
      reducedMotion: this.quality.reducedMotion
    };
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.ticker.destroy();
    this.debug?.destroy();
    for (const scene of this.scenes.values()) scene.destroy();
    this.scenes.clear();
    this.activeScene = null;
    this.textures.destroy();
    this.quality.destroy();
    this.renderer.destroy();
  }
};
