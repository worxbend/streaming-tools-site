/* worxbend — particle headline.

   Turns the hero <h1> into a cloud of GPU-drawn points that fly in, settle
   into the exact shape of the words, and scatter away from the pointer.

   The trick is that the *browser* still does all the typography. We never try
   to reproduce line breaks or kerning in JavaScript:

     1. Wrap every word of the headline in a throwaway <span>, ask the browser
        where each one landed (getBoundingClientRect), then unwrap them again.
        Layout is untouched — an inline span with no styling is invisible to
        the layout engine.
     2. Paint those words into an offscreen 2D canvas at the same positions,
        using the h1's own computed font. Ordinary words are painted red,
        words inside the .accent span are painted green — that single colour
        channel is how a pixel remembers which run it came from.
     3. Read the pixels back, keep every Nth opaque one, and hand the list of
        coordinates to three.js as a THREE.Points cloud.

   From then on every particle lives in the vertex shader: the fly-in, the
   idle drift and the pointer repulsion are all computed on the GPU from a
   handful of uniforms, so the CPU does nothing per frame but update a mouse
   position. That is what keeps 15k+ points cheap.

   The real <h1> text stays in the DOM the whole time — it is only painted
   transparent. Screen readers, search engines, text selection and
   find-in-page all still see a normal headline, and if anything here throws
   (no WebGL, CDN blocked, prefers-reduced-motion) the class is never added
   and the plain headline simply stays visible.                              */

import * as THREE from "three";

/* ==================================================================== config */

var CONFIG = {
  selector: ".hero-title",

  /* sampling */
  supersample: 2,        // offscreen canvas scale; higher = finer glyph edges
  step: 3,               // sample every Nth device pixel of that canvas
  alphaCutoff: 90,       // 0-255; ignore the faint antialiased fringe
  maxParticles: 30000,   // hard cap, randomly thinned if the text is huge
  pad: 90,               // px of slack around the h1 so pushed particles live

  /* fly-in */
  introDuration: 1.5,    // seconds from full scatter to settled
  introStagger: 0.45,    // fraction of the run each particle is offset within
  scatterRadius: 260,    // px each particle starts away from its target
  scatterDepth: 420,     // px of z spread at the start

  /* idle */
  driftAmount: 1.3,      // px of breathing once settled
  driftSpeed: 0.55,

  /* pointer */
  pointerRadius: 130,    // px of influence
  pointerPush: 62,       // px a particle right under the cursor is shoved
  pointerSwirl: 0.5,     // radians of rotation added to the push direction
  pointerEase: 0.18,     // smoothing of the cursor position, 0-1 per frame

  /* look */
  pointScale: 1.35,      // point size as a multiple of the sample spacing
  gradientSpeed: 0.11    // accent gradient scroll, matches CSS accentflow
};

/* ================================================================== shaders */

var VERT = [
  "uniform float uTime;",
  "uniform float uProgress;",
  "uniform float uSize;",
  "uniform float uPixelRatio;",
  "uniform vec2  uPointer;",
  "uniform float uPointerRadius;",
  "uniform float uPointerPush;",
  "uniform float uPointerSwirl;",
  "uniform float uDrift;",
  "uniform float uDriftSpeed;",
  "uniform float uStagger;",

  "attribute vec3  aScatter;",
  "attribute float aSeed;",
  "attribute float aAccent;",
  "attribute float aSize;",

  "varying float vAccent;",
  "varying float vFade;",
  "varying float vX;",

  "void main() {",
  // Each particle runs the same easing curve, just started at a different
  // moment. aSeed is its random 0-1 slot in the stagger window.
  "  float span = max(1.0 - uStagger, 0.0001);",
  "  float t = clamp((uProgress - aSeed * uStagger) / span, 0.0, 1.0);",
  "  float e = 1.0 - pow(1.0 - t, 3.0);",              // easeOutCubic

  "  vec3 p = mix(position + aScatter, position, e);",

  // Once settled, drift on a slow circle so the block never looks frozen.
  "  float w = uTime * uDriftSpeed + aSeed * 6.2831853;",
  "  p.xy += vec2(sin(w), cos(w * 1.37)) * uDrift * e;",

  // Pointer repulsion: push outward, with a twist so the hole swirls open
  // instead of just expanding.
  "  vec2 d = p.xy - uPointer;",
  "  float dist = length(d);",
  "  float f = 1.0 - smoothstep(0.0, uPointerRadius, dist);",
  "  if (f > 0.0) {",
  "    float a = uPointerSwirl * f;",
  "    vec2 dir = normalize(d + vec2(0.0001));",
  "    dir = vec2(dir.x * cos(a) - dir.y * sin(a), dir.x * sin(a) + dir.y * cos(a));",
  "    p.xy += dir * f * f * uPointerPush;",
  "  }",

  "  vAccent = aAccent;",
  "  vFade = e;",
  "  vX = position.x;",

  "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
  "  gl_Position = projectionMatrix * mv;",
  "  gl_PointSize = uSize * aSize * uPixelRatio;",
  "}"
].join("\n");

