/* worxbend — hero orb.

   A cosmic plasma blob that sits to the right of the headline: a sphere whose
   surface is pushed around by 3D noise, wrapped in a glowing wireframe shell
   and a drift of orbiting sparks. Background stays fully transparent, so the
   particle-network canvas keeps showing through it.

   How the morphing works — the part worth understanding:

     A plain sphere is subdivided into ~10k vertices. In the vertex shader each
     vertex is pushed along its own outward normal by an amount read from a 3D
     "simplex noise" field (a smooth, seamless random function of x/y/z/time).
     Because neighbouring vertices read nearby points of that field they get
     nearby values, so the surface bulges and dents smoothly instead of turning
     into static.

     The *random* part is that the noise field's settings — how tall the bumps
     are, how fine they are, how much the field is twisted before it is read —
     are not constants. Every few seconds the CPU rolls a new set of targets
     and eases the live values toward them (see MorphState below). One moment
     the orb is a slow lava blob, a while later it is a spiky sea urchin, then
     a rippling drop. Nothing is keyframed; it never repeats exactly.

   Everything is additive-blended and depth-write-free, which is what gives it
   the "plasma" glow rather than looking like a lit plastic ball.

   Purely decorative: the host element is aria-hidden, the whole thing is
   skipped under prefers-reduced-motion, and if WebGL is unavailable the page
   simply has an empty column there.                                          */

import * as THREE from "three";

/* ==================================================================== config */

var CONFIG = {
  hostId: "hero-orb",

  detail: 5,            // icosahedron subdivisions; 5 ≈ 10k vertices
  radius: 1.0,
  shellScale: 1.055,    // wireframe shell sits just outside the core
  sparkCount: 1400,

  /* how often the shape re-rolls, in seconds */
  morphMin: 3.5,
  morphMax: 7.0,
  morphEase: 0.9,       // higher = slower crossfade between shapes

  /* camera + motion */
  cameraZ: 3.7,
  spinSpeed: 0.16,      // radians/second of idle rotation
  pointerTilt: 0.34,    // radians of lean toward the cursor
  pointerEase: 0.05
};

/* ================================================================== shaders */

/* Ashima Arts / Stefan Gustavson 3D simplex noise (MIT). Standard drop-in;
   snoise(vec3) returns roughly -1..1 and is continuous in all directions. */
var NOISE = [
  "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
  "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
  "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
  "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
  "float snoise(vec3 v){",
  "  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
  "  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
  "  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;",
  "  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
  "  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;",
  "  i=mod289(i);",
  "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
  "  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;",
  "  vec4 j=p-49.0*floor(p*ns.z*ns.z);",
  "  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);",
  "  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);",
  "  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);",
  "  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));",
  "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
  "  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
  "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
  "  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;",
  "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;",
  "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
  "}"
].join("\n");

/* The displacement function is shared by the solid core and the wireframe
   shell so the two always agree on the shape. */
var DISPLACE = [
  "uniform float uTime;",
  "uniform float uAmp;",      // bump height
  "uniform float uFreq;",     // bump size (higher = finer)
  "uniform float uWarp;",     // how much the field is twisted before sampling
  "uniform float uRipple;",   // strength of the fast second octave
  "uniform float uFlow;",     // how fast the field evolves
  "uniform float uSpike;",    // 0 = rolling blob, 1 = sharp spikes

  "float shape(vec3 p) {",
  // Twisting the sample point by a slower noise field is what turns plain
  // bumps into swirling, taffy-like motion.
  "  vec3 w = p + uWarp * vec3(",
  "    snoise(p * 0.7 + vec3(uTime * uFlow, 0.0, 0.0)),",
  "    snoise(p * 0.7 + vec3(0.0, uTime * uFlow, 11.3)),",
  "    snoise(p * 0.7 + vec3(4.7, 0.0, uTime * uFlow))",
  "  );",
  "  float n = snoise(w * uFreq + vec3(0.0, 0.0, uTime * uFlow));",
  "  float n2 = snoise(w * uFreq * 2.7 + vec3(uTime * uFlow * 1.6, 3.1, 0.0));",
  // pow() on the ridged form pulls the field into spikes when uSpike is high
  "  float ridged = 1.0 - abs(n);",
  "  n = mix(n, pow(ridged, 3.0) * 1.6 - 0.5, uSpike);",
  "  return (n + n2 * uRipple) * uAmp;",
  "}"
].join("\n");

