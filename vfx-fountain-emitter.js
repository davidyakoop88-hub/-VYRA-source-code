// vfx-fountain-emitter.js — the reusable premium fountain composite. Orchestrates
// 7 flow lanes (bezier paths, normalized), 3 depth layers, crystal hearts, sparkles,
// trails, and the source portal into one object that satisfies the Scene/system duck
// type from Milestone 1 (.container, .update(dt,t,turbulence), .destroy(),
// .activeCount) — so it plugs into VFX.Scene.addSystem() with zero changes to
// vfx-scene.js.
//
// Motion model: particles do NOT move via BaseParticle's vx/vy integration. Each
// carries a lane index + a normalized "path progress" (pathT, 0 at the source, 1 at
// the top fade line, and allowed to overshoot past 1 while extrapolating the lane's
// final tangent, fading out before removal). Position each tick = bezierPoint(lane,
// pathT) converted from normalized to pixel space using the emitter's CURRENT
// width/height — this is what makes spawn geometry responsive to resize, fixing the
// Milestone 1 limitation. Small perpendicular drift, scale shimmer, and rotation all
// come from FlowField's seeded noise, not fresh per-frame randomness.
window.VFX = window.VFX || {};

function vfxClamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function vfxLerp(a, b, t) { return a + (b - a) * t; }

const VFX_HEART_VARIANTS = ['violet', 'pink', 'blue', 'gold'];
const VFX_SIZE_WEIGHTS = [['TINY', 0.35], ['SMALL', 0.40], ['MEDIUM', 0.20], ['HERO', 0.05]];

function vfxWeightedPick(weights, rand) {
  let r = rand(), acc = 0;
  for (const [value, w] of weights) { acc += w; if (r <= acc) return value; }
  return weights[weights.length - 1][0];
}