var FRAG = [
  // No `precision` line here on purpose: three.js prepends the same precision
  // qualifier to both shaders, and declaring a different one by hand makes
  // uniforms shared with the vertex shader fail to link.

  "uniform vec3  uColorA;",
  "uniform vec3  uColorB;",
  "uniform vec3  uAccentA;",
  "uniform vec3  uAccentB;",
  "uniform float uWidth;",
  "uniform float uTime;",
  "uniform float uGradientSpeed;",
  "uniform float uOpacity;",

  "varying float vAccent;",
  "varying float vFade;",
  "varying float vX;",

  "void main() {",
  // Round, soft-edged dot. Square points read as pixel mush at this density.
  "  float r = length(gl_PointCoord - 0.5);",
  "  float a = smoothstep(0.5, 0.16, r);",
  "  if (a <= 0.002) discard;",

  "  float u = clamp(vX / max(uWidth, 1.0), 0.0, 1.0);",
  "  vec3 col = mix(uColorA, uColorB, u);",
  // The accent run gets the same travelling gradient as the CSS .accent rule.
  "  float g = u * 1.6 - uTime * uGradientSpeed;",
  "  vec3 acc = mix(uAccentA, uAccentB, 0.5 + 0.5 * sin(g * 6.2831853));",
  "  col = mix(col, acc, vAccent);",

  "  gl_FragColor = vec4(col, a * vFade * uOpacity);",
  "}"
].join("\n");

/* ============================================================ colour helpers */

// Reads a CSS custom property off :root and returns it as a THREE.Color.
// Handles both "#rrggbb" and the bare "r g b" triplets this stylesheet uses
// for its rgb(var(--fx-c1) / 20%) colours.
function cssColor(name, fallback) {
  var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) raw = fallback;
  var triplet = raw.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (triplet) {
    return new THREE.Color(
      Number(triplet[1]) / 255,
      Number(triplet[2]) / 255,
      Number(triplet[3]) / 255
    );
  }
  try {
    return new THREE.Color(raw);
  } catch (err) {
    return new THREE.Color(fallback);
  }
}

/* ============================================================ word measuring */

// Wraps every word of `el` in a bare <span>, reads where the browser put it,
// then puts the original markup back. `accentSelector` marks the words that
// live inside the gradient span so they can be coloured differently.
function measureWords(el, accentSelector) {
  var original = el.innerHTML;
  var marker = "data-hp-word";
  var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  var textNodes = [];
  var node;
  while ((node = walker.nextNode())) textNodes.push(node);

  textNodes.forEach(function (text) {
    var chunks = text.nodeValue.split(/(\s+)/);
    if (chunks.length === 1 && !chunks[0].trim()) return;
    var frag = document.createDocumentFragment();
    chunks.forEach(function (chunk) {
      if (!chunk) return;
      if (!chunk.trim()) {
        frag.appendChild(document.createTextNode(chunk));
        return;
      }
      var span = document.createElement("span");
      span.setAttribute(marker, "");
      span.textContent = chunk;
      frag.appendChild(span);
    });
    text.parentNode.replaceChild(frag, text);
  });

  var box = el.getBoundingClientRect();
  var words = [];
  Array.prototype.forEach.call(el.querySelectorAll("[" + marker + "]"), function (span) {
    var r = span.getBoundingClientRect();
    if (!r.width || !r.height) return;
    words.push({
      text: span.textContent,
      x: r.left - box.left,
      top: r.top - box.top,
      accent: !!span.closest(accentSelector)
    });
  });

  el.innerHTML = original;
  return { words: words, width: box.width, height: box.height };
}