var CORE_VERT = [
  NOISE,
  DISPLACE,
  "varying vec3 vNormal;",
  "varying vec3 vView;",
  "varying float vDisp;",
  "void main() {",
  "  float d = shape(position);",
  "  vec3 p = position + normal * d;",
  // Rebuild a usable normal by sampling two nearby surface points. Without
  // this the lighting stays glued to the original sphere and the bumps look
  // painted on rather than sculpted.
  "  vec3 t1 = normalize(cross(normal, vec3(0.0, 1.0, 0.0) + vec3(0.001)));",
  "  vec3 t2 = normalize(cross(normal, t1));",
  "  float e = 0.035;",
  "  vec3 pa = position + t1 * e; pa += normal * shape(pa);",
  "  vec3 pb = position + t2 * e; pb += normal * shape(pb);",
  "  vec3 nrm = normalize(cross(pa - p, pb - p));",
  // The cross product can come out pointing inward depending on which way the
  // two tangents ended up; flip it back to face outward.
  "  vNormal = nrm * sign(dot(normal, nrm) + 0.0001);",
  "  vDisp = d;",
  "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
  "  vView = normalize(-mv.xyz);",
  "  gl_Position = projectionMatrix * mv;",
  "}"
].join("\n");

var CORE_FRAG = [
  // No `precision` line here on purpose: three.js prepends the same precision
  // qualifier to both shaders, and declaring a different one by hand makes
  // uniforms shared with the vertex shader fail to link.
  "uniform vec3 uColorDeep;",
  "uniform vec3 uColorMid;",
  "uniform vec3 uColorHot;",
  "uniform float uAmp;",
  "uniform float uOpacity;",
  "varying vec3 vNormal;",
  "varying vec3 vView;",
  "varying float vDisp;",
  "void main() {",
  // Fresnel: surfaces facing away from the viewer glow, which reads as a rim
  // of light around the silhouette — the single biggest "this is plasma" cue.
  "  float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 2.2);",
  "  float heat = clamp(vDisp / max(uAmp, 0.001) * 0.5 + 0.5, 0.0, 1.0);",
  "  vec3 col = mix(uColorDeep, uColorMid, heat);",
  "  col = mix(col, uColorHot, fres * 0.9);",
  // Additive blending stacks every fragment, so the body of the orb has to
  // stay very dim or the whole silhouette saturates to flat white. Almost all
  // of the visible brightness comes from the fresnel rim.
  "  float a = (0.035 + fres * 0.42) * uOpacity;",
  "  gl_FragColor = vec4(col * (0.10 + fres * 0.85), a);",
  "}"
].join("\n");

var SHELL_VERT = [
  NOISE,
  DISPLACE,
  "uniform float uShell;",
  "varying float vDisp;",
  "void main() {",
  "  float d = shape(position);",
  "  vec3 p = (position + normal * d) * uShell;",
  "  vDisp = d;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
  "}"
].join("\n");

var SHELL_FRAG = [
  // No `precision` line here on purpose: three.js prepends the same precision
  // qualifier to both shaders, and declaring a different one by hand makes
  // uniforms shared with the vertex shader fail to link.
  "uniform vec3 uColorHot;",
  "uniform vec3 uColorMid;",
  "uniform float uAmp;",
  "uniform float uOpacity;",
  "varying float vDisp;",
  "void main() {",
  "  float heat = clamp(vDisp / max(uAmp, 0.001) * 0.5 + 0.5, 0.0, 1.0);",
  "  gl_FragColor = vec4(mix(uColorMid, uColorHot, heat), 0.055 * uOpacity);",
  "}"
].join("\n");

var SPARK_VERT = [
  NOISE,
  "uniform float uTime;",
  "uniform float uPixelRatio;",
  "attribute float aSeed;",
  "attribute float aSize;",
  "varying float vAlpha;",
  "void main() {",
  // Each spark drifts on its own slow noise path around the orb and fades in
  // and out on its own cycle, so the halo never looks like a fixed shell.
  "  float t = uTime * 0.12 + aSeed * 30.0;",
  "  vec3 p = position;",
  "  p += 0.16 * vec3(snoise(p * 0.9 + t), snoise(p * 0.9 + t + 5.2), snoise(p * 0.9 + t + 9.7));",
  "  vAlpha = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 0.8 + aSeed * 6.2831), 2.0);",
  "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
  "  gl_Position = projectionMatrix * mv;",
  "  gl_PointSize = aSize * uPixelRatio * (3.0 / -mv.z);",
  "}"
].join("\n");

var SPARK_FRAG = [
  // No `precision` line here on purpose: three.js prepends the same precision
  // qualifier to both shaders, and declaring a different one by hand makes
  // uniforms shared with the vertex shader fail to link.
  "uniform vec3 uColorHot;",
  "uniform float uOpacity;",
  "varying float vAlpha;",
  "void main() {",
  "  float r = length(gl_PointCoord - 0.5);",
  "  float a = smoothstep(0.5, 0.0, r);",
  "  if (a <= 0.002) discard;",
  "  gl_FragColor = vec4(uColorHot, a * vAlpha * 0.4 * uOpacity);",
  "}"
].join("\n");

