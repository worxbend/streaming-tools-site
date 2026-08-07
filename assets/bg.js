/* worxbend — interactive background engine.

   A standalone particle network: nodes drift under low-frequency noise, connect
   to their neighbours into springs, and light up as the cursor drags energy
   through the mesh. It owns one fullscreen canvas behind the page and knows
   nothing about the site's markup.

     BackgroundEngine
     ├── Configuration     every tunable, in one object
     ├── ParticleSystem    flat typed arrays, allocated once
     ├── SpatialHash       uniform grid, counting sort, O(n) neighbour search
     ├── PhysicsSystem     integration, damping, noise wind, soft bounds
     ├── ConnectionSystem  neighbour pairs rebuilt each frame
     ├── SpringSystem      Hooke's law along each connection
     ├── InteractionSystem cursor attraction, click ripples
     ├── EnergySystem      injection at the cursor, propagation along edges
     ├── Renderer          Canvas2D by default, WebGL (PixiJS) when offered
     └── AnimationLoop     rAF, paused while the tab is hidden

   Nothing inside the frame loop allocates: the arrays below are sized once at
   start and reused for the life of the page.                                */

(function () {
  "use strict";

  /* ================================================================ config */

  var CONFIG = {
    /* density — resolved against viewport area, then clamped to the tier */
    areaPerParticle: 8600,
    minParticles: 60,
    maxParticles: 340,

    /* motion */
    damping: 0.972,
    maxSpeed: 46,
    noiseAmount: 5.4,        // px/s² of "wind"
    noiseScale: 0.0016,      // spatial frequency of the wind field
    noiseSpeed: 0.055,       // how fast the wind field itself drifts
    boundaryMargin: 60,
    boundaryPush: 42,

    /* connections */
    connectDistance: 138,
    maxEdgesPerParticle: 6,

    /* springs */
    springStiffness: 1.6,
    springRestFactor: 0.78,  // rest length as a fraction of connectDistance
    springDamping: 0.9,

    /* cursor */
    attractRadius: 230,
    attractStrength: 5200,   // divided by distance², then clamped
    attractMax: 210,
    swirl: 0.34,             // tangential share, so particles orbit not collide
    rippleStrength: 300,
    rippleRadius: 420,

    /* energy */
    energyRadius: 190,
    energyGain: 2.6,
    energyDecay: 0.955,
    energyPropagate: 0.19,
    energyMax: 1,

    /* look */
    particleRadius: 1.5,
    particleRadiusJitter: 1.4,
    glowRadiusFactor: 5.2,
    lineWidth: 1,
    vibrationAmplitude: 7,
    vibrationFrequency: 3.1,
    fadeIn: 1.6,             // seconds
    speed: 1
  };

  var BUCKETS = 6;           // brightness buckets — one stroke per bucket
  var TWO_PI = Math.PI * 2;

  /* ================================================================ palette

     Read straight off the stylesheet so the engine follows the theme without
     knowing which themes exist. Re-read on `themechange`.                   */

  var palette = {
    node: [190, 172, 244],
    link: [150, 140, 190],
    hot: [180, 154, 240],
    hotter: [143, 240, 189],
    alphaNode: 0.62,
    alphaLink: 0.3,
    additive: true
  };

  function readTriplet(styles, name, fallback) {
    var raw = styles.getPropertyValue(name).trim();
    if (!raw) return fallback;
    var parts = raw.split(/[\s,]+/).map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return fallback;
    return parts;
  }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    palette.node = readTriplet(cs, "--fx-node", palette.node);
    palette.link = readTriplet(cs, "--fx-link", palette.link);
    palette.hot = readTriplet(cs, "--fx-c1", palette.hot);
    palette.hotter = readTriplet(cs, "--fx-c4", palette.hotter);
    var an = parseFloat(cs.getPropertyValue("--fx-alpha-node"));
    var al = parseFloat(cs.getPropertyValue("--fx-alpha-link"));
    if (!isNaN(an)) palette.alphaNode = an;
    if (!isNaN(al)) palette.alphaLink = al;
    palette.additive = cs.getPropertyValue("--fx-composite").trim() !== "source-over";
  }

  /* Blend node → hot → hotter as energy rises: idle, interaction, high. */
  function mixColour(out, e) {
    var a, b, t;
    if (e < 0.5) { a = palette.node; b = palette.hot; t = e * 2; }
    else { a = palette.hot; b = palette.hotter; t = (e - 0.5) * 2; }
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }

  /* ======================================================== value noise

     A cheap 2D field built from a hashed lattice with smooth interpolation —
     enough for a breathing drift, and free of allocations.                  */

  function hash2(ix, iy, seed) {
    var h = ix * 374761393 + iy * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0xffff) / 0xffff - 0.5;
  }

  function noise2(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = x - x0, fy = y - y0;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var n00 = hash2(x0, y0, seed), n10 = hash2(x0 + 1, y0, seed);
    var n01 = hash2(x0, y0 + 1, seed), n11 = hash2(x0 + 1, y0 + 1, seed);
    var a = n00 + (n10 - n00) * sx;
    var b = n01 + (n11 - n01) * sx;
    return a + (b - a) * sy;
  }

  /* ============================================================= the engine */

  function Engine(cfg) {
    this.cfg = cfg;
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.life = 0;                 // fade-in progress, 0..1

    this.count = 0;
    this.capacity = 0;

    /* ParticleSystem — struct of arrays, allocated once */
    this.px = this.py = this.vx = this.vy = this.ax = this.ay = null;
    this.pr = this.pm = this.pe = null;

    /* SpatialHash */
    this.cellSize = cfg.connectDistance;
    this.cols = this.rows = 0;
    this.cellCount = new Int32Array(0);
    this.cellStart = new Int32Array(0);
    this.cellItems = new Int32Array(0);
    this.cellOf = new Int32Array(0);

    /* ConnectionSystem */
    this.ea = this.eb = null;      // endpoints
    this.el = null;                // current length
    this.eEnergy = null;
    this.edgeCount = 0;
    this.edgeCap = 0;
    this.degree = null;

    /* EnergySystem scratch */
    this.eDelta = null;

    /* InteractionSystem */
    this.mx = -9999;
    this.my = -9999;
    this.mActive = false;
    this.ripples = [];             // {x, y, t} — bounded, reused
    this.rippleHead = 0;

    this.colour = [0, 0, 0];
  }

  Engine.prototype.resize = function (w, h) {
    this.w = w;
    this.h = h;

    var cfg = this.cfg;
    var want = Math.round(w * h / cfg.areaPerParticle);
    want = Math.max(cfg.minParticles, Math.min(cfg.maxParticles, want));

    if (want > this.capacity) this.allocate(want);
    var prev = this.count;
    this.count = want;
    for (var i = prev; i < want; i++) this.spawn(i);

    /* grid geometry follows the viewport */
    this.cellSize = cfg.connectDistance;
    this.cols = Math.max(1, Math.ceil(w / this.cellSize) + 1);
    this.rows = Math.max(1, Math.ceil(h / this.cellSize) + 1);
    var cells = this.cols * this.rows;
    if (this.cellCount.length < cells + 1) {
      this.cellCount = new Int32Array(cells + 1);
      this.cellStart = new Int32Array(cells + 1);
    }
  };

  Engine.prototype.allocate = function (n) {
    var old = this.capacity;
    function grow(src, Type) {
      var next = new Type(n);
      if (src) next.set(src.subarray(0, Math.min(old, n)));
      return next;
    }
    this.px = grow(this.px, Float32Array);
    this.py = grow(this.py, Float32Array);
    this.vx = grow(this.vx, Float32Array);
    this.vy = grow(this.vy, Float32Array);
    this.ax = grow(this.ax, Float32Array);
    this.ay = grow(this.ay, Float32Array);
    this.pr = grow(this.pr, Float32Array);
    this.pm = grow(this.pm, Float32Array);
    this.pe = grow(this.pe, Float32Array);
    this.eDelta = grow(this.eDelta, Float32Array);
    this.degree = grow(this.degree, Int32Array);
    this.cellOf = grow(this.cellOf, Int32Array);
    this.cellItems = grow(this.cellItems, Int32Array);

    this.edgeCap = n * this.cfg.maxEdgesPerParticle;
    this.ea = new Int32Array(this.edgeCap);
    this.eb = new Int32Array(this.edgeCap);
    this.el = new Float32Array(this.edgeCap);
    this.eEnergy = new Float32Array(this.edgeCap);

    this.capacity = n;
  };

  Engine.prototype.spawn = function (i) {
    var cfg = this.cfg;
    this.px[i] = Math.random() * this.w;
    this.py[i] = Math.random() * this.h;
    this.vx[i] = (Math.random() - 0.5) * 14;
    this.vy[i] = (Math.random() - 0.5) * 14;
    this.ax[i] = this.ay[i] = 0;
    this.pr[i] = cfg.particleRadius + Math.random() * cfg.particleRadiusJitter;
    this.pm[i] = 0.6 + this.pr[i] * 0.5;
    this.pe[i] = 0;
  };

  /* ------------------------------------------------------- SpatialHash */

  Engine.prototype.hashParticles = function () {
    var n = this.count, cols = this.cols, rows = this.rows;
    var cells = cols * rows;
    var count = this.cellCount, start = this.cellStart;

    for (var c = 0; c <= cells; c++) count[c] = 0;

    var inv = 1 / this.cellSize;
    for (var i = 0; i < n; i++) {
      var cx = this.px[i] * inv | 0;
      var cy = this.py[i] * inv | 0;
      if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
      var id = cy * cols + cx;
      this.cellOf[i] = id;
      count[id]++;
    }

    // prefix sum → bucket offsets, then a counting sort into cellItems
    var run = 0;
    for (var k = 0; k < cells; k++) {
      start[k] = run;
      run += count[k];
      count[k] = start[k];
    }
    start[cells] = run;
    for (var j = 0; j < n; j++) this.cellItems[count[this.cellOf[j]]++] = j;
  };

  /* -------------------------------------- ConnectionSystem + SpringSystem */

  Engine.prototype.connect = function (dt) {
    var cfg = this.cfg;
    var n = this.count, cols = this.cols, rows = this.rows;
    var maxD = cfg.connectDistance, maxD2 = maxD * maxD;
    var rest = maxD * cfg.springRestFactor;
    var k = cfg.springStiffness;
    var cap = cfg.maxEdgesPerParticle;

    var degree = this.degree;
    for (var d = 0; d < n; d++) degree[d] = 0;
    this.edgeCount = 0;

    for (var i = 0; i < n; i++) {
      if (degree[i] >= cap) continue;
      var cell = this.cellOf[i];
      var cy = (cell / cols) | 0, cx = cell - cy * cols;

      for (var oy = -1; oy <= 1; oy++) {
        var yy = cy + oy;
        if (yy < 0 || yy >= rows) continue;
        for (var ox = -1; ox <= 1; ox++) {
          var xx = cx + ox;
          if (xx < 0 || xx >= cols) continue;

          var id = yy * cols + xx;
          var from = this.cellStart[id], to = this.cellStart[id + 1];
          for (var s = from; s < to; s++) {
            var j = this.cellItems[s];
            if (j <= i) continue;                       // each pair once
            if (degree[i] >= cap || degree[j] >= cap) continue;

            var dx = this.px[j] - this.px[i];
            var dy = this.py[j] - this.py[i];
            var d2 = dx * dx + dy * dy;
            if (d2 > maxD2 || d2 < 1e-4) continue;

            var dist = Math.sqrt(d2);
            var e = this.edgeCount;
            if (e >= this.edgeCap) { oy = 2; ox = 2; break; }

            this.ea[e] = i;
            this.eb[e] = j;
            this.el[e] = dist;
            this.eEnergy[e] = (this.pe[i] + this.pe[j]) * 0.5;
            this.edgeCount++;
            degree[i]++;
            degree[j]++;

            /* SpringSystem — Hooke's law, softened by how far apart they are
               so the far end of the range pulls almost not at all, plus a
               damper on the closing speed so the mesh settles instead of
               ringing. */
            var falloff = 1 - dist / maxD;
            var inv = 1 / dist;
            var nx = dx * inv, ny = dy * inv;
            var closing = (this.vx[j] - this.vx[i]) * nx + (this.vy[j] - this.vy[i]) * ny;
            var force = (k * (dist - rest) + cfg.springDamping * closing) * falloff * falloff;
            var fx = nx * force;
            var fy = ny * force;
            this.ax[i] += fx / this.pm[i];
            this.ay[i] += fy / this.pm[i];
            this.ax[j] -= fx / this.pm[j];
            this.ay[j] -= fy / this.pm[j];
          }
        }
      }
    }
  };

  /* ---------------------------------------------------- InteractionSystem */

  Engine.prototype.interact = function (dt) {
    var cfg = this.cfg;

    if (this.mActive) {
      var R = cfg.attractRadius, R2 = R * R;
      for (var i = 0; i < this.count; i++) {
        var dx = this.mx - this.px[i];
        var dy = this.my - this.py[i];
        var d2 = dx * dx + dy * dy;
        if (d2 > R2 || d2 < 1) continue;

        var dist = Math.sqrt(d2);
        // inverse-square, clamped so nothing snaps to the cursor
        var mag = cfg.attractStrength / d2;
        if (mag > cfg.attractMax) mag = cfg.attractMax;
        var inv = 1 / dist;
        var nx = dx * inv, ny = dy * inv;

        // a tangential share turns the pull into an orbit
        this.ax[i] += (nx - ny * cfg.swirl) * mag;
        this.ay[i] += (ny + nx * cfg.swirl) * mag;
      }
    }

    /* ripples — an outward impulse riding a expanding shell */
    for (var r = 0; r < this.ripples.length; r++) {
      var rp = this.ripples[r];
      if (rp.t >= 1) continue;
      rp.t += dt * 1.1;
      var radius = rp.t * cfg.rippleRadius;
      var band = 70;
      var power = (1 - rp.t) * cfg.rippleStrength;
      for (var p = 0; p < this.count; p++) {
        var ddx = this.px[p] - rp.x, ddy = this.py[p] - rp.y;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        var off = Math.abs(dd - radius);
        if (off > band) continue;
        var w = (1 - off / band) * power;
        this.ax[p] += (ddx / dd) * w;
        this.ay[p] += (ddy / dd) * w;
        var gain = w / cfg.rippleStrength;
        if (gain > 0) this.pe[p] = Math.min(cfg.energyMax, this.pe[p] + gain * 0.5);
      }
    }
  };

  /* --------------------------------------------------------- EnergySystem */

  Engine.prototype.energise = function (dt) {
    var cfg = this.cfg;
    var n = this.count;
    var decay = Math.pow(cfg.energyDecay, dt * 60);

    /* injection: the cursor charges what it passes over */
    if (this.mActive) {
      var R = cfg.energyRadius, R2 = R * R;
      for (var i = 0; i < n; i++) {
        var dx = this.mx - this.px[i], dy = this.my - this.py[i];
        var d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        var near = 1 - Math.sqrt(d2) / R;
        var e = this.pe[i] + near * near * cfg.energyGain * dt;
        this.pe[i] = e > cfg.energyMax ? cfg.energyMax : e;
      }
    }

    /* propagation: each edge carries a share of the difference across it */
    var delta = this.eDelta;
    for (var z = 0; z < n; z++) delta[z] = 0;

    var flow = cfg.energyPropagate * Math.min(1, dt * 60);
    for (var k = 0; k < this.edgeCount; k++) {
      var a = this.ea[k], b = this.eb[k];
      var diff = this.pe[a] - this.pe[b];
      if (diff > -0.002 && diff < 0.002) continue;
      var move = diff * flow * 0.5;
      delta[a] -= move;
      delta[b] += move;
    }

    for (var m = 0; m < n; m++) {
      var v = (this.pe[m] + delta[m]) * decay;
      this.pe[m] = v < 0.0008 ? 0 : (v > cfg.energyMax ? cfg.energyMax : v);
    }
  };

  /* -------------------------------------------------------- PhysicsSystem */

  Engine.prototype.integrate = function (dt) {
    var cfg = this.cfg;
    var n = this.count;
    var damp = Math.pow(cfg.damping, dt * 60);
    var maxV = cfg.maxSpeed;
    var ns = cfg.noiseScale, nt = this.time * cfg.noiseSpeed;
    var amp = cfg.noiseAmount;
    var margin = cfg.boundaryMargin, push = cfg.boundaryPush;

    for (var i = 0; i < n; i++) {
      var x = this.px[i], y = this.py[i];

      /* noise wind — one field for each axis, sampled at different seeds */
      this.ax[i] += noise2(x * ns + nt, y * ns, 1) * amp;
      this.ay[i] += noise2(x * ns, y * ns + nt, 2) * amp;

      /* soft bounds — a spring back into frame, never a hard bounce */
      if (x < margin) this.ax[i] += (margin - x) / margin * push;
      else if (x > this.w - margin) this.ax[i] -= (x - (this.w - margin)) / margin * push;
      if (y < margin) this.ay[i] += (margin - y) / margin * push;
      else if (y > this.h - margin) this.ay[i] -= (y - (this.h - margin)) / margin * push;

      var vx = (this.vx[i] + this.ax[i] * dt) * damp;
      var vy = (this.vy[i] + this.ay[i] * dt) * damp;

      var sp2 = vx * vx + vy * vy;
      if (sp2 > maxV * maxV) {
        var s = maxV / Math.sqrt(sp2);
        vx *= s; vy *= s;
      }

      this.vx[i] = vx;
      this.vy[i] = vy;
      this.px[i] = x + vx * dt;
      this.py[i] = y + vy * dt;
      this.ax[i] = this.ay[i] = 0;

      /* a particle that somehow escapes is recycled rather than lost */
      if (this.px[i] < -120 || this.px[i] > this.w + 120 ||
          this.py[i] < -120 || this.py[i] > this.h + 120) this.spawn(i);
    }
  };

  Engine.prototype.step = function (dt) {
    dt *= this.cfg.speed;
    this.time += dt;
    this.life = Math.min(1, this.life + dt / this.cfg.fadeIn);

    this.hashParticles();
    this.connect(dt);
    this.interact(dt);
    this.integrate(dt);
    this.energise(dt);
  };

  Engine.prototype.ripple = function (x, y) {
    var slot = this.ripples[this.rippleHead];
    if (!slot) { slot = { x: 0, y: 0, t: 1 }; this.ripples[this.rippleHead] = slot; }
    slot.x = x; slot.y = y; slot.t = 0;
    this.rippleHead = (this.rippleHead + 1) % 4;
  };

  /* ================================================== Canvas2D renderer */

  function Canvas2DRenderer(host) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "bg-layer";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) throw new Error("no 2d context");
    host.appendChild(this.canvas);
    this.dpr = 1;
    this.glow = null;
    this.glowKey = "";
  }

  /* Canvas2D cannot tint a drawImage, so bake one glow sprite per brightness
     bucket at theme time. Six small canvases beat a per-particle radial
     gradient every frame by a wide margin. */
  Canvas2DRenderer.prototype.buildGlow = function () {
    var key = palette.node.join(",") + "|" + palette.hot.join(",") + "|" + palette.hotter.join(",");
    if (this.glowKey === key && this.glow) return;

    var size = 128, half = size / 2;
    var sprites = [];
    var col = [0, 0, 0];

    for (var b = 0; b < BUCKETS; b++) {
      mixColour(col, (b + 0.5) / BUCKETS);
      var rgb = (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0);
      var c = document.createElement("canvas");
      c.width = c.height = size;
      var g = c.getContext("2d");
      var grad = g.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, "rgba(" + rgb + ",1)");
      grad.addColorStop(0.25, "rgba(" + rgb + ",.42)");
      grad.addColorStop(0.6, "rgba(" + rgb + ",.1)");
      grad.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      sprites.push(c);
    }

    this.glow = sprites;
    this.glowKey = key;
  };

  Canvas2DRenderer.prototype.resize = function (w, h, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  };

  Canvas2DRenderer.prototype.draw = function (E) {
    var ctx = this.ctx, cfg = E.cfg;
    this.buildGlow();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, E.w, E.h);
    ctx.globalCompositeOperation = "source-over";

    var life = E.life;
    var col = E.colour;

    /* ---- connections, bucketed by brightness so we stroke six paths, not
       one per edge. Each is a quadratic Bézier whose control point rides a
       sine wave — the string vibrates in proportion to its energy. */
    var amp = cfg.vibrationAmplitude;
    var freq = cfg.vibrationFrequency;
    var t = E.time;
    var maxD = cfg.connectDistance;

    for (var b = 0; b < BUCKETS; b++) {
      var lo = b / BUCKETS, hi = (b + 1) / BUCKETS;
      var mid = (lo + hi) * 0.5;
      var opened = false;

      for (var k = 0; k < E.edgeCount; k++) {
        var energy = E.eEnergy[k];
        var near = 1 - E.el[k] / maxD;           // closer pairs draw stronger
        var bright = near * 0.55 + energy * 0.75;
        if (bright > 1) bright = 1;
        if (bright < lo || bright >= hi) continue;

        var a = E.ea[k], c = E.eb[k];
        var x1 = E.px[a], y1 = E.py[a], x2 = E.px[c], y2 = E.py[c];

        if (!opened) { ctx.beginPath(); opened = true; }

        if (energy > 0.05) {
          var dx = x2 - x1, dy = y2 - y1;
          var len = E.el[k] || 1;
          var wob = Math.sin(t * freq + (a * 0.7 + c * 1.3)) * amp * energy;
          var cxp = (x1 + x2) * 0.5 - (dy / len) * wob;
          var cyp = (y1 + y2) * 0.5 + (dx / len) * wob;
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(cxp, cyp, x2, y2);
        } else {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
      }

      if (!opened) continue;
      mixColour(col, mid);
      ctx.strokeStyle = "rgba(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "," +
                        (mid * palette.alphaLink * life).toFixed(3) + ")";
      ctx.lineWidth = cfg.lineWidth + mid * 0.7;
      ctx.stroke();
    }

    /* ---- glow halos, additive on dark themes so overlaps bloom */
    if (palette.additive) ctx.globalCompositeOperation = "lighter";
    var sprites = this.glow;
    for (var i = 0; i < E.count; i++) {
      var e = E.pe[i];
      if (e < 0.02) continue;
      var r = E.pr[i] * cfg.glowRadiusFactor * (0.7 + e);
      var bucket = (e * BUCKETS) | 0;
      if (bucket >= BUCKETS) bucket = BUCKETS - 1;
      ctx.globalAlpha = Math.min(0.85, e * 0.7) * life;
      ctx.drawImage(sprites[bucket], E.px[i] - r, E.py[i] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    /* ---- cores and specular centres */
    for (var b2 = 0; b2 < BUCKETS; b2++) {
      var lo2 = b2 / BUCKETS, hi2 = (b2 + 1) / BUCKETS;
      var mid2 = (lo2 + hi2) * 0.5;
      var any = false;
      for (var p = 0; p < E.count; p++) {
        var pe = E.pe[p];
        if (pe < lo2 || pe >= hi2) continue;
        if (!any) { ctx.beginPath(); any = true; }
        var rad = E.pr[p] * (1 + pe * 0.8);
        ctx.moveTo(E.px[p] + rad, E.py[p]);
        ctx.arc(E.px[p], E.py[p], rad, 0, TWO_PI);
      }
      if (!any) continue;
      mixColour(col, mid2);
      ctx.fillStyle = "rgba(" + (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0) + "," +
                      ((palette.alphaNode + mid2 * 0.35) * life).toFixed(3) + ")";
      ctx.fill();
    }
  };

  Canvas2DRenderer.prototype.destroy = function () {
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  /* ============================================ WebGL renderer (PixiJS)

     Same simulation, drawn with the GPU: pooled additive sprites for the
     halos and one Graphics per brightness bucket for the strings.          */

  function PixiRenderer(host, PIXI, app) {
    this.PIXI = PIXI;
    this.app = app;
    this.canvas = app.canvas;
    this.canvas.className = "bg-layer";
    this.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(this.canvas);

    this.stage = app.stage;
    this.lineLayer = new PIXI.Container();
    this.glowLayer = new PIXI.Container();
    this.coreLayer = new PIXI.Container();
    this.stage.addChild(this.lineLayer, this.glowLayer, this.coreLayer);

    this.glowTex = this.softTexture(PIXI, 128, [
      [0, "rgba(255,255,255,1)"], [0.25, "rgba(255,255,255,.42)"],
      [0.6, "rgba(255,255,255,.1)"], [1, "rgba(255,255,255,0)"]
    ]);
    this.coreTex = this.softTexture(PIXI, 32, [
      [0, "rgba(255,255,255,1)"], [0.45, "rgba(255,255,255,.9)"],
      [0.75, "rgba(255,255,255,.25)"], [1, "rgba(255,255,255,0)"]
    ]);

    this.lines = [];
    for (var b = 0; b < BUCKETS; b++) {
      var g = new PIXI.Graphics();
      this.lineLayer.addChild(g);
      this.lines.push(g);
    }
    this.glows = [];
    this.cores = [];
    this.colour = [0, 0, 0];
    this.applyBlend();
  }

  PixiRenderer.prototype.softTexture = function (PIXI, size, stops) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return PIXI.Texture.from(c);
  };

  PixiRenderer.prototype.applyBlend = function () {
    var mode = palette.additive ? "add" : "normal";
    this.glowLayer.blendMode = mode;
    this.coreLayer.blendMode = mode;
    this.lineLayer.blendMode = mode;
  };

  PixiRenderer.prototype.pool = function (list, layer, tex, n) {
    var PIXI = this.PIXI;
    while (list.length < n) {
      var s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.visible = false;
      layer.addChild(s);
      list.push(s);
    }
  };

  PixiRenderer.prototype.resize = function () { /* app.resizeTo handles it */ };

  PixiRenderer.prototype.draw = function (E) {
    var cfg = E.cfg, life = E.life, col = this.colour;
    var maxD = cfg.connectDistance;
    var amp = cfg.vibrationAmplitude, freq = cfg.vibrationFrequency, t = E.time;

    for (var b = 0; b < BUCKETS; b++) {
      var lo = b / BUCKETS, hi = (b + 1) / BUCKETS, mid = (lo + hi) * 0.5;
      var g = this.lines[b];
      g.clear();
      var any = false;

      for (var k = 0; k < E.edgeCount; k++) {
        var energy = E.eEnergy[k];
        var near = 1 - E.el[k] / maxD;
        var bright = near * 0.55 + energy * 0.75;
        if (bright > 1) bright = 1;
        if (bright < lo || bright >= hi) continue;

        var a = E.ea[k], c = E.eb[k];
        var x1 = E.px[a], y1 = E.py[a], x2 = E.px[c], y2 = E.py[c];
        any = true;

        if (energy > 0.05) {
          var dx = x2 - x1, dy = y2 - y1, len = E.el[k] || 1;
          var wob = Math.sin(t * freq + (a * 0.7 + c * 1.3)) * amp * energy;
          g.moveTo(x1, y1);
          g.quadraticCurveTo((x1 + x2) * 0.5 - (dy / len) * wob,
                             (y1 + y2) * 0.5 + (dx / len) * wob, x2, y2);
        } else {
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
        }
      }

      if (!any) continue;
      mixColour(col, mid);
      g.stroke({
        width: cfg.lineWidth + mid * 0.7,
        color: (col[0] << 16) | (col[1] << 8) | col[2],
        alpha: mid * palette.alphaLink * life
      });
    }

    this.pool(this.glows, this.glowLayer, this.glowTex, E.count);
    this.pool(this.cores, this.coreLayer, this.coreTex, E.count);

    for (var i = 0; i < this.glows.length; i++) {
      var gs = this.glows[i], cs = this.cores[i];
      if (i >= E.count) { gs.visible = cs.visible = false; continue; }

      var e = E.pe[i];
      mixColour(col, e);
      var tint = ((col[0] | 0) << 16) | ((col[1] | 0) << 8) | (col[2] | 0);

      gs.visible = e > 0.02;
      if (gs.visible) {
        var r = E.pr[i] * cfg.glowRadiusFactor * (0.7 + e);
        gs.x = E.px[i]; gs.y = E.py[i];
        gs.width = gs.height = r * 2;
        gs.tint = tint;
        gs.alpha = Math.min(0.85, e * 0.7) * life;
      }

      cs.visible = true;
      var cr = E.pr[i] * (1 + e * 0.8) * 3.2;
      cs.x = E.px[i]; cs.y = E.py[i];
      cs.width = cs.height = cr;
      cs.tint = tint;
      cs.alpha = (palette.alphaNode + e * 0.35) * life;
    }
  };

  PixiRenderer.prototype.destroy = function () {
    try { this.app.destroy(true, { children: true }); } catch (err) { /* already gone */ }
  };

  /* ================================================== the public surface */

  var engine = null;
  var renderer = null;
  var host = null;
  var raf = null;
  var lastFrame = 0;
  var running = false;
  var dprCap = 1.75;
  var slowFrames = 0;
  var trimmed = false;

  var api = {
    ready: false,
    config: CONFIG,
    start: start,
    useWebGL: useWebGL,
    pulse: pulse,
    refreshTheme: refreshTheme
  };

  function viewport() {
    return {
      w: window.innerWidth || document.documentElement.clientWidth,
      h: window.innerHeight || document.documentElement.clientHeight
    };
  }

  function dpr() {
    return Math.min(dprCap, window.devicePixelRatio || 1);
  }

  function start(opts) {
    opts = opts || {};
    host = opts.host;
    if (!host) return false;

    readPalette();

    var v = viewport();
    engine = new Engine(CONFIG);
    engine.resize(v.w, v.h);

    try {
      renderer = new Canvas2DRenderer(host);
    } catch (err) {
      return false;
    }
    renderer.resize(v.w, v.h, dpr());

    bindInput();
    running = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);

    api.ready = true;
    if (typeof opts.onReady === "function") opts.onReady();
    return true;
  }

  /* Swap the Canvas2D renderer for the GPU one, keeping the simulation as it
     stands. Any failure leaves the 2D renderer in place. */
  function useWebGL(PIXI) {
    if (!engine || !PIXI || !host) return Promise.reject(new Error("engine not started"));
    if (renderer instanceof PixiRenderer) return Promise.resolve(api);

    var app = new PIXI.Application();
    return app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: dpr(),
      autoDensity: true,
      resizeTo: window,
      powerPreference: "low-power",
      preference: "webgl"
    }).then(function () {
      var next = new PixiRenderer(host, PIXI, app);
      var prev = renderer;
      renderer = next;
      // the new canvas is already in the DOM; drop the old one a beat later so
      // the swap is not visible as a gap
      setTimeout(function () { try { prev.destroy(); } catch (e) { /* ignore */ } }, 60);
      return api;
    });
  }

  function pulse(x, y) {
    if (!engine) return;
    engine.ripple(
      typeof x === "number" ? x : engine.w / 2,
      typeof y === "number" ? y : engine.h / 2
    );
  }

  function refreshTheme() {
    readPalette();
    if (renderer) {
      if (renderer.applyBlend) renderer.applyBlend();
      if (renderer.buildGlow) { renderer.glowKey = ""; renderer.buildGlow(); }
    }
  }

  /* --------------------------------------------------------------- input */

  function bindInput() {
    window.addEventListener("pointermove", function (ev) {
      engine.mx = ev.clientX;
      engine.my = ev.clientY;
      engine.mActive = true;
    }, { passive: true });

    window.addEventListener("pointerdown", function (ev) {
      engine.mx = ev.clientX;
      engine.my = ev.clientY;
      engine.mActive = true;
      engine.ripple(ev.clientX, ev.clientY);
    }, { passive: true });

    document.addEventListener("pointerleave", function () { engine.mActive = false; });
    window.addEventListener("blur", function () { engine.mActive = false; });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var v = viewport();
        engine.resize(v.w, v.h);
        renderer.resize(v.w, v.h, dpr());
      }, 140);
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });

    window.addEventListener("pagehide", function () {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    });
  }

  /* -------------------------------------------------------- AnimationLoop */

  function frame(now) {
    if (!running) { raf = null; return; }
    raf = requestAnimationFrame(frame);

    var ms = now - lastFrame;
    lastFrame = now;
    if (ms < 0) ms = 16;
    if (ms > 60) ms = 60;                      // never integrate a long stall

    /* shed density rather than frame rate on machines that cannot keep up */
    if (!trimmed) {
      slowFrames = ms > 26 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 110) {
        trimmed = true;
        engine.count = Math.max(CONFIG.minParticles, (engine.count * 0.6) | 0);
        CONFIG.glowRadiusFactor *= 0.8;
        dprCap = 1;
        var v = viewport();
        renderer.resize(v.w, v.h, dpr());
      }
    }

    try {
      engine.step(ms / 1000);
      renderer.draw(engine);
    } catch (err) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (window.console && console.warn) console.warn("[worxbend] background stopped:", err);
      if (renderer) renderer.destroy();
    }
  }

  window.WB_BG = api;
})();