/* ================================================================= sampling */

// Paints the measured words into an offscreen canvas and returns one entry per
// surviving pixel: position in CSS pixels relative to the h1 box, plus whether
// it belonged to the accent run.
function sampleWords(measured, fontSpec) {
  var ss = CONFIG.supersample;
  var w = Math.max(1, Math.ceil(measured.width));
  var h = Math.max(1, Math.ceil(measured.height));

  var canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * ss);
  canvas.height = Math.ceil(h * ss);
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.scale(ss, ss);
  ctx.font = fontSpec.font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = fontSpec.letterSpacing;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // An inline box's top edge sits one font-ascent above the baseline, so this
  // puts the canvas text on exactly the same baseline the browser used.
  var probe = ctx.measureText("Hxg");
  var ascent = probe.fontBoundingBoxAscent || probe.actualBoundingBoxAscent || fontSpec.size * 0.8;

  measured.words.forEach(function (word) {
    ctx.fillStyle = word.accent ? "#00ff00" : "#ff0000";
    ctx.fillText(word.text, word.x, word.top + ascent);
  });

  var data;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch (err) {
    return null;                       // tainted canvas; nothing we can do
  }

  var step = CONFIG.step;
  var pts = [];
  for (var y = 0; y < canvas.height; y += step) {
    for (var x = 0; x < canvas.width; x += step) {
      var i = (y * canvas.width + x) * 4;
      if (data[i + 3] < CONFIG.alphaCutoff) continue;
      pts.push({
        x: x / ss,
        y: y / ss,
        accent: data[i + 1] > data[i] ? 1 : 0
      });
    }
  }

  // Thin evenly rather than truncating, so a long headline loses density
  // everywhere instead of losing its last word.
  if (pts.length > CONFIG.maxParticles) {
    var keep = CONFIG.maxParticles / pts.length;
    pts = pts.filter(function () { return Math.random() < keep; });
  }

  return { points: pts, spacing: step / ss, width: w, height: h };
}

/* ============================================================== the effect */

function ParticleHeadline(el) {
  this.el = el;
  this.pad = CONFIG.pad;
  this.canvas = document.createElement("canvas");
  this.canvas.className = "hero-particles";
  this.canvas.setAttribute("aria-hidden", "true");

  this.pointer = { x: -99999, y: -99999, tx: -99999, ty: -99999 };
  this.running = false;
  this.visible = true;
  this.start = 0;
  this.raf = 0;
  this.rebuildTimer = 0;

  this.renderer = new THREE.WebGLRenderer({
    canvas: this.canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance"
  });
  this.renderer.setClearAlpha(0);

  this.scene = new THREE.Scene();
  this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -2000, 2000);

  this.uniforms = {
    uTime:          { value: 0 },
    uProgress:      { value: 0 },
    uSize:          { value: 3 },
    uPixelRatio:    { value: 1 },
    uPointer:       { value: new THREE.Vector2(-99999, -99999) },
    uPointerRadius: { value: CONFIG.pointerRadius },
    uPointerPush:   { value: CONFIG.pointerPush },
    uPointerSwirl:  { value: CONFIG.pointerSwirl },
    uDrift:         { value: CONFIG.driftAmount },
    uDriftSpeed:    { value: CONFIG.driftSpeed },
    uStagger:       { value: CONFIG.introStagger },
    uColorA:        { value: new THREE.Color("#e8e6e1") },
    uColorB:        { value: new THREE.Color("#e8e6e1") },
    uAccentA:       { value: new THREE.Color("#b49af0") },
    uAccentB:       { value: new THREE.Color("#cdbbf7") },
    uWidth:         { value: 1 },
    uGradientSpeed: { value: CONFIG.gradientSpeed },
    uOpacity:       { value: 1 }
  };

  this.material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  this.points = null;
  this.geometry = null;

  this.el.appendChild(this.canvas);
  this.el.classList.add("has-particles");

  this.onPointerMove = this.onPointerMove.bind(this);
  this.onPointerLeave = this.onPointerLeave.bind(this);
  this.frame = this.frame.bind(this);
  this.scheduleRebuild = this.scheduleRebuild.bind(this);
}

