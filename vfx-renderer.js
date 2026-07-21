// vfx-renderer.js — thin wrapper around a transparent PIXI.Application. Sizes itself
// to its mount element's actual CSS box via ResizeObserver, so it stays correct
// whether that box is the full viewport (dev demo) or a descendant of the app's own
// transform:scale()'d .canvas element (real overlay-mode widgets, later milestone) —
// clientWidth/clientHeight already reflect final layout size in both cases.
window.VFX = window.VFX || {};

VFX.Renderer = class Renderer {
  /**
   * @param {HTMLElement} mountEl
   * @param {{resolutionScale?: number}} [opts]
   */
  constructor(mountEl, opts = {}) {
    if (typeof PIXI === 'undefined') throw new Error('[VFX] PixiJS not loaded — vendor pixi.min.js must load before vfx-renderer.js');
    this.mountEl = mountEl;
    this.resolutionScale = opts.resolutionScale || 1;

    const rect = mountEl.getBoundingClientRect();
    this.app = new PIXI.Application({
      width: Math.max(1, Math.round(rect.width)) || 1,
      height: Math.max(1, Math.round(rect.height)) || 1,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: (window.devicePixelRatio || 1) * this.resolutionScale,
      powerPreference: 'low-power'
    });

    this.view = this.app.view;
    this.view.style.position = 'absolute';
    this.view.style.inset = '0';
    this.view.style.width = '100%';
    this.view.style.height = '100%';
    this.view.style.pointerEvents = 'none';
    mountEl.appendChild(this.view);

    this.stage = this.app.stage;
    // PIXI's own ticker drives *rendering*; simulation stepping is owned by VFX.Ticker
    // (fixed timestep) so we stop the auto-render loop and render manually each frame.
    this.app.ticker.autoStart = false;
    this.app.ticker.stop();

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) this._applySize(entry.contentRect.width, entry.contentRect.height);
    });
    this._resizeObserver.observe(mountEl);
  }

  _applySize(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.app.renderer.screen.width && h === this.app.renderer.screen.height) return;
    this.app.renderer.resize(w, h);
  }

  setResolutionScale(scale) {
    if (scale === this.resolutionScale) return;
    this.resolutionScale = scale;
    this.app.renderer.resolution = (window.devicePixelRatio || 1) * scale;
    this.app.renderer.resize(this.app.renderer.width, this.app.renderer.height);
  }

  // .screen is the logical (CSS-pixel) drawing area — the correct space for display-
  // object positioning. .width/.height on the renderer itself are physical backing-
  // buffer pixels (resolution-multiplied) and would misplace anything positioned by them.
  get width() { return this.app.renderer.screen.width; }
  get height() { return this.app.renderer.screen.height; }

  renderFrame() { this.app.renderer.render(this.stage); }

  destroy() {
    this._resizeObserver.disconnect();
    this.app.destroy(true, { children: true, texture: false, baseTexture: false });
    this.view.remove();
  }
};