VFX.FountainEmitter = class FountainEmitter {
  /**
   * @param {Object} opts
   * @param {VFX.TextureRegistry} opts.textureRegistry
   * @param {number} opts.width - logical (CSS-pixel) canvas width
   * @param {number} opts.height
   * @param {Object} [opts.budget] - one of VFX.FOUNTAIN_QUALITY_BUDGETS[...]
   * @param {number} [opts.seed]
   */
  constructor(opts) {
    this.registry = opts.textureRegistry;
    this.width = opts.width;
    this.height = opts.height;
    this.budget = opts.budget || VFX.FOUNTAIN_QUALITY_BUDGETS.high;
    this.seed = opts.seed ?? 777;
    this.flowField = new VFX.FlowField(this.seed, VFX.FLOW_LANES.length, { x: 0, width: 1 }, 24);

    this.container = new PIXI.Container();

    this.sourceLayer = new PIXI.Container();
    this.container.addChild(this.sourceLayer);
    this.source = new VFX.FountainSource(this.sourceLayer, this.registry);

    const RENDER_ORDER = ['dust', 'bgSparkle', 'bgHeart', 'midSparkle', 'trails', 'midHeart', 'fgHeart', 'fgStar'];
    this._layerContainers = {};
    for (const name of RENDER_ORDER) {
      const isTrails = name === 'trails';
      const c = isTrails
        ? new PIXI.Container()
        : new PIXI.ParticleContainer(1000, { vertices: false, position: true, rotation: true, uvs: false, alpha: true, tint: true });
      this._layerContainers[name] = c;
      this.container.addChild(c);
    }
    // PIXI.ParticleContainer batches ignore per-child blendMode — only the container's
    // own blendMode applies. fgStar is the one layer that wants additive glow.
    this._layerContainers.fgStar.blendMode = PIXI.BLEND_MODES.ADD;

    this.trailPool = new VFX.TrailPool(this._layerContainers.trails, this.budget.trailLength || 6, this._trailCapacity());

    this._laneUsage = new Array(VFX.FLOW_LANES.length).fill(0);
    this._forcedRecycleCount = 0;
    this._paused = false;
    this._intensityUser = 1;
    this._spawnRateMul = 1;
    this._turbulenceOverride = null;
    this._widthMul = 1;
    this._rand = Math.random;

    this._channels = this._buildChannels();

    // entrance gating — channel name -> 0..1 spawn gate, ramped by GSAP timeline
    this._gates = { source: 0, rings: 0, sparkle: 0, smallHeart: 0, mediumHeart: 0, fullIdle: 0 };
    this._entranceTimeline = null;
    this.playEntrance();
  }

  _trailCapacity() {
    // pools can't grow after construction, so trail capacity (like every channel's
    // pool capacity below) is sized against Ultra's budget — the maximum this
    // emitter could ever need — while the *active* cap enforced each tick tracks
    // the current budget via ch.maxActive / this.budget.trailChance.
    const ultra = VFX.FOUNTAIN_QUALITY_BUDGETS.ultra;
    return Math.max(8, Math.round(ultra.maxActive * ultra.trailChance * 1.5));
  }

  _channelCapacity(populationShare) {
    const ultra = VFX.FOUNTAIN_QUALITY_BUDGETS.ultra;
    return Math.max(4, Math.round(ultra.maxActive * populationShare));
  }

  _buildChannels() {
    const depths = VFX.FOUNTAIN_DEPTH_LAYERS;
    const mk = (name, layer, factory, spawnRate, depthKey, gateKey, extra = {}) => {
      const depth = depthKey ? depths[depthKey] : null;
      const share = (depth ? depth.populationShare : 0.5) * (extra.shareMul ?? 1);
      // pool capacity is always sized for Ultra (the ceiling) since pools can't grow
      // after construction; maxActive is the *current*-budget soft cap enforced in
      // update() and is what setQualityBudget() actually adjusts.
      const poolCapacity = this._channelCapacity(share);
      const pool = new VFX.ParticlePool(() => {
        const p = factory();
        this._layerContainers[layer].addChild(p.sprite);
        return p;
      }, poolCapacity);
      const maxActive = Math.max(2, Math.round(this.budget.maxActive * share));
      return { name, layer, pool, baseSpawnRate: spawnRate, depth, depthKey, gateKey, share, maxActive, spawnAccumulator: 0, ...extra };
    };

    // shareMul values within each depth must sum to 1.0 — they subdivide that
    // depth's populationShare among its channels (dust+bgSparkle+bgHeart share
    // 'background', midSparkle+midHeart share 'midground', fgHeart+fgStar share
    // 'foreground'). Without this every channel would independently claim the
    // *whole* depth share, over-allocating total capacity by ~2.3x.
    return [
      mk('dust', 'dust', () => new VFX.SparkleParticle(VFX.SparkleTextures.get(this.registry, 'dust')), 6, 'background', 'sparkle', { kind: 'dust', shareMul: 0.35 }),
      mk('bgSparkle', 'bgSparkle', () => new VFX.SparkleParticle(VFX.SparkleTextures.get(this.registry, 'dot')), 8, 'background', 'sparkle', { kind: 'dot', shareMul: 0.40 }),
      mk('bgHeart', 'bgHeart', () => new VFX.CrystalHeartParticle(this._pickHeartTexture()), 3, 'background', 'smallHeart', { isHeart: true, shareMul: 0.25 }),
      mk('midSparkle', 'midSparkle', () => new VFX.SparkleParticle(VFX.SparkleTextures.get(this.registry, 'dot')), 10, 'midground', 'sparkle', { kind: 'dot', shareMul: 0.45 }),
      mk('midHeart', 'midHeart', () => new VFX.CrystalHeartParticle(this._pickHeartTexture()), 6, 'midground', 'mediumHeart', { isHeart: true, trailEligible: true, shareMul: 0.55 }),
      mk('fgHeart', 'fgHeart', () => new VFX.CrystalHeartParticle(this._pickHeartTexture()), 2, 'foreground', 'mediumHeart', { isHeart: true, trailEligible: true, shareMul: 0.65 }),
      mk('fgStar', 'fgStar', () => new VFX.SparkleParticle(VFX.SparkleTextures.get(this.registry, 'star')), 1.2, 'foreground', 'sparkle', { kind: 'star', additive: true, shareMul: 0.35 })
    ];
  }

  _pickHeartTexture() {
    // texture chosen per-instance at pool-prewarm time (once); reset() later just
    // re-tints/scales, it doesn't regenerate geometry — see reset()'s tint usage.
    const variant = VFX_HEART_VARIANTS[Math.floor(Math.random() * VFX_HEART_VARIANTS.length)];
    return VFX.CrystalHeartTextures.get(this.registry, variant, 'MEDIUM');
  }

  // ---- entrance sequence -------------------------------------------------
  playEntrance() {
    if (typeof gsap === 'undefined') { // graceful fallback: snap to idle instantly
      Object.keys(this._gates).forEach(k => (this._gates[k] = 1));
      return;
    }
    this._entranceTimeline?.kill();
    Object.keys(this._gates).forEach(k => (this._gates[k] = 0));
    const g = this._gates;
    const tl = gsap.timeline();
    tl.to(g, { source: 1, duration: 0.35, ease: 'power1.out' }, 0.0);
    tl.to(g, { rings: 1, duration: 0.55, ease: 'back.out(1.4)' }, 0.25);
    tl.to(g, { sparkle: 1, duration: 0.8, ease: 'power2.out' }, 0.4);
    tl.to(g, { smallHeart: 1, duration: 0.9, ease: 'power2.out' }, 0.7);
    tl.to(g, { mediumHeart: 1, duration: 0.9, ease: 'power2.out' }, 1.1);
    tl.to(g, { fullIdle: 1, duration: 0.9, ease: 'power1.inOut' }, 1.6);
    this._entranceTimeline = tl;
  }

  resetEntrance() {
    this._entranceTimeline?.kill();
    Object.keys(this._gates).forEach(k => (this._gates[k] = 0));
    this.clear();
  }

  // ---- dev controls -------------------------------------------------------
  setPaused(v) { this._paused = v; }
  setIntensity(v) { this._intensityUser = vfxClamp01(v); }
  setSpawnRateMultiplier(v) { this._spawnRateMul = Math.max(0, v); }
  setTurbulenceOverride(v) { this._turbulenceOverride = v; }
  setWidthMultiplier(v) { this._widthMul = Math.max(0.2, v); }
  clear() {
    for (const ch of this._channels) ch.pool.forEachActive(p => this._recycle(ch, p));
  }

  /**
   * Satisfies the generic Scene/system duck type — Scene.applyQuality() calls this
   * on every registered system whenever the engine's generic QualityManager mode
   * changes, passing M1's generic per-quality particle cap (VFX.QUALITY_PRESETS).
   * Deliberately a no-op: this emitter has its own richer, independently-tuned
   * FOUNTAIN_QUALITY_BUDGETS (different numbers per level, plus trail/sparkle/bloom
   * settings a single number can't carry) applied via setQualityBudget(), which the
   * fountain demo calls directly whenever it observes a quality change. If this
   * method also wrote ch.maxActive, the two would fight — Scene's generic value
   * overwriting the fountain-specific one on every engine quality tick — causing
   * needless churn between two different numbers for the same quality name.
   */
  setMaxActive(_n) { /* intentionally inert — see setQualityBudget() */ }

  setQualityBudget(budget) {
    this.budget = budget;
    for (const ch of this._channels) {
      ch.maxActive = Math.max(2, Math.round(budget.maxActive * ch.share));
    }
    this.trailPool.maxPoints = budget.trailLength || this.trailPool.maxPoints;
  }

  // ---- responsive resize ---------------------------------------------------
  resize(width, height) {
    this.width = width;
    this.height = height;
    // Positions are recomputed from normalized pathT every tick (see _advanceParticle),
    // so nothing needs to be re-baked here — this is the actual fix for the M1
    // "spawn zones aren't resize-proportional" limitation.
  }

  // ---- main update ----------------------------------------------------------
  /** @param {number} dt fixed-timestep seconds @param {number} t sim time @param {number} turbulence 0..1 */
  update(dt, t, turbulence) {
    const effectiveTurbulence = this._turbulenceOverride ?? turbulence;
    this.source.update(t, this._gates.source * this._intensityUser);
    for (const ring of this.source.rings) ring.sprite.alpha *= this._gates.rings;

    for (const ch of this._channels) {
      if (!this._paused) {
        const gate = this._gates[ch.gateKey] ?? 1;
        const laneWeight = this._laneWeightBias(ch, t);
        const rate = ch.baseSpawnRate * this._spawnRateMul * gate * this._intensityUser * laneWeight;
        if (ch.pool.activeCount < ch.maxActive) {
          ch.spawnAccumulator += rate * dt;
          while (ch.spawnAccumulator >= 1 && ch.pool.activeCount < ch.maxActive) {
            this._spawnInChannel(ch, t);
            ch.spawnAccumulator -= 1;
          }
        } else {
          ch.spawnAccumulator = 0;
        }
      }
      const dead = [];
      ch.pool.forEachActive(p => {
        this._advanceParticle(p, dt, t, effectiveTurbulence);
        if (p.pathT > 1.6 || p.y < -this.height * 0.06) dead.push(p);
      });
      for (const p of dead) this._recycle(ch, p);
    }

    this.trailPool.redrawAll();
  }

  _laneWeightBias(ch, t) {
    // slow, subtle per-channel density variation — not literal per-lane weighting
    // (kept cheap: one noise sample per channel per tick, not per lane)
    return 0.85 + 0.15 * (0.5 + 0.5 * this.flowField.noise2D(ch.name.length * 3.1, t * 0.04));
  }

  _recycle(channel, p) {
    if (p.trail) { this.trailPool.release(p.trail); p.trail = null; }
    channel.pool.release(p);
  }

  _spawnInChannel(channel, t) {
    const laneIndex = Math.floor(this._rand() * VFX.FLOW_LANES.length);
    this._laneUsage[laneIndex] = (this._laneUsage[laneIndex] || 0) + 1;
    const p = channel.pool.acquire();
    if (!p) { this._forcedRecycleCount++; return; }

    const depthCfg = channel.depth || VFX.FOUNTAIN_DEPTH_LAYERS.midground;
    const life = vfxLerp(2.2, 3.4, this._rand()) / depthCfg.speedMul;
    const pathSpeed = 1 / (life * 0.82); // reaches pathT=1 slightly before life ends, then fades in overshoot

    let baseScale, tint, rotationSpeed, shimmerSpeed, hasTrail = false;
    if (channel.isHeart) {
      const sizeCat = vfxWeightedPick(VFX_SIZE_WEIGHTS, this._rand);
      const range = VFX.FOUNTAIN_SIZE_CATEGORIES[sizeCat];
      const px = vfxLerp(range.min, range.max, this._rand());
      baseScale = (px / 58) * depthCfg.scaleMul; // textures are baked at MEDIUM's max (58px)
      const variant = VFX_HEART_VARIANTS[Math.floor(this._rand() * VFX_HEART_VARIANTS.length)];
      tint = VFX.FOUNTAIN_HEART_COLORS[variant].base;
      rotationSpeed = vfxLerp(-0.4, 0.4, this._rand());
      shimmerSpeed = vfxLerp(1.2, 2.4, this._rand());
      hasTrail = !!channel.trailEligible && this.budget.trailsEnabled && this._rand() < this.budget.trailChance;
    } else {
      baseScale = vfxLerp(0.5, 1.1, this._rand()) * depthCfg.scaleMul * (channel.kind === 'dust' ? 0.4 : 1);
      tint = 0xffffff;
      rotationSpeed = channel.kind === 'star' ? vfxLerp(-1.5, 1.5, this._rand()) : 0;
      shimmerSpeed = 0;
    }

    p.reset({
      x: 0, y: 0, vx: 0, vy: 0,
      life,
      scale: baseScale,
      alpha: depthCfg.alphaMul * vfxLerp(0.85, 1, this._rand()),
      tint,
      lane: laneIndex,
      rotation: this._rand() * Math.PI * 2,
      rotationSpeed,
      shimmerSpeed,
      hasTrail,
      kind: channel.kind,
      additive: channel.additive
    });
    p.laneIndex = laneIndex;
    p.pathT = 0;
    p.pathSpeed = pathSpeed;
    p.noiseSeed = this._rand() * 1000;
    p.trail = null;
    if (hasTrail) {
      p.trail = this.trailPool.acquire({ tint, alpha: 0.5 * depthCfg.glowMul, width: baseScale * 6, color: tint });
    }
  }

  _advanceParticle(p, dt, t, turbulence) {
    p.integrate(dt); // age += dt, and rotation += rotationSpeed*dt via subclass override
    p.pathT += p.pathSpeed * dt;

    const lane = VFX.FLOW_LANES[p.laneIndex];
    const [p0, p1, p2, p3] = lane.points;
    const clampedT = Math.min(1, p.pathT);
    const point = VFX.bezierPoint(p0, p1, p2, p3, clampedT);
    let nx = point.x, ny = point.y;

    if (p.pathT > 1) {
      const tangentPoint = VFX.bezierPoint(p0, p1, p2, p3, 0.97);
      const dx = point.x - tangentPoint.x, dy = point.y - tangentPoint.y;
      const overshoot = (p.pathT - 1) * 10;
      nx = point.x + dx * overshoot;
      ny = point.y + dy * overshoot;
    }

    // seeded smooth-noise side drift (normalized units, small)
    const drift = this.flowField.noise2D(p.laneIndex * 5.1 + 0.5, t * 0.35 + p.noiseSeed) * 0.018 * turbulence;
    nx = 0.5 + (nx - 0.5) * this._widthMul + drift;

    p.x = nx * this.width;
    p.y = ny * this.height;

    // fade near the top boundary (topFadeY .. removedY), independent of pathT overshoot math
    const g = VFX.FOUNTAIN_GEOMETRY;
    const fadeStart = g.topFadeY * this.height;
    const fadeEnd = g.removedY * this.height;
    let edgeFade = 1;
    if (p.y < fadeStart) edgeFade = vfxClamp01((p.y - fadeEnd) / (fadeStart - fadeEnd));

    p.syncSprite(); // applies the fade-in/hold/fade-out scale+alpha curve
    p.sprite.alpha *= edgeFade;

    // scale shimmer via seeded noise, multiplied onto (not replacing) the fade curve
    // syncSprite() just applied, so hearts still grow in on spawn and shrink on despawn
    const shimmerNoise = this.flowField.noise2D(p.noiseSeed + 3.7, t * 0.5);
    const shimmerMul = 1 + shimmerNoise * 0.06;
    p.sprite.scale.set(p.sprite.scale.x * shimmerMul);

    if (p.trail) p.trail.pushPoint(p.x, p.y);
  }

  // ---- diagnostics ----------------------------------------------------------
  get activeCount() {
    return this._channels.reduce((sum, ch) => sum + ch.pool.activeCount, 0);
  }

  get poolUsage() {
    const totalCap = this._channels.reduce((s, ch) => s + ch.pool.capacity, 0);
    return totalCap ? this.activeCount / totalCap : 0;
  }

  diagnostics() {
    const byType = {};
    for (const ch of this._channels) byType[ch.name] = ch.pool.activeCount;
    const byDepth = { background: 0, midground: 0, foreground: 0 };
    for (const ch of this._channels) if (ch.depthKey) byDepth[ch.depthKey] += ch.pool.activeCount;
    return {
      totalActive: this.activeCount,
      byType,
      byDepth,
      trailCount: this.trailPool.activeCount,
      trailCapacity: this.trailPool.capacity,
      laneUsage: this._laneUsage.slice(),
      forcedRecycleCount: this._forcedRecycleCount + this.trailPool.forcedRecycleCount,
      sourceIntensity: +(this._gates.source * this._intensityUser).toFixed(2),
      textureCount: this.registry.textureCount,
      textureMemoryBytes: this.registry.estimateMemoryBytes()
    };
  }

  destroy() {
    this._entranceTimeline?.kill();
    for (const ch of this._channels) ch.pool.destroy();
    this.trailPool.destroy();
    this.source.destroy();
    this.container.destroy({ children: true });
  }
};
