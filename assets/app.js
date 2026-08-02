/* worxbend — streaming tools map
   Vanilla port of the Claude Design component logic. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Arms the reveal animation only when scripting is available.
  document.documentElement.classList.add("has-js");

  /* ------------------------------------------------------------------ data */

  var DATA = {
    scenedeck: {
      label: "scenedeck", sub: "desktop GUI remote", chips: ["GTK4"],
      name: "SceneDeck", kind: "desktop remote · Rust · GTK4",
      desc: "A native GTK4 control surface for the remote OBS. Role-filtered scene switching, a mixer that reaches into nested scenes, live telemetry and Doctor diagnostics — a full control panel on your workstation, always in reach, never stealing focus from what you're capturing.",
      detailChips: ["Rust", "GTK4 + libadwaita", "Linux", "snap install scenedeck", "MIT"],
      connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
      // Published to the Snap Store under strict confinement; no curl installer.
      // Release assets are version-stamped, so the binary option resolves the
      // latest tag first rather than using a latest/download URL.
      installs: [
        { tag: "SNAP STORE", cmd: "sudo snap install scenedeck" },
        {
          tag: "GITHUB RELEASE — BINARY",
          cmd: "VER=$(curl -fsSL https://api.github.com/repos/worxbend/scenedeck/releases/latest | grep -m1 '\"tag_name\"' | cut -d'\"' -f4)\n" +
               "curl -fsSL -o scenedeck \"https://github.com/worxbend/scenedeck/releases/download/$VER/scenedeck-${VER#v}-linux-amd64\"\n" +
               "install -Dm755 scenedeck ~/.local/bin/scenedeck",
          alt: { text: "all builds — AppImage, flatpak, arm64 ↗", href: "https://github.com/worxbend/scenedeck/releases/latest" }
        }
      ],
      site: "https://worxbend.github.io/scenedeck/", repo: "https://github.com/worxbend/scenedeck"
    },
    "obsctl-rs": {
      label: "obsctl-rs", sub: "daemon · TUI · CLI", chips: ["Rust", "Ratatui"],
      name: "obsctl-rs", kind: "daemon + TUI + CLI · Rust",
      desc: "An OBS command center in one Rust binary. A local daemon owns the WebSocket link to the remote OBS; a keyboard-driven TUI shows live state; a proxy CLI answers in milliseconds — bind scene switches and mute toggles to any hotkey or script on your workstation.",
      detailChips: ["Rust", "Ratatui TUI", "single binary", "20 CLI commands", "JSON envelope", "29 themes", "MIT"],
      connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
      installs: [{
        tag: "CURL | SH",
        cmd: "curl -fsSL https://github.com/worxbend/obsctl-rs/releases/latest/download/install.sh | sh",
        inspect: "https://github.com/worxbend/obsctl-rs/releases/latest/download/install.sh"
      }],
      site: "https://worxbend.github.io/obsctl-rs/", repo: "https://github.com/worxbend/obsctl-rs"
    },
    obsctl: {
      label: "obsctl", sub: "daemon · TUI · CLI", chips: ["Crystal"],
      name: "obsctl", kind: "daemon + TUI + CLI · Crystal",
      desc: "The same control-room idea in Crystal. A resilient daemon that survives OBS restarts with bounded reconnect backoff, a CLI that prints one JSON envelope per call with exit codes that mean something in shell scripts, and a TUI built on its own CryTUI library.",
      detailChips: ["Crystal", "static musl builds", "amd64 + arm64", "EN + UK locales", "MIT"],
      connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
      // Installer is served from the project's own Pages site (the form its
      // README documents) and is also attached to every release.
      installs: [{
        tag: "CURL | SH",
        cmd: "curl -fsSL https://worxbend.github.io/obsctl/install.sh | sh",
        inspect: "https://worxbend.github.io/obsctl/install.sh",
        alt: { text: "prebuilt static binaries ↗", href: "https://github.com/worxbend/obsctl/releases" }
      }],
      site: "https://worxbend.github.io/obsctl/", repo: "https://github.com/worxbend/obsctl"
    },
    "obs-stats": {
      label: "obs-stats", sub: "terminal health dashboard", chips: ["Rust", "Ratatui"],
      name: "obs-stats", kind: "terminal dashboard · Rust · Ratatui",
      desc: "A btop-style dashboard watching the remote OBS from a terminal pane. It keeps GPU, encoder and network frame loss apart — each has a different fix — and raises a banner plus desktop notification the moment frames start dropping, so you find out before your viewers do.",
      detailChips: ["Rust", "6 views", "desktop notifications", "24 themes", "Linux / macOS / Windows", "MIT"],
      connects: "workstation ──monitor──▶ remote OBS (read-only telemetry)",
      installs: [{
        tag: "CURL | SH",
        cmd: "curl -fsSL https://raw.githubusercontent.com/worxbend/obs-stats/main/scripts/install.sh | sh",
        inspect: "https://raw.githubusercontent.com/worxbend/obs-stats/main/scripts/install.sh"
      }],
      site: "https://worxbend.github.io/obs-stats/", repo: "https://github.com/worxbend/obs-stats"
    },
    twi: {
      label: "twi", sub: "terminal chat client", chips: ["IRC"],
      name: "twi", kind: "Twitch chat client · Crystal",
      desc: "Read and send Twitch chat from a terminal — no browser tab, no Electron, no chat window fighting for focus. It sits in a pane next to obs-stats, talking straight to Twitch IRC.",
      detailChips: ["Crystal", "Twitch IRC", "terminal pane", "MIT"],
      connects: "workstation ──chat / IRC──▶ Twitch",
      // The README also documents a snap, but snapcraft.io/twi is not published
      // yet — curl-pipe is the only install path that currently works.
      installs: [{
        tag: "CURL | SH",
        cmd: "curl -fsSL https://github.com/worxbend/twi/releases/latest/download/install.sh | sh",
        inspect: "https://github.com/worxbend/twi/releases/latest/download/install.sh"
      }],
      site: "https://worxbend.github.io/twi/", repo: "https://github.com/worxbend/twi"
    },
    obs: {
      label: "OBS Studio", sub: "capturing · encoding · left alone", chips: ["ENCODING", "OBS 28+"], live: true,
      name: "OBS Studio (remote)", kind: "the streaming rig",
      desc: "OBS runs on a dedicated rig that captures your workstation's screen and audio, encodes, and sends the stream out. Encoding load stays off the computer you work on — and you never touch the rig: every knob is turned remotely over obs-websocket, commands out, scenes, audio and telemetry back.",
      detailChips: ["obs-websocket 5.x", "127.0.0.1:4455 by default", "OBS 28+", "busy, and left alone"],
      connects: "captures ◀── workstation · streams ──▶ Twitch / RTMP",
      site: null, repo: null
    },
    twitch: {
      label: "Twitch", sub: "stream + IRC chat", chips: ["RTMP", "IRC"],
      name: "Twitch", kind: "the destination",
      desc: "The rig's OBS pushes the encoded stream to Twitch, while twi keeps you in the conversation over IRC. Everything you see and type stays on the workstation.",
      detailChips: ["RTMP ingest", "IRC chat"],
      connects: "remote OBS ──streams──▶ Twitch ◀──chat── twi",
      site: null, repo: null
    }
  };

  var GEO = [
    { id: "scenedeck", x: 56,  y: 104, w: 236, h: 76 },
    { id: "obsctl-rs", x: 56,  y: 190, w: 236, h: 76 },
    { id: "obsctl",    x: 56,  y: 276, w: 236, h: 76 },
    { id: "obs-stats", x: 56,  y: 362, w: 236, h: 76 },
    { id: "twi",       x: 56,  y: 452, w: 236, h: 76 },
    { id: "obs",       x: 583, y: 158, w: 204, h: 112 },
    { id: "twitch",    x: 862, y: 182, w: 140, h: 76 }
  ];

  var P = "#b49af0", G = "#5fce93", GH = "#8ff0bd";

  /* smooth cubic with horizontal tangents between exact node anchor points */
  function C(x1, y1, x2, y2) {
    var dx = (x2 - x1) * 0.45;
    return "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
  }

  var EDGES = [
    { d: C(292, 142, 583, 176), stroke: "#56534d", dash: "6 6", speed: "1.1s",  marker: "url(#arr)",    on: ["scenedeck"], hlColor: P, hlMarker: "url(#arrHl)" },
    { d: C(292, 228, 583, 198), stroke: "#56534d", dash: "6 6", speed: "1.1s",  marker: "url(#arr)",    on: ["obsctl-rs"], hlColor: P, hlMarker: "url(#arrHl)" },
    { d: C(292, 314, 583, 220), stroke: "#56534d", dash: "6 6", speed: "1.1s",  marker: "url(#arr)",    on: ["obsctl"],    hlColor: P, hlMarker: "url(#arrHl)" },
    { d: C(292, 400, 583, 242), stroke: "#56534d", dash: "3 5", speed: "1.1s",  marker: "url(#arr)",    on: ["obs-stats"], hlColor: P, hlMarker: "url(#arrHl)" },
    { d: C(583, 256, 326, 428), stroke: "#3d6b52", dash: "6 6", speed: "1.3s", reverse: true, marker: "url(#arrCap)", on: ["obs", "scenedeck", "obsctl-rs", "obsctl", "obs-stats"], hlColor: G, hlMarker: "url(#arrCap)" },
    { d: C(787, 214, 858, 212), stroke: "#56534d", dash: "7 5", speed: "1.1s",  marker: "url(#arr)",    on: ["obs", "twitch"], hlColor: P, hlMarker: "url(#arrHl)" },
    { d: "M 292 490 C 620 496, 932 420, 932 268", stroke: "#56534d", dash: "6 6", speed: "2s", marker: "url(#arr)", on: ["twi", "twitch"], hlColor: P, hlMarker: "url(#arrHl)" },
    { d: "M 326 90 C 420 54, 470 58, 556 102",    stroke: "#3d6b52", dash: "3 4", speed: "2s", marker: "url(#arrCap)", on: ["obs"], hlColor: G, hlMarker: "url(#arrCap)" }
  ];

  var LABELS = {
    ws:   { on: ["scenedeck", "obsctl-rs", "obsctl", "obs"], base: "#9a968e", hl: P },
    cmd:  { on: ["scenedeck", "obsctl-rs", "obsctl"],        base: "#6f6b63", hl: P },
    mon:  { on: ["obs-stats"],                                base: "#6f6b63", hl: P },
    tel:  { on: ["obs", "scenedeck", "obsctl-rs", "obsctl", "obs-stats"], base: "#5fce93", hl: GH },
    rtmp: { on: ["obs", "twitch"],                            base: "#9a968e", hl: P },
    chat: { on: ["twi", "twitch"],                            base: "#9a968e", hl: P },
    cap:  { on: ["obs"],                                      base: "#5fce93", hl: GH }
  };

  var SVG_NS = "http://www.w3.org/2000/svg";
  var sel = "obs";

  /* ------------------------------------------------------------------- map */

  var nodeHost   = document.getElementById("map-nodes");
  var baseLayer  = document.getElementById("edges-base");
  var hlLayer    = document.getElementById("edges-hl");

  function buildNodes() {
    GEO.forEach(function (g) {
      var nd = DATA[g.id];
      var hub = g.id === "obs" || g.id === "twitch";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-node" + (hub ? " hub" : "");
      btn.dataset.id = g.id;
      btn.style.left = g.x + "px";
      btn.style.top = g.y + "px";
      btn.style.width = g.w + "px";
      btn.style.height = g.h + "px";
      btn.setAttribute("aria-pressed", "false");

      var head = document.createElement("div");
      var title = document.createElement("div");
      title.className = "node-title";
      title.textContent = nd.label;
      var sub = document.createElement("div");
      sub.className = "node-sub";
      sub.textContent = nd.sub;
      head.appendChild(title);
      head.appendChild(sub);
      btn.appendChild(head);

      var chips = document.createElement("div");
      chips.className = "node-chips";
      (nd.chips || []).forEach(function (c) {
        var s = document.createElement("span");
        s.className = "node-chip";
        s.textContent = c;
        chips.appendChild(s);
      });
      btn.appendChild(chips);

      if (nd.live) {
        var live = document.createElement("div");
        live.className = "node-live";
        var d = document.createElement("span");
        d.className = "dot dot-red pulse";
        var t = document.createElement("span");
        t.textContent = "TO TWITCH / RTMP";
        live.appendChild(d);
        live.appendChild(t);
        btn.appendChild(live);
      }

      btn.addEventListener("click", function () { select(g.id); });
      nodeHost.appendChild(btn);
    });
  }

  function buildBaseEdges() {
    EDGES.forEach(function (e) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", e.d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", e.stroke);
      p.setAttribute("stroke-width", "1.4");
      p.setAttribute("stroke-dasharray", e.dash);
      p.setAttribute("marker-end", e.marker);
      if (!reduceMotion) {
        p.style.animation = "dashflow " + e.speed + " linear infinite" + (e.reverse ? " reverse" : "");
      }
      baseLayer.appendChild(p);
    });
  }

  function drawHighlights() {
    hlLayer.textContent = "";
    EDGES.filter(function (e) { return e.on.indexOf(sel) !== -1; }).forEach(function (e) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", e.d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", e.hlColor);
      p.setAttribute("stroke-width", "2.2");
      p.setAttribute("marker-end", e.hlMarker);
      hlLayer.appendChild(p);
    });
  }

  function paintLabels() {
    Object.keys(LABELS).forEach(function (key) {
      var cfg = LABELS[key];
      var el = document.querySelector('.map-lab[data-lab="' + key + '"]');
      if (el) el.style.color = cfg.on.indexOf(sel) !== -1 ? cfg.hl : cfg.base;
    });
  }

  function paintNodes() {
    Array.prototype.forEach.call(nodeHost.children, function (btn) {
      var on = btn.dataset.id === sel;
      btn.classList.toggle("is-sel", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /* ---------------------------------------------------------- detail panel */

  var elName     = document.getElementById("sel-name");
  var elKind     = document.getElementById("sel-kind");
  var elDesc     = document.getElementById("sel-desc");
  var elChips    = document.getElementById("sel-chips");
  var elConnects = document.getElementById("sel-connects");
  var elLinks    = document.getElementById("sel-links");
  var elSite     = document.getElementById("sel-site");
  var elRepo     = document.getElementById("sel-repo");

  var elInstalls = document.getElementById("sel-installs");

  // One install option -> one labelled command block. Shared by the detail
  // panel and the tool cards so both stay in step.
  function installBlock(opt) {
    var wrap = document.createElement("div");
    wrap.className = "install";

    var head = document.createElement("div");
    head.className = "install-head";

    var tag = document.createElement("span");
    tag.className = "install-tag";
    tag.textContent = opt.tag;
    head.appendChild(tag);

    if (opt.inspect) {
      var insp = document.createElement("a");
      insp.className = "install-inspect";
      insp.href = opt.inspect;
      insp.rel = "noopener";
      insp.textContent = "read it first ↗";
      head.appendChild(insp);
    }
    if (opt.alt) {
      var alt = document.createElement("a");
      alt.className = "install-alt";
      alt.href = opt.alt.href;
      alt.rel = "noopener";
      alt.textContent = opt.alt.text;
      head.appendChild(alt);
    }
    wrap.appendChild(head);

    var box = document.createElement("div");
    box.className = "cmd-box";
    var code = document.createElement("code");
    code.textContent = opt.cmd;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    box.appendChild(code);
    box.appendChild(btn);
    wrap.appendChild(box);

    return wrap;
  }

  function paintInstall(d) {
    elInstalls.textContent = "";
    var opts = d.installs || [];
    elInstalls.hidden = opts.length === 0;
    opts.forEach(function (opt) { elInstalls.appendChild(installBlock(opt)); });
  }

  /* ------------------------------------------------- copy (shared, delegated) */

  var copyTimers = new WeakMap();

  function resetCopyLabel(btn) {
    var t = copyTimers.get(btn);
    if (t) { clearTimeout(t); copyTimers.delete(btn); }
    btn.textContent = "Copy";
    btn.classList.remove("ok");
  }

  function flashCopied(btn, ok) {
    btn.textContent = ok ? "Copied ✓" : "Press ⌘/Ctrl+C";
    btn.classList.toggle("ok", ok);
    var prev = copyTimers.get(btn);
    if (prev) clearTimeout(prev);
    copyTimers.set(btn, setTimeout(function () { resetCopyLabel(btn); }, 1800));
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  // One delegated listener covers the detail panel, the tool cards and the
  // quick-start steps — including cards rendered after this runs.
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".copy-btn");
    if (!btn) return;
    var box = btn.closest(".cmd-box");
    var code = box && box.querySelector("code");
    if (!code) return;

    var text = code.textContent;
    // navigator.clipboard needs a secure context; fall back when absent.
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { flashCopied(btn, true); },
        function () { flashCopied(btn, legacyCopy(text)); }
      );
    } else {
      flashCopied(btn, legacyCopy(text));
    }
  });

  function paintDetail() {
    var d = DATA[sel];
    elName.textContent = d.name;
    elKind.textContent = d.kind;
    elDesc.textContent = d.desc;
    elConnects.textContent = d.connects;

    elChips.textContent = "";
    (d.detailChips || []).forEach(function (c) {
      var s = document.createElement("span");
      s.className = "detail-chip";
      s.textContent = c;
      elChips.appendChild(s);
    });

    if (d.site) {
      elSite.href = d.site;
      elRepo.href = d.repo;
      elLinks.hidden = false;
    } else {
      elLinks.hidden = true;
    }

    paintInstall(d);
  }

  function select(id) {
    sel = id;
    paintNodes();
    drawHighlights();
    paintLabels();
    paintDetail();
  }

  /* -------------------------------------------------------- idea carousel */

  var IDEA_TITLES = ["SceneDeck", "obsctl-rs — TUI", "obsctl — CLI", "obs-stats", "twi"];
  var IDEA_CAPS = [
    ["CODING, PRESENTING, PLAYING.", "NOTHING IS BEING ENCODED HERE."],
    ["HOTKEYS AND A LIVE TUI.",      "ONE DAEMON OWNS THE SOCKET."],
    ["SHELL SCRIPTS WELCOME.",       "JSON IN, EXIT CODES OUT."],
    ["FRAME DROPS, NAMED AND BLAMED.", "BEFORE VIEWERS NOTICE."],
    ["CHAT IN A TERMINAL PANE.",     "NO BROWSER TAB."]
  ];

  var ideaIdx = 0, ideaPaused = false, ideaTimer = null;
  var ideaWin     = document.getElementById("idea-win");
  var ideaTitle   = document.getElementById("idea-title");
  var ideaCaption = document.getElementById("idea-caption");
  var ideaDots    = document.getElementById("idea-dots");
  var ideaPanels  = document.querySelectorAll(".idea-panel");

  function paintIdea() {
    Array.prototype.forEach.call(ideaPanels, function (p) {
      p.classList.toggle("is-on", Number(p.dataset.idea) === ideaIdx);
    });
    ideaTitle.textContent = IDEA_TITLES[ideaIdx];
    ideaCaption.innerHTML = "";
    ideaCaption.appendChild(document.createTextNode(IDEA_CAPS[ideaIdx][0]));
    ideaCaption.appendChild(document.createElement("br"));
    ideaCaption.appendChild(document.createTextNode(IDEA_CAPS[ideaIdx][1]));

    Array.prototype.forEach.call(ideaDots.children, function (b, k) {
      b.setAttribute("aria-selected", k === ideaIdx ? "true" : "false");
    });
  }

  function buildIdeaDots() {
    IDEA_TITLES.forEach(function (t, k) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", t);
      b.addEventListener("click", function () {
        ideaIdx = k;
        paintIdea();
      });
      ideaDots.appendChild(b);
    });
  }

  function startIdeaTimer() {
    if (reduceMotion) return;
    ideaTimer = setInterval(function () {
      if (ideaPaused) return;
      ideaIdx = (ideaIdx + 1) % IDEA_TITLES.length;
      paintIdea();
    }, 3200);
  }

  ideaWin.addEventListener("mouseenter", function () { ideaPaused = true; });
  ideaWin.addEventListener("mouseleave", function () { ideaPaused = false; });
  document.addEventListener("visibilitychange", function () {
    ideaPaused = document.hidden;
  });

  /* ------------------------------------------------- background icosphere */

  function startBackground() {
    var canvas = document.getElementById("bg-canvas");
    if (!canvas) return;

    // Canvas can be blocked or throw outright (Firefox resistFingerprinting,
    // privacy extensions). It is decoration — never let it break the page.
    var ctx = null;
    try { ctx = canvas.getContext("2d"); } catch (e) { ctx = null; }
    if (!ctx) { canvas.style.display = "none"; return; }

    var t = (1 + Math.sqrt(5)) / 2;
    var verts = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ].map(function (v) {
      var l = Math.hypot(v[0], v[1], v[2]);
      return v.map(function (c) { return c / l; });
    });

    var faces = [
      [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
      [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
    ];

    var midCache = {};
    function mid(a, b) {
      var k = a < b ? a + "_" + b : b + "_" + a;
      if (midCache[k] !== undefined) return midCache[k];
      var m = [
        (verts[a][0] + verts[b][0]) / 2,
        (verts[a][1] + verts[b][1]) / 2,
        (verts[a][2] + verts[b][2]) / 2
      ];
      var l = Math.hypot(m[0], m[1], m[2]);
      verts.push(m.map(function (c) { return c / l; }));
      midCache[k] = verts.length - 1;
      return midCache[k];
    }

    var f2 = [];
    faces.forEach(function (f) {
      var a = f[0], b = f[1], c = f[2];
      var ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      f2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    });
    faces = f2;

    var edgeSet = {};
    faces.forEach(function (f) {
      [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (pr) {
        var p = pr[0], q = pr[1];
        edgeSet[p < q ? p + "_" + q : q + "_" + p] = true;
      });
    });
    var edges = Object.keys(edgeSet).map(function (k) {
      return k.split("_").map(Number);
    });

    var raf, rot = 0, last = performance.now();

    function draw(now) {
      try { paint(now); } catch (e) { cancelAnimationFrame(raf); canvas.style.display = "none"; return; }
      raf = requestAnimationFrame(draw);
    }

    function paint(now) {
      var dt = Math.min(50, now - last);
      last = now;
      if (!reduceMotion) rot += dt * 0.00006;

      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = window.innerWidth, h = window.innerHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var cx = w * 0.8, cy = h * 0.34, R = Math.min(w, h) * 0.42;
      var tilt = 0.42, cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      var cosR = Math.cos(rot), sinR = Math.sin(rot);

      var proj = verts.map(function (v) {
        var x = v[0], y = v[1], z = v[2];
        var x1 = x * cosR + z * sinR, z1 = -x * sinR + z * cosR;
        var y2 = y * cosT - z1 * sinT, z2 = y * sinT + z1 * cosT;
        var s = 2.6 / (2.6 + z2 * 0.9);
        return [cx + x1 * R * s, cy + y2 * R * s, z2];
      });

      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var pa = proj[e[0]], pb = proj[e[1]];
        var depth = (pa[2] + pb[2]) / 2;                       // -1 front .. 1 back
        var alpha = 0.02 + Math.max(0, 0.55 - depth * 0.5) * 0.13;
        ctx.strokeStyle = "rgba(180, 154, 240, " + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      });

      proj.forEach(function (p) {
        if (p[2] > 0.2) return;
        var a = 0.06 + (0.2 - p[2]) * 0.1;
        ctx.fillStyle = "rgba(95, 206, 147, " + Math.min(0.3, a).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.4, 0, 6.284);
        ctx.fill();
      });
    }

    raf = requestAnimationFrame(draw);
    window.addEventListener("pagehide", function () { cancelAnimationFrame(raf); });
  }

  /* ------------------------------------------------------------ tool cards */

  // Card-only presentation data. Kept beside DATA rather than inside it so the
  // design-sourced copy stays untouched.
  var CARD_ORDER = ["scenedeck", "obsctl-rs", "obsctl", "obs-stats", "twi"];
  var CARD_META = {
    scenedeck: {
      accent: "#b49af0",
      short: "A native GTK4 control panel for the remote OBS — scenes, mixer, telemetry and diagnostics in one window.",
      feats: ["Role-filtered scene switching", "Mixer reaches into nested scenes", "Doctor diagnostics built in"]
    },
    "obsctl-rs": {
      accent: "#8ab0f0",
      short: "One Rust binary that is a daemon, a TUI and a proxy CLI answering in milliseconds.",
      feats: ["Daemon owns the WebSocket link", "Ratatui TUI + 20 CLI commands", "29 themes, systemd --user service"]
    },
    obsctl: {
      accent: "#5fce93",
      short: "The same control-room idea in Crystal, with a daemon that shrugs off OBS restarts.",
      feats: ["Bounded reconnect backoff", "One JSON envelope per call", "Static musl builds, amd64 + arm64"]
    },
    "obs-stats": {
      accent: "#e0b05c",
      short: "A btop-style health dashboard that tells you which frames are dropping, and why.",
      feats: ["GPU, encoder and network kept apart", "Desktop notification on first drop", "6 views, 24 themes"]
    },
    twi: {
      accent: "#d98a8a",
      short: "Twitch chat in a terminal pane — no browser tab, no Electron, no window stealing focus.",
      feats: ["Reads and sends over Twitch IRC", "Sits beside obs-stats in a split", "Stays on your workstation"]
    }
  };

  function buildToolCards() {
    var host = document.getElementById("tool-grid");
    if (!host) return;

    CARD_ORDER.forEach(function (id) {
      var d = DATA[id], meta = CARD_META[id];
      if (!d || !meta) return;

      var card = document.createElement("article");
      card.className = "tool-card reveal";
      card.style.setProperty("--accent", meta.accent);

      var head = document.createElement("div");
      head.className = "tool-card-head";
      var h3 = document.createElement("h3");
      h3.textContent = d.label;
      var kind = document.createElement("span");
      kind.className = "tool-card-kind";
      kind.textContent = d.kind;
      head.appendChild(h3);
      head.appendChild(kind);
      card.appendChild(head);

      var p = document.createElement("p");
      p.className = "tool-card-desc";
      p.textContent = meta.short;
      card.appendChild(p);

      var ul = document.createElement("ul");
      ul.className = "tool-feats";
      meta.feats.forEach(function (f) {
        var li = document.createElement("li");
        li.textContent = f;
        ul.appendChild(li);
      });
      card.appendChild(ul);

      (d.installs || []).forEach(function (opt) {
        card.appendChild(installBlock(opt));
      });

      var links = document.createElement("div");
      links.className = "tool-links";
      if (d.site) {
        var a1 = document.createElement("a");
        a1.href = d.site; a1.rel = "noopener"; a1.textContent = "Website ↗";
        links.appendChild(a1);
      }
      if (d.repo) {
        var a2 = document.createElement("a");
        a2.href = d.repo; a2.rel = "noopener"; a2.textContent = "GitHub ↗";
        links.appendChild(a2);
      }
      var focus = document.createElement("button");
      focus.type = "button";
      focus.className = "tool-focus";
      focus.textContent = "Show on map ↓";
      focus.addEventListener("click", function () {
        select(id);
        var map = document.getElementById("map");
        if (map) map.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
      links.appendChild(focus);
      card.appendChild(links);

      host.appendChild(card);
    });
  }

  /* --------------------------------------------------------- terminal demo */

  var DEMO = [
    { cmd: "obsctl scene 'BRB'",  out: ['{ "ok": true, "scene": "BRB" }'] },
    { cmd: "obsctl mute 'Mic'",   out: ['{ "ok": true, "muted": true }'] },
    { cmd: "obsctl obs-status",   out: ['{ "ok": true, "live": true, "fps": 60.0 }'] },
    { cmd: "obsctl vol 'Mic' 70", out: ['{ "ok": true, "volume": 70 }', "exit 0"] }
  ];

  function startDemo() {
    var body = document.getElementById("demo-body");
    var win = document.getElementById("demo-win");
    var hint = document.getElementById("demo-hint");
    if (!body) return;

    function line(cls) {
      var el = document.createElement("div");
      el.className = "demo-line" + (cls ? " " + cls : "");
      body.appendChild(el);
      return el;
    }

    // Reduced motion: render the finished transcript, no typing.
    if (reduceMotion) {
      DEMO.forEach(function (step) {
        line().innerHTML = '<span class="c-green">$</span> ' + escapeHtml(step.cmd);
        step.out.forEach(function (o) { line("c-green").textContent = o; });
      });
      if (hint) hint.textContent = "transcript";
      return;
    }

    var paused = false;
    if (win) {
      win.addEventListener("mouseenter", function () { paused = true; if (hint) hint.textContent = "paused"; });
      win.addEventListener("mouseleave", function () { paused = false; if (hint) hint.textContent = "running"; });
    }

    var step = 0, ch = 0, cur = null, caret = null, pendingWipe = false;

    function tick(delay) { setTimeout(run, delay); }

    function run() {
      // Hold position while hovered or while the tab is in the background.
      if (paused) return tick(220);
      if (document.hidden) return tick(400);

      // Clear only once the finished transcript has had its moment on screen.
      if (pendingWipe) { body.textContent = ""; pendingWipe = false; }

      var s = DEMO[step];

      if (!cur) {
        cur = line();
        var prompt = document.createElement("span");
        prompt.className = "c-green";
        prompt.textContent = "$";
        var typed = document.createElement("span");
        typed.className = "typed";
        caret = document.createElement("span");
        caret.className = "demo-caret";
        cur.appendChild(prompt);
        cur.appendChild(document.createTextNode(" "));
        cur.appendChild(typed);
        cur.appendChild(caret);
        ch = 0;
      }

      if (ch < s.cmd.length) {
        ch++;
        cur.querySelector(".typed").textContent = s.cmd.slice(0, ch);
        return tick(38 + (ch % 3) * 12);   // slight jitter reads as human
      }

      if (caret) { caret.remove(); caret = null; }
      s.out.forEach(function (o) { line("c-green").textContent = o; });
      cur = null;
      step++;

      if (step < DEMO.length) return tick(700);

      // Loop: pause on the finished transcript, then wipe and start over so the
      // pane never grows without bound.
      step = 0;
      pendingWipe = true;
      return tick(2800);
    }

    tick(600);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* -------------------------------------------------------- scroll effects */

  function revealAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) {
      el.classList.add("is-in");
    });
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      revealAll();
      return;
    }
    var io;
    try {
      io = makeRevealObserver();
    } catch (e) {
      // Anything goes wrong setting up the effect: show the content.
      revealAll();
      return;
    }

    Array.prototype.forEach.call(items, function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 55 + "ms";
      io.observe(el);
    });

    // Safety net: if nothing has been revealed shortly after load, the effect is
    // not working for this browser — show everything rather than a blank page.
    setTimeout(function () {
      if (!document.querySelector(".reveal.is-in")) revealAll();
    }, 2500);
  }

  function makeRevealObserver() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    return io;
  }

  function initCounters() {
    var nums = document.querySelectorAll(".stat-num[data-count]");
    if (!nums.length) return;

    function render(el, v) {
      var prefix = el.querySelector(".stat-prefix");
      el.textContent = String(v);
      if (prefix) el.insertBefore(prefix, el.firstChild);
    }

    function animate(el) {
      var target = Number(el.dataset.count) || 0;
      if (reduceMotion || target === 0) return render(el, target);

      var dur = 900, t0 = performance.now();
      (function frame(now) {
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        render(el, Math.round(target * eased));
        if (p < 1) requestAnimationFrame(frame);
      })(t0);
    }

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nums, function (el) { animate(el); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        animate(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(nums, function (el) { io.observe(el); });
  }

  function initChrome() {
    var bar = document.getElementById("scroll-progress");
    var toTop = document.getElementById("to-top");
    var links = document.querySelectorAll('#nav a[href^="#"]');
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var y = window.scrollY || window.pageYOffset;
        if (bar) bar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
        if (toTop) toTop.classList.toggle("is-on", y > 700);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }

    // active section in the nav
    if ("IntersectionObserver" in window && links.length) {
      var byId = {};
      Array.prototype.forEach.call(links, function (a) {
        byId[a.getAttribute("href").slice(1)] = a;
      });
      var sections = Object.keys(byId)
        .map(function (id) { return document.getElementById(id); })
        .filter(Boolean);

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          Array.prototype.forEach.call(links, function (a) { a.classList.remove("is-active"); });
          var a = byId[e.target.id];
          if (a) a.classList.add("is-active");
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ------------------------------------------------------------------ init */

  // Each feature is isolated: one failing widget must never blank the page or
  // stop the rest from initialising.
  function safe(name, fn) {
    try {
      fn();
    } catch (e) {
      if (window.console && console.warn) console.warn("[worxbend] " + name + " failed:", e);
    }
  }

  // Reveal first — everything after this point is enhancement.
  safe("reveal", initReveal);
  safe("map", function () { buildNodes(); buildBaseEdges(); });
  safe("cards", buildToolCards);
  safe("detail", function () { select(sel); });
  safe("carousel", function () { buildIdeaDots(); paintIdea(); startIdeaTimer(); });
  safe("chrome", initChrome);
  safe("counters", initCounters);
  safe("demo", startDemo);
  safe("background", startBackground);
})();
