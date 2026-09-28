/* Shared streaming-tool facts and upstream installation commands. */
window.STREAMING_TOOLS = {
  scenedeck: {
    category: "control",
    short:
      "A native GTK4 desktop remote for OBS scenes, audio, telemetry and diagnostics.",
    label: "scenedeck",
    sub: "desktop GUI remote",
    chips: ["GTK4"],
    name: "SceneDeck",
    kind: "desktop remote · Rust · GTK4",
    desc: "A native GTK4 control surface for the remote OBS. Role-filtered scene switching, a mixer that reaches into nested scenes, live telemetry and Doctor diagnostics — a full control panel on your workstation, always in reach, never stealing focus from what you're capturing.",
    detailChips: [
      "Rust",
      "GTK4 + libadwaita",
      "Linux",
      "snap install scenedeck",
      "MIT",
    ],
    connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
    // Published to the Snap Store under strict confinement; no curl installer.
    // Release assets are version-stamped, so the binary option resolves the
    // latest tag first rather than using a latest/download URL.
    installs: [
      { tag: "SNAP STORE", cmd: "sudo snap install scenedeck" },
      {
        tag: "GITHUB RELEASE — BINARY",
        cmd:
          "VER=$(curl -fsSL https://api.github.com/repos/worxbend/scenedeck/releases/latest | grep -m1 '\"tag_name\"' | cut -d'\"' -f4)\n" +
          'curl -fsSL -o scenedeck "https://github.com/worxbend/scenedeck/releases/download/$VER/scenedeck-${VER#v}-linux-amd64"\n' +
          "install -Dm755 scenedeck ~/.local/bin/scenedeck",
        alt: {
          text: "all builds — AppImage, arm64 ↗",
          href: "https://github.com/worxbend/scenedeck/releases/latest",
        },
      },
    ],
    site: "https://worxbend.github.io/scenedeck/",
    repo: "https://github.com/worxbend/scenedeck",
  },
  "obsctl-rs": {
    category: "control",
    short:
      "A Rust daemon, terminal dashboard and fast command-line remote in one binary.",
    label: "obsctl-rs",
    sub: "daemon · TUI · CLI",
    chips: ["Rust", "Ratatui"],
    name: "obsctl-rs",
    kind: "daemon + TUI + CLI · Rust",
    desc: "An OBS command center in one Rust binary. A local daemon owns the WebSocket link to the remote OBS; a keyboard-driven TUI shows live state; a proxy CLI answers in milliseconds — bind scene switches and mute toggles to any hotkey or script on your workstation.",
    detailChips: [
      "Rust",
      "Ratatui TUI",
      "single binary",
      "scriptable CLI",
      "JSON envelope",
      "built-in themes",
      "MIT",
    ],
    connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
    installs: [
      {
        tag: "CURL | SH",
        cmd: "curl -fsSL https://github.com/worxbend/obsctl-rs/releases/latest/download/install.sh | sh",
        inspect:
          "https://github.com/worxbend/obsctl-rs/releases/latest/download/install.sh",
      },
    ],
    site: "https://worxbend.github.io/obsctl-rs/",
    repo: "https://github.com/worxbend/obsctl-rs",
  },
  obsctl: {
    category: "control",
    short:
      "A resilient OBS daemon, terminal interface and scriptable CLI built in Crystal.",
    label: "obsctl",
    sub: "daemon · TUI · CLI",
    chips: ["Crystal"],
    name: "obsctl",
    kind: "daemon + TUI + CLI · Crystal",
    desc: "The same control-room idea in Crystal. A resilient daemon that survives OBS restarts with bounded reconnect backoff, a CLI that prints one JSON envelope per call with exit codes that mean something in shell scripts, and a TUI built on its own CryTUI library.",
    detailChips: [
      "Crystal",
      "static musl builds",
      "amd64 + arm64",
      "EN + UK locales",
      "MIT",
    ],
    connects: "workstation ──commands──▶ remote OBS ──telemetry──▶ back",
    // Installer is served from the project's own Pages site (the form its
    // README documents) and is also attached to every release.
    installs: [
      {
        tag: "CURL | SH",
        cmd: "curl -fsSL https://worxbend.github.io/obsctl/install.sh | sh",
        inspect: "https://worxbend.github.io/obsctl/install.sh",
        alt: {
          text: "prebuilt static binaries ↗",
          href: "https://github.com/worxbend/obsctl/releases",
        },
      },
    ],
    site: "https://worxbend.github.io/obsctl/",
    repo: "https://github.com/worxbend/obsctl",
  },
  "obs-stats": {
    category: "monitor",
    short:
      "See GPU, encoder and network frame loss separately in a terminal dashboard.",
    label: "obs-stats",
    sub: "terminal health dashboard",
    chips: ["Rust", "Ratatui"],
    name: "obs-stats",
    kind: "terminal dashboard · Rust · Ratatui",
    desc: "A btop-style dashboard watching the remote OBS from a terminal pane. It keeps GPU, encoder and network frame loss apart — each has a different fix — and raises a banner plus a Linux desktop notification when frame-loss alerts trigger, so you find out before your viewers do.",
    detailChips: [
      "Rust",
      "6 views",
      "Linux desktop notifications",
      "built-in themes",
      "Linux / macOS / Windows",
      "MIT",
    ],
    connects: "workstation ──monitor──▶ remote OBS (read-only telemetry)",
    installs: [
      {
        tag: "CURL | SH",
        cmd: "curl -fsSL https://raw.githubusercontent.com/worxbend/obs-stats/main/scripts/install.sh | sh",
        inspect:
          "https://raw.githubusercontent.com/worxbend/obs-stats/main/scripts/install.sh",
      },
    ],
    site: "https://worxbend.github.io/obs-stats/",
    repo: "https://github.com/worxbend/obs-stats",
  },
  twi: {
    category: "chat",
    short: "Read and send Twitch chat from a focused terminal pane.",
    label: "twi",
    sub: "terminal chat client",
    chips: ["IRC"],
    name: "twi",
    kind: "Twitch chat client · Go",
    desc: "Read and send Twitch chat from a terminal — no browser tab, no chat window fighting for focus. It sits in a pane next to obs-stats, talking straight to Twitch IRC.",
    detailChips: ["Go", "Twitch IRC", "terminal pane", "MIT"],
    connects: "workstation ──chat / IRC──▶ Twitch",
    // The README also documents a snap, but snapcraft.io/twi is not published
    // yet — curl-pipe is the only install path that currently works.
    installs: [
      {
        tag: "CURL | SH",
        cmd: "curl -fsSL https://github.com/worxbend/twi/releases/latest/download/install.sh | sh",
        inspect:
          "https://github.com/worxbend/twi/releases/latest/download/install.sh",
      },
    ],
    site: "https://worxbend.github.io/twi/",
    repo: "https://github.com/worxbend/twi",
  },
  msm: {
    category: "live",
    short:
      "Prepare Twitch and YouTube together, with chat and optional OBS controls in one terminal.",
    label: "msm",
    sub: "one form, both platforms",
    chips: ["Rust", "TUI"],
    name: "multistream-manager",
    kind: "go-live form · Rust · TUI",
    desc: "Prepare Twitch and YouTube together from one terminal form, then choose when to go live. Platform setup does not start OBS automatically. Follow both chats and live statistics in the same interface, or use the optional OBS tab to switch scenes, adjust audio, and start or stop streaming and recording.",
    detailChips: [
      "Rust",
      "Twitch + YouTube",
      "chat + broadcast setup",
      "optional OBS controls",
      "reuses your stream key",
      "MIT",
    ],
    connects:
      "workstation ──chat + setup──▶ Twitch + YouTube · optional controls ──▶ OBS",
    // The installer is served from the default branch, which is the form the
    // README documents; releases carry Linux x86_64 and aarch64 binaries.
    installs: [
      {
        tag: "CURL | SH",
        cmd: "curl -fsSL https://raw.githubusercontent.com/worxbend/multistream-manager/main/install.sh | sh",
        inspect:
          "https://raw.githubusercontent.com/worxbend/multistream-manager/main/install.sh",
        alt: {
          text: "or cargo install from source ↗",
          href: "https://github.com/worxbend/multistream-manager#-install",
        },
      },
    ],
    site: "https://worxbend.github.io/multistream-manager/",
    repo: "https://github.com/worxbend/multistream-manager",
  },
  yc: {
    category: "chat",
    short:
      "Follow YouTube live chat with visible quota tracking and adaptive polling.",
    label: "yc",
    sub: "YouTube chat client",
    chips: ["Go"],
    name: "yc",
    kind: "YouTube live chat · Go",
    desc: "YouTube live chat in a terminal, with API quota estimates and budget-aware polling. yc tracks the calls it makes, adapts its polling interval, and displays the estimated remaining budget and effective cadence. Super Chats, memberships, polls and moderation events render in the pane, with a credential-free mock mode for trying the interface.",
    detailChips: [
      "Go",
      "YouTube Data API v3",
      "quota meter",
      "built-in themes",
      "mock mode",
      "MIT",
    ],
    connects: "workstation ──chat / Data API──▶ YouTube",
    // The installer needs bash: on Debian and Ubuntu /bin/sh is dash, and
    // piping into sh there fails. Upstream documents `| bash` for that reason.
    installs: [
      {
        tag: "CURL | BASH",
        cmd: "curl --proto '=https' --tlsv1.2 -sSf \\\n  https://github.com/worxbend/yc/releases/latest/download/install.sh | bash",
        inspect:
          "https://github.com/worxbend/yc/releases/latest/download/install.sh",
        alt: {
          text: "or go install ↗",
          href: "https://github.com/worxbend/yc#quickstart",
        },
      },
    ],
    site: "https://worxbend.github.io/yc/",
    repo: "https://github.com/worxbend/yc",
  },
  obs: {
    label: "OBS Studio",
    sub: "capturing · encoding · left alone",
    chips: ["ENCODING", "OBS 28+"],
    live: true,
    name: "OBS Studio (remote)",
    kind: "the streaming rig",
    desc: "OBS runs on a dedicated rig that captures your workstation's screen and audio, encodes, and pushes the stream out to Twitch and YouTube. Encoding load stays off the computer you work on — and you never touch the rig: every knob is turned remotely over obs-websocket, commands out, scenes, audio and telemetry back.",
    detailChips: [
      "obs-websocket 5.x",
      "127.0.0.1:4455 by default",
      "OBS 28+",
      "busy, and left alone",
    ],
    connects: "captures ◀── workstation · streams ──▶ Twitch + YouTube",
    site: null,
    repo: null,
  },
  twitch: {
    label: "Twitch",
    sub: "stream + IRC chat",
    chips: ["RTMP", "IRC"],
    name: "Twitch",
    kind: "a destination",
    desc: "The rig's OBS pushes the encoded stream to Twitch, msm sets the title, category and tags before you go live, and twi keeps you in the conversation over IRC. Everything you see and type stays on the workstation.",
    detailChips: ["RTMP ingest", "IRC chat", "set up by msm"],
    connects:
      "remote OBS ──streams──▶ Twitch ◀──chat── twi · configured by msm",
    site: null,
    repo: null,
  },
  youtube: {
    label: "YouTube",
    sub: "stream + live chat",
    chips: ["RTMP", "DATA API"],
    name: "YouTube",
    kind: "the other destination",
    desc: "The same stream, second destination. msm creates the broadcast and fills in its title, description, tags and visibility — reusing your existing stream key rather than regenerating it — and yc reads the live chat over the Data API. No YouTube Studio tab required.",
    detailChips: [
      "RTMP ingest",
      "Data API v3 chat",
      "broadcast created by msm",
    ],
    connects:
      "remote OBS ──streams──▶ YouTube ◀──chat── yc · configured by msm",
    site: null,
    repo: null,
  },
};
