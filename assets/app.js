/* worxbend — streaming tools map
   Vanilla port of the Claude Design component logic. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Only genuinely touch-only devices are "coarse". Testing (hover: none)
  // alone is too blunt — it is also true wherever no input device is attached
  // yet, and false-negatives there would silently disable the pointer effects.
  var coarse = window.matchMedia("(pointer: coarse)").matches &&
               !window.matchMedia("(any-hover: hover)").matches;

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
      desc: "Read and send Twitch chat from a terminal — no browser tab, no chat window fighting for focus. It sits in a pane next to obs-stats, talking straight to Twitch IRC.",
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
    msm: {
      label: "msm", sub: "one form, both platforms", chips: ["Rust", "TUI"],
      name: "multistream-manager", kind: "go-live form · Rust · TUI",
      desc: "Type the title, description, tags, category and language once, press Ctrl+G, and Twitch and YouTube are both configured in parallel — then you press Start Streaming in OBS exactly as you always did. Once you are live the same window shows viewers, followers and likes for both, side by side. It deliberately never touches OBS: it gets the platforms ready and leaves going live to you.",
      detailChips: ["Rust", "Twitch + YouTube", "reuses your stream key", "partial success is fine", "MIT"],
      connects: "workstation ──configures──▶ Twitch + YouTube · OBS untouched",
      // The installer is served from the default branch, which is the form the
      // README documents; releases carry Linux x86_64 and aarch64 binaries.
      installs: [{
        tag: "CURL | SH",
        cmd: "curl -fsSL https://raw.githubusercontent.com/worxbend/multistream-manager/main/install.sh | sh",
        inspect: "https://raw.githubusercontent.com/worxbend/multistream-manager/main/install.sh",
        alt: { text: "or cargo install from source ↗", href: "https://github.com/worxbend/multistream-manager#-install" }
      }],
      site: "https://worxbend.github.io/multistream-manager/", repo: "https://github.com/worxbend/multistream-manager"
    },
    yc: {
      label: "yc", sub: "YouTube chat client", chips: ["Go"],
      name: "yc", kind: "YouTube live chat · Go",
      desc: "What twi does for Twitch, against a very different API. YouTube offers no chat socket a REST client can reach — only a polling endpoint and 10,000 units a day — so a YouTube chat client is a budgeting client. yc meters every call it makes, stretches its own poll interval to make the day last, and shows the remaining budget and the effective cadence on every frame. Super Chats, memberships, polls and moderation all render in the pane.",
      detailChips: ["Go", "YouTube Data API v3", "quota meter", "58 themes", "mock mode", "MIT"],
      connects: "workstation ──chat / Data API──▶ YouTube",
      // The installer needs bash: on Debian and Ubuntu /bin/sh is dash, and
      // piping into sh there fails. Upstream documents `| bash` for that reason.
      installs: [{
        tag: "CURL | BASH",
        cmd: "curl --proto '=https' --tlsv1.2 -sSf \\\n  https://github.com/worxbend/yc/releases/latest/download/install.sh | bash",
        inspect: "https://github.com/worxbend/yc/releases/latest/download/install.sh",
        alt: { text: "or go install ↗", href: "https://github.com/worxbend/yc#quickstart" }
      }],
      site: "https://worxbend.github.io/yc/", repo: "https://github.com/worxbend/yc"
    },
    obs: {
      label: "OBS Studio", sub: "capturing · encoding · left alone", chips: ["ENCODING", "OBS 28+"], live: true,
      name: "OBS Studio (remote)", kind: "the streaming rig",
      desc: "OBS runs on a dedicated rig that captures your workstation's screen and audio, encodes, and pushes the stream out to Twitch and YouTube. Encoding load stays off the computer you work on — and you never touch the rig: every knob is turned remotely over obs-websocket, commands out, scenes, audio and telemetry back.",
      detailChips: ["obs-websocket 5.x", "127.0.0.1:4455 by default", "OBS 28+", "busy, and left alone"],
      connects: "captures ◀── workstation · streams ──▶ Twitch + YouTube",
      site: null, repo: null
    },
    twitch: {
      label: "Twitch", sub: "stream + IRC chat", chips: ["RTMP", "IRC"],
      name: "Twitch", kind: "a destination",
      desc: "The rig's OBS pushes the encoded stream to Twitch, msm sets the title, category and tags before you go live, and twi keeps you in the conversation over IRC. Everything you see and type stays on the workstation.",
      detailChips: ["RTMP ingest", "IRC chat", "set up by msm"],
      connects: "remote OBS ──streams──▶ Twitch ◀──chat── twi · configured by msm",
      site: null, repo: null
    },
    youtube: {
      label: "YouTube", sub: "stream + live chat", chips: ["RTMP", "DATA API"],
      name: "YouTube", kind: "the other destination",
      desc: "The same stream, second destination. msm creates the broadcast and fills in its title, description, tags and visibility — reusing your existing stream key rather than regenerating it — and yc reads the live chat over the Data API. No YouTube Studio tab required.",
      detailChips: ["RTMP ingest", "Data API v3 chat", "broadcast created by msm"],
      connects: "remote OBS ──streams──▶ YouTube ◀──chat── yc · configured by msm",
      site: null, repo: null
    }
  };

  /* Stage is 1040x720. The workstation column runs the full height on the
     left; OBS sits high on the right so the lane beneath it stays clear for
     every workstation-to-destination edge, which is what keeps msm, twi and yc
     from having to cross the rig. */
  var GEO = [
    { id: "scenedeck", x: 56,  y: 88,  w: 236, h: 76 },
    { id: "obsctl-rs", x: 56,  y: 174, w: 236, h: 76 },
    { id: "obsctl",    x: 56,  y: 260, w: 236, h: 76 },
    { id: "obs-stats", x: 56,  y: 346, w: 236, h: 76 },
    { id: "msm",       x: 56,  y: 432, w: 236, h: 76 },
    { id: "twi",       x: 56,  y: 518, w: 236, h: 76 },
    { id: "yc",        x: 56,  y: 604, w: 236, h: 76 },
    { id: "obs",       x: 583, y: 112, w: 204, h: 112 },
    { id: "twitch",    x: 838, y: 316, w: 150, h: 76 },
    { id: "youtube",   x: 838, y: 446, w: 150, h: 76 }
  ];

  /* smooth cubic with horizontal tangents between exact node anchor points */
  function C(x1, y1, x2, y2) {
    var dx = (x2 - x1) * 0.45;
    return "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
  }

  /* base: which stroke class the idle edge uses.
     tone: which direction the traffic runs — commands out, telemetry back.
     Both resolve to CSS custom properties, so a theme swap needs no repaint
     pass here at all. */
  var EDGES = [
    /* control tools ──▶ the rig */
    { d: C(292, 126, 583, 132), base: "cmd", dash: "6 6", speed: "1.1s", marker: "url(#arr)", on: ["scenedeck"], tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: C(292, 212, 583, 156), base: "cmd", dash: "6 6", speed: "1.1s", marker: "url(#arr)", on: ["obsctl-rs"], tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: C(292, 298, 583, 180), base: "cmd", dash: "6 6", speed: "1.1s", marker: "url(#arr)", on: ["obsctl"],    tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: C(292, 384, 583, 204), base: "cmd", dash: "3 5", speed: "1.1s", marker: "url(#arr)", on: ["obs-stats"], tone: "cmd", hlMarker: "url(#arrHl)" },

    /* the rig ──▶ back to every control tool */
    { d: C(583, 222, 326, 400), base: "cap", dash: "6 6", speed: "1.3s", reverse: true, marker: "url(#arrCap)", on: ["obs", "scenedeck", "obsctl-rs", "obsctl", "obs-stats"], tone: "tel", hlMarker: "url(#arrCap)" },

    /* the rig ──▶ both destinations. YouTube is reached around the outside so
       the drop does not cut through Twitch on the way past. */
    { d: C(787, 190, 834, 322), base: "cmd", dash: "7 5", speed: "1.1s", marker: "url(#arr)", on: ["obs", "twitch"], tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: "M 792 206 C 930 232, 1026 268, 1026 400 C 1026 438, 1012 458, 992 460", base: "cmd", dash: "7 5", speed: "1.6s", marker: "url(#arr)", on: ["obs", "youtube"], tone: "cmd", hlMarker: "url(#arrHl)" },

    /* msm configures both platforms directly — it never speaks to OBS */
    { d: C(292, 470, 834, 334), base: "cmd", dash: "6 6", speed: "1.4s", marker: "url(#arr)", on: ["msm", "twitch"],  tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: C(292, 470, 834, 462), base: "cmd", dash: "6 6", speed: "1.4s", marker: "url(#arr)", on: ["msm", "youtube"], tone: "cmd", hlMarker: "url(#arrHl)" },

    /* chat clients ──▶ their platform */
    { d: C(292, 556, 834, 366), base: "cmd", dash: "6 6", speed: "1.8s", marker: "url(#arr)", on: ["twi", "twitch"],  tone: "cmd", hlMarker: "url(#arrHl)" },
    { d: C(292, 642, 834, 496), base: "cmd", dash: "6 6", speed: "1.8s", marker: "url(#arr)", on: ["yc", "youtube"],  tone: "cmd", hlMarker: "url(#arrHl)" },

    /* the rig captures the workstation */
    { d: "M 326 52 C 430 20, 486 22, 554 56", base: "cap", dash: "3 4", speed: "2s", marker: "url(#arrCap)", on: ["obs"], tone: "tel", hlMarker: "url(#arrCap)" }
  ];

  /* tone picks the resting colour; paintLabels only toggles .is-on. */
  var LABELS = {
    ws:   { on: ["scenedeck", "obsctl-rs", "obsctl", "obs"], tone: "loud" },
    cmd:  { on: ["scenedeck", "obsctl-rs", "obsctl"],        tone: "quiet" },
    mon:  { on: ["obs-stats"],                               tone: "quiet" },
    tel:  { on: ["obs", "scenedeck", "obsctl-rs", "obsctl", "obs-stats"], tone: "cap" },
    rtmp: { on: ["obs", "twitch", "youtube"],                tone: "loud" },
    cfg:  { on: ["msm", "twitch", "youtube"],                tone: "quiet" },
    chat: { on: ["twi", "twitch"],                           tone: "quiet" },
    ychat:{ on: ["yc", "youtube"],                           tone: "quiet" },
    cap:  { on: ["obs"],                                     tone: "cap" }
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
        t.textContent = "TO TWITCH + YOUTUBE";
        live.appendChild(d);
        live.appendChild(t);
        btn.appendChild(live);
      }

      btn.style.setProperty("--i", String(GEO.indexOf(g)));
      btn.addEventListener("click", function () { select(g.id, btn); });
      nodeHost.appendChild(btn);
    });
  }

  function buildBaseEdges() {
    EDGES.forEach(function (e) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", e.d);
      p.setAttribute("fill", "none");
      p.setAttribute("class", e.base === "cap" ? "edge-cap" : "edge-base");
      p.setAttribute("stroke-width", "1.4");
      p.setAttribute("stroke-dasharray", e.dash);
      p.setAttribute("marker-end", e.marker);
      if (!reduceMotion) {
        p.style.animation = "dashflow " + e.speed + " linear infinite" + (e.reverse ? " reverse" : "");
      }
      baseLayer.appendChild(p);
    });
  }

  var packetLayer = document.getElementById("edges-packets");
  var packets = [];
  var packetRaf = null;
  var packetLast = 0;

  function drawHighlights() {
    hlLayer.textContent = "";
    var live = EDGES.filter(function (e) { return e.on.indexOf(sel) !== -1; });

    live.forEach(function (e) {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", e.d);
      p.setAttribute("fill", "none");
      p.setAttribute("class", e.tone === "tel" ? "hl-tel" : "hl-cmd");
      p.setAttribute("stroke-width", "2.2");
      p.setAttribute("marker-end", e.hlMarker);
      // CSS supplies stroke and currentColor (the glow); --len drives draw-in.
      hlLayer.appendChild(p);

      if (!reduceMotion) {
        var len = pathLength(p);
        if (len) p.style.setProperty("--len", len.toFixed(1));
      }
    });

    buildPackets(live);
  }

  // getTotalLength throws in a few hardened browsers when the SVG is detached
  // or zero-sized. A missing length just means no draw-in, not a broken map.
  function pathLength(p) {
    try { return p.getTotalLength(); } catch (err) { return 0; }
  }

  /* One dot per highlighted edge, riding the curve in the direction the data
     actually travels — commands out, telemetry back. */
  function buildPackets(live) {
    if (!packetLayer) return;
    packetLayer.textContent = "";
    packets.length = 0;

    if (reduceMotion) return stopPackets();

    Array.prototype.forEach.call(hlLayer.children, function (path, i) {
      var len = pathLength(path);
      if (!len) return;
      var e = live[i];
      var dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("r", "3.4");
      dot.setAttribute("class", "map-packet " + (e.tone === "tel" ? "pk-tel" : "pk-cmd"));
      packetLayer.appendChild(dot);
      packets.push({
        path: path,
        len: len,
        el: dot,
        t: (i * 0.27) % 1,
        speed: 0.17 + (i % 3) * 0.035,
        rev: !!e.reverse
      });
    });

    if (packets.length) startPackets(); else stopPackets();
  }

  function stepPackets(now) {
    // rAF hands back the frame's start time, which can predate the clock read
    // in startPackets — clamp so a negative delta never walks a dot backwards.
    var dt = Math.max(0, Math.min(0.05, (now - packetLast) / 1000));
    packetLast = now;

    if (!document.hidden) {
      for (var i = 0; i < packets.length; i++) {
        var pk = packets[i];
        pk.t += dt * pk.speed;
        if (pk.t > 1) pk.t -= 1;
        var at = pk.rev ? 1 - pk.t : pk.t;
        var pt;
        try { pt = pk.path.getPointAtLength(at * pk.len); } catch (err) { continue; }
        pk.el.setAttribute("cx", pt.x);
        pk.el.setAttribute("cy", pt.y);
        // fade in and out at the ends so dots do not pop at the nodes
        var fade = Math.max(0, Math.min(1, Math.sin(pk.t * Math.PI) * 2.2));
        pk.el.setAttribute("opacity", fade.toFixed(3));
      }
    }
    packetRaf = requestAnimationFrame(stepPackets);
  }

  function startPackets() {
    if (packetRaf) return;
    packetLast = performance.now();
    packetRaf = requestAnimationFrame(stepPackets);
  }

  function stopPackets() {
    if (!packetRaf) return;
    cancelAnimationFrame(packetRaf);
    packetRaf = null;
  }

  window.addEventListener("pagehide", stopPackets);

  function paintLabels() {
    Object.keys(LABELS).forEach(function (key) {
      var cfg = LABELS[key];
      var el = document.querySelector('.map-lab[data-lab="' + key + '"]');
      if (!el) return;
      el.setAttribute("data-tone", cfg.tone);
      el.classList.toggle("is-on", cfg.on.indexOf(sel) !== -1);
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

  var detailPanel = document.querySelector(".detail");

  function select(id, originEl) {
    var changed = sel !== id;
    sel = id;
    paintNodes();
    drawHighlights();
    paintLabels();
    paintDetail();

    if (reduceMotion || !changed) return;

    // Wipe the panel's top rule and re-run the body entrance.
    if (detailPanel) {
      detailPanel.classList.remove("is-swapping");
      void detailPanel.offsetWidth;                       // restart the animation
      detailPanel.classList.add("is-swapping");
      [elName, elDesc, elChips, elConnects].forEach(function (el) {
        if (!el) return;
        el.classList.remove("detail-body-anim");
        void el.offsetWidth;
        el.classList.add("detail-body-anim");
      });
    }

    // Ripple out of the node you clicked, in the colour of its traffic.
    if (originEl && window.WB_BG && window.WB_BG.ready) {
      var r = originEl.getBoundingClientRect();
      window.WB_BG.pulse(r.left + r.width / 2, r.top + r.height / 2,
                         id === "obs" || id === "twitch" ? "green" : "purple");
    }
  }

  /* -------------------------------------------------------- idea carousel */

  var IDEA_TITLES = ["SceneDeck", "obsctl-rs — TUI", "obsctl — CLI", "obs-stats", "twi", "msm", "yc"];
  var IDEA_CAPS = [
    ["CODING, PRESENTING, PLAYING.", "NOTHING IS BEING ENCODED HERE."],
    ["HOTKEYS AND A LIVE TUI.",      "ONE DAEMON OWNS THE SOCKET."],
    ["SHELL SCRIPTS WELCOME.",       "JSON IN, EXIT CODES OUT."],
    ["FRAME DROPS, NAMED AND BLAMED.", "BEFORE VIEWERS NOTICE."],
    ["CHAT IN A TERMINAL PANE.",     "NO BROWSER TAB."],
    ["ONE FORM, BOTH PLATFORMS.",    "THEN GO LIVE IN OBS."],
    ["YOUTUBE CHAT, METERED.",       "THE DAY'S QUOTA, MADE TO LAST."]
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

  /* ------------------------------------------------------- background */

  /* The engine is a separate module (assets/bg.js) that owns one canvas and
     nothing else. It starts on Canvas2D straight away — small, no dependency —
     and upgrades itself to the WebGL renderer once PixiJS has loaded, keeping
     the running simulation. Every step is optional: if bg.js will not load the
     page simply has no background, and if PixiJS will not load the Canvas2D
     renderer keeps going. */

  function startBackground() {
    var host = document.getElementById("background-canvas");
    if (!host) return;
    if (reduceMotion) { host.parentNode.removeChild(host); return; }

    loadScript("assets/bg.js")
      .then(function () {
        if (!window.WB_BG) throw new Error("background module missing");
        var ok = window.WB_BG.start({ host: host });
        if (!ok) throw new Error("no renderer available");
        document.documentElement.classList.add("fx-live");
        upgradeRenderer();
      })
      .catch(function (err) {
        if (window.console && console.warn) console.warn("[worxbend] background unavailable:", err);
        if (host.parentNode) host.parentNode.removeChild(host);
      });
  }

  // Only worth the PixiJS download on a machine that will actually enjoy it.
  function wantsWebGL() {
    if (reduceMotion) return false;
    if (window.innerWidth < 760) return false;
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return false;
    if ((navigator.deviceMemory || 8) < 4) return false;
    if ((navigator.hardwareConcurrency || 8) < 4) return false;
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }

  function upgradeRenderer() {
    if (!wantsWebGL()) return;

    function kick() {
      loadScript("assets/vendor/pixi.min.js")
        .then(function () {
          if (!window.PIXI) throw new Error("PIXI global missing");
          return window.WB_BG.useWebGL(window.PIXI);
        })
        .then(function () {
          document.documentElement.classList.add("fx-webgl");
        })
        .catch(function (err) {
          // Canvas2D is already on screen and stays there.
          if (window.console && console.warn) console.warn("[worxbend] webgl renderer declined:", err);
        });
    }

    // Never compete with first paint or the reveal pass.
    if ("requestIdleCallback" in window) window.requestIdleCallback(kick, { timeout: 2600 });
    else setTimeout(kick, 900);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------------ theming */

  var THEME_KEY = "worxbend-theme";

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function storeTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* private mode */ }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme, animate) {
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);

    // A short window of colour transitions, then off again — leaving them on
    // would make every hover on every panel fade instead of respond.
    if (animate && !reduceMotion) {
      root.classList.add("theme-shift");
      clearTimeout(applyTheme.timer);
      applyTheme.timer = setTimeout(function () {
        root.classList.remove("theme-shift");
      }, 420);
    }

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      var next = theme === "light" ? "dark" : "light";
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      btn.setAttribute("aria-label", "Switch to " + next + " theme");
    }

    // Everything that caches a colour re-reads it here.
    if (window.WB_BG && window.WB_BG.refreshTheme) window.WB_BG.refreshTheme();
    document.dispatchEvent(new CustomEvent("worxbend:theme", { detail: { theme: theme } }));
  }

  function initTheme() {
    // The inline bootstrap in <head> already set the attribute; this only
    // wires the control and keeps the OS preference live while unset.
    applyTheme(currentTheme(), false);

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var next = currentTheme() === "light" ? "dark" : "light";
        storeTheme(next);
        applyTheme(next, true);
      });
    }

    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystem = function (ev) {
      if (storedTheme()) return;                 // an explicit choice wins
      applyTheme(ev.matches ? "dark" : "light", true);
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  }

  /* ------------------------------------------------------------ tool cards */

  // Card-only presentation data. Kept beside DATA rather than inside it so the
  // design-sourced copy stays untouched.
  var CARD_ORDER = ["scenedeck", "obsctl-rs", "obsctl", "obs-stats", "msm", "twi", "yc"];
  var CARD_META = {
    scenedeck: {
      accent: "var(--acc-scenedeck)",
      short: "A native GTK4 control panel for the remote OBS — scenes, mixer, telemetry and diagnostics in one window.",
      feats: ["Role-filtered scene switching", "Mixer reaches into nested scenes", "Doctor diagnostics built in"]
    },
    "obsctl-rs": {
      accent: "var(--acc-obsctl-rs)",
      short: "One Rust binary that is a daemon, a TUI and a proxy CLI answering in milliseconds.",
      feats: ["Daemon owns the WebSocket link", "Ratatui TUI + 20 CLI commands", "29 themes, systemd --user service"]
    },
    obsctl: {
      accent: "var(--acc-obsctl)",
      short: "The same control-room idea in Crystal, with a daemon that shrugs off OBS restarts.",
      feats: ["Bounded reconnect backoff", "One JSON envelope per call", "Static musl builds, amd64 + arm64"]
    },
    "obs-stats": {
      accent: "var(--acc-obs-stats)",
      short: "A btop-style health dashboard that tells you which frames are dropping, and why.",
      feats: ["GPU, encoder and network kept apart", "Desktop notification on first drop", "6 views, 24 themes"]
    },
    msm: {
      accent: "var(--acc-msm)",
      short: "One form for Twitch and YouTube, then Start Streaming in OBS as usual.",
      feats: ["Both platforms configured in parallel", "Viewers, followers and likes side by side", "Never touches OBS itself"]
    },
    twi: {
      accent: "var(--acc-twi)",
      short: "Twitch chat in a terminal pane — no browser tab, no window stealing focus.",
      feats: ["Reads and sends over Twitch IRC", "Sits beside obs-stats in a split", "Stays on your workstation"]
    },
    yc: {
      accent: "var(--acc-yc)",
      short: "YouTube live chat in a pane, with a quota meter you can actually see.",
      feats: ["Paces polling to make the day's units last", "Super Chats, members, polls, moderation", "58 themes and a credential-free mock mode"]
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
      card.setAttribute("data-reveal", "stagger-self");
      card.setAttribute("data-spot", "");
      card.setAttribute("data-tilt", "");
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
      // The map now sits above the toolkit, so this scrolls back up.
      focus.textContent = "Show on map ↑";
      focus.addEventListener("click", function () {
        select(id, focus);
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
    { cmd: "msm go --yes --json", out: ['{ "twitch": "ready", "youtube": "ready" }'] },
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

  var revealIO = null;

  function initReveal() {
    if (!("IntersectionObserver" in window) || reduceMotion) {
      revealAll();
      return;
    }
    try {
      revealIO = makeRevealObserver();
    } catch (e) {
      // Anything goes wrong setting up the effect: show the content.
      revealAll();
      return;
    }
    revealScan();

    // Safety nets, in case the effect misbehaves in some browser: never leave
    // content invisible that the reader can already see.
    setTimeout(function () {
      if (!document.querySelector(".reveal.is-in")) return revealAll();
      sweepReveals();
    }, 2500);

    // A hard flick can carry an element past the viewport between two observer
    // samples, which would strand it hidden. Sweep whatever the reader has
    // already scrolled to, shortly after the scrolling stops.
    var sweepTimer = null;
    window.addEventListener("scroll", function () {
      if (sweepTimer) clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweepReveals, 260);
    }, { passive: true });
  }

  // Reveals anything at or above the fold that the observer has not caught.
  function sweepReveals() {
    var pending = document.querySelectorAll(".reveal:not(.is-in)");
    Array.prototype.forEach.call(pending, function (el) {
      var r = el.getBoundingClientRect();
      if (r.top >= window.innerHeight) return;         // still genuinely below
      el.classList.add("is-in");
      if (revealIO) revealIO.unobserve(el);
      runScrambles(el);
    });
  }

  // Observes any .reveal not already being watched. Must be called again after
  // rendering new markup — tool cards are built after initReveal() runs.
  function revealScan() {
    if (!revealIO) { revealAll(); return; }
    var fresh = document.querySelectorAll(".reveal:not([data-rv])");
    Array.prototype.forEach.call(fresh, function (el, i) {
      el.setAttribute("data-rv", "1");
      var variant = el.getAttribute("data-reveal");

      if (variant === "stagger") {
        // Children cascade; the container itself does not move.
        Array.prototype.forEach.call(el.children, function (child, k) {
          child.style.setProperty("--i", String(k));
        });
      } else if (variant === "stagger-self") {
        // Position among sibling reveals, so a grid row lands left to right.
        var at = 0;
        try {
          var peers = el.parentNode.querySelectorAll(":scope > .reveal");
          at = Array.prototype.indexOf.call(peers, el);
        } catch (err) { at = 0; }
        el.style.transitionDelay = Math.min(Math.max(at, 0), 7) * 65 + "ms";
      } else {
        el.style.transitionDelay = Math.min(i % 6, 5) * 55 + "ms";
      }

      if (el.hasAttribute("data-split")) splitWords(el);
      revealIO.observe(el);
    });
  }

  function makeRevealObserver() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
        runScrambles(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    return io;
  }

  /* ------------------------------------------------------ split headline */

  // Wraps each top-level word in an overflow-clipped box so it can slide up
  // from underneath. Inline elements (the accent span) move as one unit, which
  // keeps their background-clip gradient intact.
  function splitWords(el) {
    if (el.getAttribute("data-split-done") === "1") return;
    var parts = [];

    Array.prototype.forEach.call(el.childNodes, function (node) {
      if (node.nodeType === 3) {
        node.nodeValue.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { parts.push(document.createTextNode(" ")); return; }
          var box = document.createElement("span");
          box.className = "split-word";
          var inner = document.createElement("span");
          inner.textContent = chunk;
          box.appendChild(inner);
          parts.push(box);
        });
      } else if (node.nodeType === 1) {
        var wrap = document.createElement("span");
        wrap.className = "split-word";
        var hold = document.createElement("span");
        hold.appendChild(node.cloneNode(true));
        wrap.appendChild(hold);
        parts.push(wrap);
      }
    });

    el.textContent = "";
    var idx = 0;
    parts.forEach(function (p) {
      if (p.nodeType === 1) {
        p.firstChild.style.setProperty("--i", String(idx++));
      }
      el.appendChild(p);
    });
    el.setAttribute("data-split-done", "1");
  }

  /* ---------------------------------------------------------- scramble */

  var SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+/<>_";

  function runScrambles(root) {
    if (reduceMotion) return;
    var targets = root.matches && root.matches("[data-scramble]")
      ? [root]
      : Array.prototype.slice.call(root.querySelectorAll("[data-scramble]"));
    targets.forEach(scramble);
  }

  // Mono labels resolve character by character, like a terminal settling.
  function scramble(el) {
    if (el.getAttribute("data-scrambled") === "1") return;
    el.setAttribute("data-scrambled", "1");

    var text = el.textContent;
    var n = text.length;
    if (!n) return;
    var dur = 340 + n * 16;
    var t0 = performance.now();

    (function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      var settled = p * n * 1.3;
      var out = "";
      for (var i = 0; i < n; i++) {
        var ch = text.charAt(i);
        if (i < settled || ch === " " || ch === "·") out += ch;
        else out += SCRAMBLE_POOL.charAt((Math.random() * SCRAMBLE_POOL.length) | 0);
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = text;
    })(t0);
  }

  /* ------------------------------------------------- pointer-led effects */

  /* ------------------------------------------------- the travelling light */

  // Everything the light touches — background layer, widget surfaces, chrome —
  // reads one set of custom properties on :root. Nothing reads the raw cursor:
  // three followers chase it at different rates, so the glow arrives a beat
  // after the pointer and keeps sliding for a moment once it stops.
  var LIT_SELECTOR = [
    ".tool-card", ".why-card", ".stat", ".step", ".faq-item", ".win",
    ".demo-win", ".map-frame", ".map-node", ".detail", ".cmd-box", ".idea-link"
  ].join(",");

  // Palette the light cycles through as it travels. Sourced from the theme's
  // --fx-* tokens so the light recolours with the rest of the page.
  var LIGHT_STOPS = [
    [180, 154, 240], [138, 176, 240], [95, 206, 147], [143, 240, 189], [205, 187, 247]
  ];

  function readLightStops() {
    var cs = getComputedStyle(document.documentElement);
    ["--fx-c1", "--fx-c2", "--fx-c3", "--fx-c4", "--fx-c5"].forEach(function (name, i) {
      var raw = cs.getPropertyValue(name).trim();
      if (!raw) return;
      var parts = raw.split(/[\s,]+/).map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) LIGHT_STOPS[i] = parts;
    });
  }

  function stopAt(phase) {
    var n = LIGHT_STOPS.length;
    var f = ((phase % n) + n) % n;
    var i = Math.floor(f), t = f - i;
    var a = LIGHT_STOPS[i], b = LIGHT_STOPS[(i + 1) % n];
    // smoothstep between stops so the colour never steps
    var k = t * t * (3 - 2 * t);
    return Math.round(a[0] + (b[0] - a[0]) * k) + " " +
           Math.round(a[1] + (b[1] - a[1]) * k) + " " +
           Math.round(a[2] + (b[2] - a[2]) * k);
  }

  function initSpotlight() {
    if (coarse || reduceMotion) return;

    var root = document.documentElement;
    readLightStops();
    document.addEventListener("worxbend:theme", function () {
      readLightStops();
      c1 = "";                       // force a colour write on the next frame
      wake();
    });
    var W = window.innerWidth, H = window.innerHeight;

    // One source of truth: the light only paints once this driver is running.
    root.classList.add("has-pointer");

    // Mark every widget the light should wash over, then let CSS do the rest.
    Array.prototype.forEach.call(document.querySelectorAll(LIT_SELECTOR), markLit);

    var raw = { x: W * 0.5, y: H * 0.4 };
    var f1 = { x: raw.x, y: raw.y };
    var f2 = { x: raw.x, y: raw.y };
    var f3 = { x: raw.x, y: raw.y };

    var phase = 0, on = 0, want = 0, heat = 0, seen = false;
    var raf = null, last = 0, current = null;
    var tint = 0, litClock = 0, c1 = "", c2 = "", c3 = "";
    var longFrames = 0, lite = false;

    function wake() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }

    window.addEventListener("pointermove", function (ev) {
      raw.x = ev.clientX;
      raw.y = ev.clientY;
      if (!seen) {                    // first sighting: start from under the cursor
        seen = true;
        f1.x = f2.x = f3.x = raw.x;
        f1.y = f2.y = f3.y = raw.y;
      }
      want = 1;
      wake();
    }, { passive: true });

    window.addEventListener("pointerdown", function () { heat = Math.min(1.6, heat + 0.8); wake(); }, { passive: true });
    document.addEventListener("pointerleave", function () { want = 0; wake(); });
    window.addEventListener("blur", function () { want = 0; wake(); });
    window.addEventListener("resize", function () { W = window.innerWidth; H = window.innerHeight; }, { passive: true });

    function ease(pt, to, dt, k) {
      var a = 1 - Math.exp(-k * dt);      // frame-rate independent damping
      pt.x += (to.x - pt.x) * a;
      pt.y += (to.y - pt.y) * a;
    }

    function step(now) {
      var raw_dt = now - last;
      var dt = Math.max(0.001, Math.min(0.05, raw_dt / 1000));
      last = now;

      // This loop only runs while the pointer is moving, which is exactly when
      // the effect costs the most — so it is the right place to notice a
      // machine that cannot keep up and shed the two most expensive layers.
      if (!lite) {
        longFrames = raw_dt > 26 ? longFrames + 1 : Math.max(0, longFrames - 1);
        if (longFrames > 70) {
          lite = true;
          root.classList.add("fx-lite");
        }
      }

      var before = f1.x, beforeY = f1.y;
      ease(f1, raw, dt, 11);
      ease(f2, f1, dt, 4.6);
      ease(f3, f2, dt, 2.1);

      // Speed drives both the colour cycle and how hot the core burns.
      var moved = Math.hypot(f1.x - before, f1.y - beforeY);
      var speed = Math.min(1, moved / (dt * 1400));
      heat += (speed - heat) * Math.min(1, dt * 5);
      heat = Math.max(0, heat - dt * 0.15);
      phase += moved * 0.0016 + dt * 0.06;

      on += (want - on) * Math.min(1, dt * 3.2);

      // Position and opacity are composited, so they run every frame.
      root.style.setProperty("--pt-x", f1.x.toFixed(1) + "px");
      root.style.setProperty("--pt-y", f1.y.toFixed(1) + "px");
      root.style.setProperty("--pt2-x", f2.x.toFixed(1) + "px");
      root.style.setProperty("--pt2-y", f2.y.toFixed(1) + "px");
      root.style.setProperty("--pt3-x", f3.x.toFixed(1) + "px");
      root.style.setProperty("--pt3-y", f3.y.toFixed(1) + "px");
      root.style.setProperty("--pt-on", on.toFixed(3));
      root.style.setProperty("--pt-heat", Math.min(1, heat).toFixed(3));

      // Colour does repaint, and the palette drifts far slower than the
      // pointer moves — 12 Hz is indistinguishable and a fraction of the cost.
      tint += dt;
      if (tint > 0.08 || !c1) {
        tint = 0;
        c1 = stopAt(phase);
        c2 = stopAt(phase + 0.9);
        c3 = stopAt(phase + 2.1);
        root.style.setProperty("--pt-c1", c1);
        root.style.setProperty("--pt-c2", c2);
        root.style.setProperty("--pt-c3", c3);
      }

      // Repainting the widget under the light is the one unavoidable cost;
      // half rate is plenty when the sheen is trailing anyway.
      litClock += dt;
      if (litClock > 0.032) {
        litClock = 0;
        paintLit(f2.x, f2.y, on);
      }

      // Sleep once the followers have caught up and the fade has settled.
      var slack = Math.abs(raw.x - f1.x) + Math.abs(raw.y - f1.y) +
                  Math.abs(f1.x - f2.x) + Math.abs(f1.y - f2.y) +
                  Math.abs(f2.x - f3.x) + Math.abs(f2.y - f3.y);
      if (slack < 0.6 && Math.abs(want - on) < 0.004 && heat < 0.01) {
        raf = null;
        return;
      }
      raf = requestAnimationFrame(step);
    }

    // Only the widget under the *lagging* point is updated, so this stays one
    // hit test and one style write per frame however many widgets exist.
    function paintLit(x, y, level) {
      var hit = null;
      if (level > 0.02) {
        var under = document.elementFromPoint(x, y);
        hit = under && under.closest ? under.closest("[data-spot]") : null;
      }
      if (hit !== current) {
        if (current) current.classList.remove("is-lit");
        current = hit;
        if (current) current.classList.add("is-lit");
      }
      if (!current) return;
      var r = current.getBoundingClientRect();
      if (!r.width || !r.height) return;
      current.style.setProperty("--mx", (((x - r.left) / r.width) * 100).toFixed(1) + "%");
      current.style.setProperty("--my", (((y - r.top) / r.height) * 100).toFixed(1) + "%");
    }

    wake();
  }

  // Widgets need a marker attribute plus a child for the edge hairline; the
  // surface glow itself rides on ::after.
  function markLit(el) {
    if (el.getAttribute("data-lit") === "1") return;
    el.setAttribute("data-lit", "1");
    el.setAttribute("data-spot", "");
    var edge = document.createElement("span");
    edge.className = "lit-edge";
    edge.setAttribute("aria-hidden", "true");
    el.appendChild(edge);
  }

  function initTilt() {
    if (coarse || reduceMotion) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tilt]"), function (el) {
      var raf = null, rx = 0, ry = 0;

      el.addEventListener("pointermove", function (ev) {
        var r = el.getBoundingClientRect();
        rx = (((ev.clientY - r.top) / r.height) - 0.5) * -5.5;
        ry = (((ev.clientX - r.left) / r.width) - 0.5) * 5.5;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          el.classList.add("tilt-on");
          el.style.transform =
            "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) +
            "deg) translate3d(0,-4px,0)";
        });
      }, { passive: true });

      el.addEventListener("pointerleave", function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.classList.remove("tilt-on");
        el.style.transform = "";
      });
    });
  }

  function initMagnet() {
    if (coarse || reduceMotion) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-magnet]"), function (el) {
      el.addEventListener("pointermove", function (ev) {
        var r = el.getBoundingClientRect();
        var dx = ((ev.clientX - (r.left + r.width / 2)) / r.width) * 10;
        var dy = ((ev.clientY - (r.top + r.height / 2)) / r.height) * 6;
        el.style.transform = "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px,0)";
      }, { passive: true });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ------------------------------------------------------------- ticker */

  var TICKER = [
    "OBS-WEBSOCKET 5.X", "127.0.0.1:4455", "SCENES", "AUDIO MIXER", "TELEMETRY",
    "RUST", "CRYSTAL", "GO", "RATATUI", "GTK4", "TWITCH IRC", "YOUTUBE DATA API",
    "QUOTA-AWARE POLLING", "ONE FORM, BOTH PLATFORMS", "STATIC MUSL BUILDS",
    "JSON ENVELOPES", "HONEST EXIT CODES", "SINGLE BINARIES", "MIT LICENSED"
  ];
  var TICKER_HOT = { "SINGLE BINARIES": 1, TELEMETRY: 1, "MIT LICENSED": 1, "YOUTUBE DATA API": 1 };

  function buildTicker() {
    var track = document.getElementById("ticker-track");
    if (!track) return;

    // Two identical runs so the -50% loop is seamless.
    for (var pass = 0; pass < 2; pass++) {
      TICKER.forEach(function (word) {
        var item = document.createElement("span");
        item.className = "ticker-item" + (TICKER_HOT[word] ? " hot" : "");
        var sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "◆";
        item.appendChild(sep);
        item.appendChild(document.createTextNode(word));
        track.appendChild(item);
      });
    }
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
    var bar = document.querySelector(".scroll-progress-bar");
    var toTop = document.getElementById("to-top");
    var ring = document.getElementById("to-top-val");
    var header = document.getElementById("header-bar");
    var links = document.querySelectorAll('#nav a[href^="#"]');
    var ticking = false;
    var RING = 2 * Math.PI * 16;

    if (ring) ring.setAttribute("stroke-dasharray", RING.toFixed(2));

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var y = window.scrollY || window.pageYOffset;
        var p = h > 0 ? Math.min(1, Math.max(0, y / h)) : 0;
        if (bar) bar.style.width = (p * 100) + "%";
        if (ring) ring.setAttribute("stroke-dashoffset", (RING * (1 - p)).toFixed(2));
        if (toTop) toTop.classList.toggle("is-on", y > 700);
        if (header) header.classList.toggle("is-stuck", y > 12);
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

  // Theme first: it decides the colours everything below reads.
  safe("theme", initTheme);

  // Reveal next — everything after this point is enhancement.
  safe("reveal", initReveal);
  safe("ticker", buildTicker);
  safe("map", function () { buildNodes(); buildBaseEdges(); });
  safe("cards", buildToolCards);
  safe("detail", function () { select(sel); });
  safe("carousel", function () { buildIdeaDots(); paintIdea(); startIdeaTimer(); });
  safe("chrome", initChrome);
  safe("counters", initCounters);
  safe("demo", startDemo);

  // Pick up .reveal elements rendered by the builders above, then arm the
  // pointer effects on everything that now exists.
  safe("reveal-rescan", revealScan);
  safe("spotlight", initSpotlight);
  safe("tilt", initTilt);
  safe("magnet", initMagnet);

  safe("background", startBackground);
})();
