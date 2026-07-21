// vfx-scene.js — a self-contained composition: named z-ordered layers, each holding
// one or more ParticleSystems. Owns exactly one PIXI.Container (added to the
// engine's stage on mount, removed on unmount) so a scene can be swapped in/out
// without tearing down the renderer itself.
window.VFX = window.VFX || {};

VFX.Scene = class Scene {
  constructor(name) {
    this.name = name;
    this.root = new PIXI.Container();
    this._layers = new Map(); // name -> PIXI.Container
    this._systems = []; // { system, layer }
    this.mounted = false;
  }

  /** @returns {PIXI.Container} */
  addLayer(name, zIndex = this._layers.size) {
    if (this._layers.has(name)) return this._layers.get(name);
    const layer = new PIXI.Container();
    layer.zIndex = zIndex;
    this.root.sortableChildren = true;
    this.root.addChild(layer);
    this._layers.set(name, layer);
    return layer;
  }

  /** @param {VFX.ParticleSystem} system */
  addSystem(layerName, system) {
    const layer = this._layers.get(layerName) || this.addLayer(layerName);
    layer.addChild(system.container);
    this._systems.push({ system, layer });
    return system;
  }

  mount(stage) {
    if (this.mounted) return;
    stage.addChild(this.root);
    this.mounted = true;
  }

  unmount() {
    if (!this.mounted) return;
    this.root.parent?.removeChild(this.root);
    this.mounted = false;
  }

  /** @param {number} dt fixed-timestep seconds @param {number} t sim time @param {number} turbulence */
  update(dt, t, turbulence) {
    for (const { system } of this._systems) system.update(dt, t, turbulence);
  }

  /** @param {{maxParticles:number}} preset */
  applyQuality(preset) {
    for (const { system } of this._systems) system.setMaxActive(preset.maxParticles);
  }

  resize(_width, _height) {
    // v1 layers are viewport-relative (spawn zones use absolute coords passed in at
    // construction); a future milestone can make zones proportional and re-derive
    // them here. No-op today but kept as an explicit lifecycle hook per requirement.
  }

  /** @returns {{system: VFX.ParticleSystem, layer: PIXI.Container}[]} read-only view for diagnostics */
  getSystems() { return this._systems; }

  get totalActiveCount() {
    return this._systems.reduce((sum, { system }) => sum + system.activeCount, 0);
  }

  destroy() {
    this.unmount();
    for (const { system } of this._systems) system.destroy();
    this._systems.length = 0;
    this._layers.clear();
    this.root.destroy({ children: true });
  }
};
