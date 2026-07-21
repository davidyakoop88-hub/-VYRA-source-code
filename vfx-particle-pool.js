// vfx-particle-pool.js — generic fixed-capacity object pool. Pre-allocates every
// instance up front (prewarm) so steady-state spawning never calls `new` or triggers
// GC; acquire()/release() just flip an active flag and shuffle two arrays.
window.VFX = window.VFX || {};

VFX.ParticlePool = class ParticlePool {
  /**
   * @param {() => any} factory - creates one poolable instance
   * @param {number} capacity
   */
  constructor(factory, capacity) {
    this.capacity = capacity;
    this._factory = factory;
    this._free = [];
    this._active = new Set();
    for (let i = 0; i < capacity; i++) this._free.push(factory());
  }

  /** @returns {any|null} an instance, or null if the pool is exhausted */
  acquire() {
    const item = this._free.pop();
    if (!item) return null;
    this._active.add(item);
    return item;
  }

  release(item) {
    if (!this._active.has(item)) return;
    this._active.delete(item);
    if (item.deactivate) item.deactivate();
    this._free.push(item);
  }

  releaseAll() {
    for (const item of [...this._active]) this.release(item);
  }

  get activeCount() { return this._active.size; }
  get freeCount() { return this._free.length; }
  get usageRatio() { return this.capacity ? this._active.size / this.capacity : 0; }

  forEachActive(fn) { this._active.forEach(fn); }

  destroy() {
    this.releaseAll();
    for (const item of this._free) { if (item.destroy) item.destroy(); }
    this._free.length = 0;
    this._active.clear();
  }
};