/* ============================================================ colour helper */

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

/* ============================================================== morph state */

/* Holds one live value and one target per shape parameter, plus the countdown
   to the next re-roll. Kept deliberately dumb: roll(), then step() eases the
   live values toward the targets a little every frame. */
function MorphState() {
  this.live = {};
  this.target = {};
  this.timer = 0;
  this.roll(true);
}

MorphState.RANGES = {
  uAmp:    [0.16, 0.46],
  uFreq:   [0.85, 2.60],
  uWarp:   [0.05, 0.85],
  uRipple: [0.10, 0.70],
  uFlow:   [0.06, 0.26],
  uSpike:  [0.00, 0.85]
};

MorphState.prototype.roll = function (immediate) {
  var self = this;
  Object.keys(MorphState.RANGES).forEach(function (key) {
    var r = MorphState.RANGES[key];
    var v = r[0] + Math.random() * (r[1] - r[0]);
    self.target[key] = v;
    if (immediate) self.live[key] = v;
  });
  // Very spiky and very tall at once turns the orb into a pincushion, so trade
  // one against the other.
  this.target.uAmp *= 1.0 - this.target.uSpike * 0.45;
  this.timer = CONFIG.morphMin + Math.random() * (CONFIG.morphMax - CONFIG.morphMin);
};

MorphState.prototype.step = function (dt, uniforms) {
  this.timer -= dt;
  if (this.timer <= 0) this.roll(false);

  // Frame-rate independent exponential ease: at 60fps this is ~0.9^(dt*60).
  var k = 1 - Math.pow(1 - CONFIG.morphEase, dt);
  var self = this;
  Object.keys(this.target).forEach(function (key) {
    self.live[key] += (self.target[key] - self.live[key]) * k;
    if (uniforms[key]) uniforms[key].value = self.live[key];
  });
};

/* ==================================================================== orb */

function HeroOrb(host) {
  this.host = host;
  this.morph = new MorphState();
  this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  this.visible = true;
  this.raf = 0;
  this.last = 0;
  this.time = 0;

  this.renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  this.renderer.setClearAlpha(0);
  this.canvas = this.renderer.domElement;
  this.canvas.setAttribute("aria-hidden", "true");
  host.appendChild(this.canvas);

  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  this.camera.position.z = CONFIG.cameraZ;

  this.group = new THREE.Group();
  this.scene.add(this.group);

  /* uniforms shared by every layer, so they morph in lockstep */
  this.uniforms = {
    uTime:       { value: 0 },
    uAmp:        { value: this.morph.live.uAmp },
    uFreq:       { value: this.morph.live.uFreq },
    uWarp:       { value: this.morph.live.uWarp },
    uRipple:     { value: this.morph.live.uRipple },
    uFlow:       { value: this.morph.live.uFlow },
    uSpike:      { value: this.morph.live.uSpike },
    uShell:      { value: CONFIG.shellScale },
    uPixelRatio: { value: 1 },
    uColorDeep:  { value: new THREE.Color("#2a1b4d") },
    uColorMid:   { value: new THREE.Color("#b49af0") },
    uColorHot:   { value: new THREE.Color("#8ff0bd") },
    uOpacity:    { value: 1 }
  };

  var geo = new THREE.IcosahedronGeometry(CONFIG.radius, CONFIG.detail);

  this.coreMat = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // FrontSide, not DoubleSide: with additive blending the back half of the
    // sphere would be added on top of the front half and double the brightness.
    side: THREE.FrontSide
  });
  this.group.add(new THREE.Mesh(geo, this.coreMat));

  this.shellMat = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: SHELL_VERT,
    fragmentShader: SHELL_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    wireframe: true
  });
  // A coarser mesh for the wireframe: at detail 5 the lines would merge into
  // a solid haze.
  this.group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(CONFIG.radius, 2), this.shellMat));

  this.group.add(this.makeSparks());

  this.onPointerMove = this.onPointerMove.bind(this);
  this.frame = this.frame.bind(this);
  this.resize = this.resize.bind(this);
}

// A shell of points scattered on a sphere a little wider than the orb.
HeroOrb.prototype.makeSparks = function () {
  var n = CONFIG.sparkCount;
  var pos = new Float32Array(n * 3);
  var seed = new Float32Array(n);
  var size = new Float32Array(n);

  for (var i = 0; i < n; i++) {
    // Uniform-on-a-sphere: picking z evenly and the angle evenly avoids the
    // clumping at the poles you get from naive lat/long randomisation.
    var z = Math.random() * 2 - 1;
    var a = Math.random() * Math.PI * 2;
    var r = Math.sqrt(1 - z * z);
    var d = CONFIG.radius * (1.15 + Math.pow(Math.random(), 2) * 0.85);
    pos[i * 3]     = Math.cos(a) * r * d;
    pos[i * 3 + 1] = Math.sin(a) * r * d;
    pos[i * 3 + 2] = z * d;
    seed[i] = Math.random();
    size[i] = 1.2 + Math.random() * 2.6;
  }

  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

  this.sparkMat = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });

  var pts = new THREE.Points(g, this.sparkMat);
  pts.frustumCulled = false;
  return pts;
};