ParticleHeadline.prototype.fontSpec = function () {
  var cs = getComputedStyle(this.el);
  var size = parseFloat(cs.fontSize) || 48;
  return {
    size: size,
    font: [cs.fontStyle, cs.fontWeight, cs.fontSize + "/" + cs.lineHeight, cs.fontFamily].join(" "),
    letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing
  };
};

// Reads the current theme's colours. Called again whenever the theme flips.
ParticleHeadline.prototype.syncTheme = function () {
  var dark = document.documentElement.getAttribute("data-theme") !== "light";
  var text = cssColor("--text", "#e8e6e1");

  this.uniforms.uColorA.value.copy(text);
  this.uniforms.uColorB.value.copy(cssColor("--muted", "#9a9791")).lerp(text, 0.45);
  this.uniforms.uAccentA.value.copy(cssColor("--fx-c1", "#b49af0"));
  this.uniforms.uAccentB.value.copy(cssColor("--fx-c5", "#cdbbf7"));

  // On the dark theme the dots are light-on-dark, so adding them together
  // gives a pleasant bloom where they overlap. On the light theme the same
  // maths would bleach the text to white, so blend normally there.
  this.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  this.uniforms.uOpacity.value = dark ? 0.95 : 1;
  this.material.needsUpdate = true;
};

ParticleHeadline.prototype.build = function () {
  // measureWords rewrites the h1's innerHTML, which would replace our canvas
  // with a fresh (and unreferenced) copy of itself. Take it out of the way.
  if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  var measured = measureWords(this.el, ".accent");
  this.el.appendChild(this.canvas);
  if (!measured.words.length) return false;

  var sampled = sampleWords(measured, this.fontSpec());
  if (!sampled || sampled.points.length < 32) return false;

  var n = sampled.points.length;
  var pad = this.pad;
  var position = new Float32Array(n * 3);
  var scatter = new Float32Array(n * 3);
  var seed = new Float32Array(n);
  var accent = new Float32Array(n);
  var size = new Float32Array(n);

  for (var i = 0; i < n; i++) {
    var p = sampled.points[i];
    position[i * 3]     = p.x + pad;
    position[i * 3 + 1] = p.y + pad;
    position[i * 3 + 2] = 0;

    // Start on a random ring around the target, well outside the headline.
    var ang = Math.random() * Math.PI * 2;
    var rad = CONFIG.scatterRadius * (0.35 + Math.random() * 0.65);
    scatter[i * 3]     = Math.cos(ang) * rad;
    scatter[i * 3 + 1] = Math.sin(ang) * rad * 0.6;
    scatter[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.scatterDepth;

    seed[i] = Math.random();
    accent[i] = p.accent;
    size[i] = 0.75 + Math.random() * 0.5;
  }

  if (this.points) {
    this.scene.remove(this.points);
    this.geometry.dispose();
  }

  this.geometry = new THREE.BufferGeometry();
  this.geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  this.geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  this.geometry.setAttribute("aAccent", new THREE.BufferAttribute(accent, 1));
  this.geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  this.geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(sampled.width / 2 + pad, sampled.height / 2 + pad, 0),
    Math.max(sampled.width, sampled.height) + pad * 2 + CONFIG.scatterRadius
  );

  this.points = new THREE.Points(this.geometry, this.material);
  this.points.frustumCulled = false;
  this.scene.add(this.points);

  var w = sampled.width + pad * 2;
  var h = sampled.height + pad * 2;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  this.camera.left = 0;
  this.camera.right = w;
  this.camera.top = 0;
  this.camera.bottom = h;
  this.camera.updateProjectionMatrix();

  this.renderer.setPixelRatio(dpr);
  this.renderer.setSize(w, h, false);
  this.canvas.style.width = w + "px";
  this.canvas.style.height = h + "px";
  this.canvas.style.left = -pad + "px";
  this.canvas.style.top = -pad + "px";

  this.uniforms.uPixelRatio.value = dpr;
  this.uniforms.uSize.value = sampled.spacing * CONFIG.pointScale;
  this.uniforms.uWidth.value = sampled.width;

  this.syncTheme();
  return true;
};

