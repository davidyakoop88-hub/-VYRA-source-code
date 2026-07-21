// vfx-texture-registry.js — generates and caches PIXI.Texture objects procedurally
// (radial-gradient circles drawn with PIXI.Graphics, baked to a texture once) so the
// engine needs zero external image assets. Keyed by name; regenerating the same key
// is a no-op after the first call.
window.VFX = window.VFX || {};

VFX.TextureRegistry = class TextureRegistry {
  /** @param {PIXI.Renderer} renderer */
  constructor(renderer) {
    this.renderer = renderer;
    this._cache = new Map();
  }

  /**
   * Soft radial glow dot, tinted white so sprites can recolor via .tint.
   * @param {string} key
   * @param {number} radius
   */
  getGlowCircle(key, radius = 32) {
    if (this._cache.has(key)) return this._cache.get(key);
    const g = new PIXI.Graphics();
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      const r = radius * (i / steps);
      const alpha = Math.pow(1 - i / steps, 1.6) * 0.9 + (i === 1 ? 0.1 : 0);
      g.beginFill(0xffffff, i === 1 ? 1 : alpha);
      g.drawCircle(radius, radius, r);
      g.endFill();
    }
    const texture = this.renderer.generateTexture(g, {
      resolution: Math.min(2, window.devicePixelRatio || 1),
      region: new PIXI.Rectangle(0, 0, radius * 2, radius * 2)
    });
    g.destroy(true);
    this._cache.set(key, texture);
    return texture;
  }

  get(key) { return this._cache.get(key) || null; }
  has(key) { return this._cache.has(key); }

  destroy() {
    for (const tex of this._cache.values()) tex.destroy(true);
    this._cache.clear();
  }
};