HeroOrb.prototype.syncTheme = function () {
  var dark = document.documentElement.getAttribute("data-theme") !== "light";
  // Deep body in dim purple, ridges in the green accent, rim in bright lilac.
  // Because `heat` is driven by displacement, the green only ever shows up on
  // the parts of the surface that are currently bulging outward.
  this.uniforms.uColorDeep.value.copy(cssColor("--fx-c1", "#b49af0")).multiplyScalar(dark ? 0.30 : 0.5);
  this.uniforms.uColorMid.value.copy(cssColor("--fx-c4", "#8ff0bd"));
  this.uniforms.uColorHot.value.copy(cssColor("--fx-c5", "#cdbbf7"));
  // Additive blending only works over a dark ground: on the light theme every
  // overlapping layer climbs toward white and the orb turns into a pale smear.
  // There it blends normally instead, with the alpha scaled up to compensate.
  var blend = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  [this.coreMat, this.shellMat, this.sparkMat].forEach(function (m) {
    if (!m) return;
    m.blending = blend;
    m.needsUpdate = true;
  });
  // With normal blending the draw order suddenly matters: without a depth
  // buffer, far folds of the surface paint over near ones and the orb looks
  // torn. Additive blending is order-independent, so the dark theme can keep
  // depth writes off and stay glowy.
  this.coreMat.depthWrite = !dark;
  this.uniforms.uOpacity.value = dark ? 1 : 1.7;
};

HeroOrb.prototype.resize = function () {
  var r = this.host.getBoundingClientRect();
  var w = Math.max(1, Math.round(r.width));
  var h = Math.max(1, Math.round(r.height));
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  this.camera.aspect = w / h;
  this.camera.updateProjectionMatrix();
  this.renderer.setPixelRatio(dpr);
  this.renderer.setSize(w, h, false);
  this.canvas.style.width = w + "px";
  this.canvas.style.height = h + "px";
  this.uniforms.uPixelRatio.value = dpr;
};

HeroOrb.prototype.onPointerMove = function (e) {
  // -1..1 across the viewport, so the orb leans toward the cursor wherever it
  // is on the page rather than only when it is over the orb itself.
  this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
};

HeroOrb.prototype.frame = function (now) {
  this.raf = requestAnimationFrame(this.frame);
  if (!this.visible) { this.last = now; return; }

  var dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0.016;
  this.last = now;
  this.time += dt;

  this.uniforms.uTime.value = this.time;
  this.morph.step(dt, this.uniforms);

  this.pointer.x += (this.pointer.tx - this.pointer.x) * CONFIG.pointerEase;
  this.pointer.y += (this.pointer.ty - this.pointer.y) * CONFIG.pointerEase;

  this.group.rotation.y = this.time * CONFIG.spinSpeed + this.pointer.x * CONFIG.pointerTilt;
  this.group.rotation.x = Math.sin(this.time * 0.11) * 0.18 - this.pointer.y * CONFIG.pointerTilt * 0.6;

  this.renderer.render(this.scene, this.camera);
};

HeroOrb.prototype.run = function () {
  var self = this;
  this.resize();
  this.syncTheme();

  window.addEventListener("pointermove", this.onPointerMove, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(this.resize).observe(this.host);
  } else {
    window.addEventListener("resize", this.resize);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting;
    }, { rootMargin: "160px" }).observe(this.host);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(self.raf);
      self.raf = 0;
      self.last = 0;
    } else if (!self.raf) {
      self.raf = requestAnimationFrame(self.frame);
    }
  });

  new MutationObserver(function () { self.syncTheme(); }).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["data-theme"] }
  );

  this.raf = requestAnimationFrame(this.frame);
};

/* ==================================================================== boot */

function init() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var host = document.getElementById(CONFIG.hostId);
  if (!host) return;

  // The column is display:none below the two-column breakpoint; building a
  // WebGL context for a zero-sized element is pure waste. Watch for the window
  // growing past that breakpoint so a resized narrow window still gets an orb.
  if (!host.getBoundingClientRect().width) {
    var retry = function () {
      if (!host.getBoundingClientRect().width) return;
      window.removeEventListener("resize", retry);
      init();
    };
    window.addEventListener("resize", retry);
    return;
  }

  try {
    new HeroOrb(host).run();
    host.classList.add("is-live");
  } catch (err) {
    host.innerHTML = "";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