ParticleHeadline.prototype.onPointerMove = function (e) {
  var r = this.canvas.getBoundingClientRect();
  this.pointer.tx = e.clientX - r.left;
  this.pointer.ty = e.clientY - r.top;
};

ParticleHeadline.prototype.onPointerLeave = function () {
  this.pointer.tx = -99999;
  this.pointer.ty = -99999;
  this.pointer.x = -99999;
  this.pointer.y = -99999;
};

ParticleHeadline.prototype.frame = function (now) {
  this.raf = requestAnimationFrame(this.frame);
  if (!this.visible) return;

  if (!this.start) this.start = now;
  var t = (now - this.start) / 1000;

  this.uniforms.uTime.value = t;
  this.uniforms.uProgress.value = Math.min(t / CONFIG.introDuration, 1);

  var ease = CONFIG.pointerEase;
  this.pointer.x += (this.pointer.tx - this.pointer.x) * ease;
  this.pointer.y += (this.pointer.ty - this.pointer.y) * ease;
  this.uniforms.uPointer.value.set(this.pointer.x, this.pointer.y);

  this.renderer.render(this.scene, this.camera);
};

ParticleHeadline.prototype.scheduleRebuild = function () {
  var self = this;
  clearTimeout(this.rebuildTimer);
  this.rebuildTimer = setTimeout(function () {
    if (!self.build()) return;
    self.start = 0;               // replay the fly-in at the new size
  }, 220);
};

ParticleHeadline.prototype.run = function () {
  if (this.running) return;
  this.running = true;

  window.addEventListener("pointermove", this.onPointerMove, { passive: true });
  window.addEventListener("pointerdown", this.onPointerMove, { passive: true });
  document.addEventListener("pointerleave", this.onPointerLeave);
  window.addEventListener("blur", this.onPointerLeave);

  var self = this;

  if ("ResizeObserver" in window) {
    this.resizeObserver = new ResizeObserver(this.scheduleRebuild);
    this.resizeObserver.observe(this.el);
  } else {
    window.addEventListener("resize", this.scheduleRebuild);
  }

  // Only burn frames while the headline is actually on screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting;
    }, { rootMargin: "120px" }).observe(this.el);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(self.raf);
      self.raf = 0;
    } else if (!self.raf) {
      self.raf = requestAnimationFrame(self.frame);
    }
  });

  // The theme toggle swaps the CSS variables; re-read them when it does.
  new MutationObserver(function () { self.syncTheme(); }).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["data-theme"] }
  );

  this.raf = requestAnimationFrame(this.frame);
};

/* ==================================================================== boot */

function init() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var el = document.querySelector(CONFIG.selector);
  if (!el) return;

  var effect;
  try {
    effect = new ParticleHeadline(el);
    if (!effect.build()) throw new Error("no samples");
  } catch (err) {
    // Leave the plain headline exactly as it was.
    if (effect) {
      el.classList.remove("has-particles");
      if (effect.canvas.parentNode) effect.canvas.parentNode.removeChild(effect.canvas);
    }
    return;
  }

  effect.run();

  // Webfonts usually land after this runs; remeasure once they do, otherwise
  // the particles keep the shape of the fallback font.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { effect.scheduleRebuild(); });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
