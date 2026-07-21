// vfx-trail-pool.js — short tapered trails for a percentage of hearts. Each Trail
// owns exactly one pooled PIXI.Graphics object for its entire lifetime: positions are
// pushed into a small ring buffer, and the trail is cleared + redrawn (not recreated)
// every fixed tick as one continuous tapered polyline. This is NOT one Graphics
// object per segment per frame — it's one Graphics object per *trail*, reused.
//
// Performance tradeoff (documented, not hidden): PIXI.Graphics objects aren't part of
// ParticleContainer's batched rendering, so each active trail is its own WebGL draw
// call — trail count contributes linearly to draw-call count, unlike hearts/sparkles
// which batch into one draw call per container regardless of count. This is exactly
// why trail length AND trail eligibility (only some hearts get one) are both quality-
// gated: Low disables trails entirely, Ultra allows the longest/most.
window.VFX = window.VFX || {};

VFX.Trail = class Trail {
  constructor(maxPoints) {
    this.graphics = new PIXI.Graphics();
    this.maxPoints = maxPoints;
    this.points = [];
    this.active = false;
    this.color = 0xffffff;
    this.baseAlpha = 0.55;
    this.baseWidth = 4;
  }

  reset({ color = 0xffffff, alpha = 0.55, width = 4 } = {}) {
    this.points.length = 0;
    this.color = color;
    this.baseAlpha = alpha;
    this.baseWidth = width;
    this.active = true;
    this.graphics.visible = true;
    this.graphics.clear();
  }

  pushPoint(x, y) {
    this.points.push(x, y);
    if (this.points.length > this.maxPoints * 2) this.points.splice(0, 2);
  }

  redraw() {
    const g = this.graphics;
    g.clear();
    const n = this.points.length / 2;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1); // 0 = oldest (tail), 1 = newest (head)
      const alpha = this.baseAlpha * t * t;
      const width = Math.max(0.5, this.baseWidth * (0.25 + 0.75 * t));
      g.lineStyle(width, this.color, alpha);
      g.moveTo(this.points[(i - 1) * 2], this.points[(i - 1) * 2 + 1]);
      g.lineTo(this.points[i * 2], this.points[i * 2 + 1]);
    }
  }

  deactivate() {
    this.active = false;
    this.graphics.visible = false;
    this.graphics.clear();
    this.points.length = 0;
  }

  destroy() { this.graphics.destroy(); }
};

VFX.TrailPool = class TrailPool {
  /**
   * @param {PIXI.Container} container - trails layer, inserted at the correct render-order slot
   * @param {number} maxPoints - trail length; quality-dependent
   * @param {number} capacity
   */
  constructor(container, maxPoints, capacity) {
    this.container = container;
    this.maxPoints = maxPoints;
    this._forcedRecycleCount = 0;
    this.pool = new VFX.ParticlePool(() => {
      const trail = new VFX.Trail(maxPoints);
      container.addChild(trail.graphics);
      trail.graphics.visible = false;
      return trail;
    }, capacity);
  }

  acquire(opts) {
    const trail = this.pool.acquire();
    if (!trail) { this._forcedRecycleCount++; return null; }
    trail.reset(opts);
    return trail;
  }

  release(trail) { if (trail) this.pool.release(trail); }

  redrawAll() { this.pool.forEachActive(t => t.redraw()); }

  get activeCount() { return this.pool.activeCount; }
  get capacity() { return this.pool.capacity; }
  get forcedRecycleCount() { return this._forcedRecycleCount; }

  destroy() { this.pool.destroy(); }
};
