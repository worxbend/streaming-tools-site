# worxbend — streaming tools map

Landing page for the worxbend streaming tooling: an interactive map of how
`scenedeck`, `obsctl-rs`, `obsctl` and `obs-stats` talk to a remote OBS over
obs-websocket 5.x, and how `msm`, `twi` and `yc` reach Twitch and YouTube
directly without going through the rig at all.

Implemented from the Claude Design source `Worxbend Streaming Tools.dc.html`.

## Stack

None. It is a static site — plain HTML, CSS and vanilla JS. No build step, no
framework, no bundler. The one third-party dependency is PixiJS, vendored as a
plain `<script>` under `assets/vendor/` and loaded lazily at runtime. The design source used the Claude Design `dc-runtime`
(React-backed `x-dc` template DSL, `support.js`); that runtime is a preview harness
and is deliberately **not** shipped. Its constructs were translated directly:

| Design source        | Here                                        |
| -------------------- | ------------------------------------------- |
| `<helmet>`           | real `<head>`                               |
| `sc-for`             | JS loops building DOM                       |
| `sc-if`              | `hidden` / class toggles                    |
| `style-hover="…"`    | CSS `:hover` rules                          |
| `{{ binding }}`      | `paint*()` functions in `assets/app.js`     |
| `DCLogic` class      | the IIFE in `assets/app.js`                 |
| `data-screen-label`  | dropped (editor-only metadata)              |

## Layout

```
index.html              markup and copy
assets/styles.css       theme tokens (dark + light) + all styling
assets/app.js           tool data, map graph, carousel, reveals, theme, pointer light
assets/bg.js            the background engine — particles, springs, energy, renderers
assets/vendor/pixi.min.js  vendored PixiJS 8 (MIT), loaded lazily
favicon.svg
netlify.toml        Netlify deploy + header config
CNAME               custom domain for GitHub Pages
.nojekyll           tell Pages to skip Jekyll processing
.github/workflows/deploy-pages.yml
```

All asset references in `index.html` are **relative** (`assets/…`, not `/assets/…`),
so the site works unchanged whether it is served from a domain root (Netlify, or
Pages on the custom domain) or from a project subpath such as
`worxbend.github.io/streaming-tools-site/`. Keep them relative if you add pages.

## Local preview

Any static file server works, e.g.:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Opening `index.html` directly over `file://` also works, except the absolute
`/assets/...` paths — use a server.

## Deploying to Netlify

The repo is deploy-ready as-is; `netlify.toml` publishes the root with no build command.

**Git-based (recommended)** — connect the repo in the Netlify UI. Build settings are
picked up from `netlify.toml`; leave the build command empty and publish directory `.`.

**CLI:**

```sh
npm i -g netlify-cli
netlify deploy            # draft URL
netlify deploy --prod     # production
```

**Drag-and-drop:** zip the repo contents (minus `.git`) and drop it on
app.netlify.com — no config needed beyond what is already committed.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` deploys on every push to `main` (and on
manual dispatch). It assembles an explicit `_site/` directory rather than
publishing the repo root, so `.git`, `netlify.toml` and the workflow itself stay
out of the published site.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. No branch selection is needed — the workflow pushes the artifact.

## Where the site is served

| URL | Host | Notes |
| --- | ---- | ----- |
| `https://obs.worxbend.com` | **Netlify** | canonical; DNS points here |
| `https://worxbend.github.io/streaming-tools-site/` | GitHub Pages | mirror, deployed by the workflow |

Both deploy from this repo and are independent of each other.

### About the `CNAME` file — read before changing Pages settings

`CNAME` contains `obs.worxbend.com`, but **that domain is served by Netlify**, not
by Pages. DNS resolves `obs.worxbend.com` → `streaming-tools.netlify.app`.

The file is currently **inert**. Under the *GitHub Actions* Pages build type — what
this repo uses — a `CNAME` file in the artifact does **not** configure the custom
domain; that is only the behaviour of the *deploy from a branch* build type. The
Pages API confirms the repo's `cname` is `null`, so Pages serves the
`github.io` URL and simply publishes `/CNAME` as an ordinary static file.

> [!WARNING]
> If Pages is ever switched to **deploy from a branch**, this file *would* claim
> `obs.worxbend.com` for Pages. A domain can only be claimed by one host, so that
> would collide with the live Netlify site. Delete `CNAME` before making that
> switch, or move the domain deliberately (see below).

It sits at the repo root rather than `docs/CNAME` because the Actions artifact
root *is* the site root; `docs/CNAME` only applies to branch-deploys sourced from
the `/docs` folder.

### If you ever want Pages to own the domain

In this order, to minimise downtime:

1. Remove the custom domain from the Netlify site.
2. Repoint DNS: `obs.worxbend.com. CNAME worxbend.github.io.`
3. Set it in **Settings → Pages → Custom domain** (or
   `gh api -X PUT repos/worxbend/streaming-tools-site/pages -f cname=obs.worxbend.com`).
4. Tick **Enforce HTTPS** once the certificate is issued.

## Install commands

Real install commands with copy buttons appear in two places — each tool's card
in **The toolkit**, and its detail panel under the map. Both render from the same
`installs` array in `DATA` (`assets/app.js`) via one shared `installBlock()`
builder, so they cannot drift apart. A tool may list more than one option.

Commands were taken from each project's own README and then checked to confirm
the URL actually serves what it claims:

| Tool | Method | Source |
| ---- | ------ | ------ |
| `obsctl-rs` | `curl \| sh` | `releases/latest/download/install.sh` |
| `obsctl` | `curl \| sh` | `worxbend.github.io/obsctl/install.sh` |
| `obs-stats` | `curl \| sh` | `raw.githubusercontent.com/.../main/scripts/install.sh` |
| `twi` | `curl \| sh` | `releases/latest/download/install.sh` |
| `msm` | `curl \| sh` | `raw.githubusercontent.com/.../main/install.sh` |
| `yc` | `curl \| bash` | `releases/latest/download/install.sh` |
| `scenedeck` | Snap Store | strict-confinement snap |
| `scenedeck` | GitHub release binary | for people who do not use snap |

Every `curl` uses `-fsSL` (or `--proto '=https' --tlsv1.2 -sSf`, which `yc`
documents). The `L` matters: the release-asset URLs answer `302`, so a command
without `-L` pipes a redirect body into `sh` and silently does nothing.

> [!NOTE]
> `yc` pipes into **`bash`**, not `sh`, and that is not a typo. On Debian and
> Ubuntu `/bin/sh` is `dash`, and its installer needs bash. Copying it as
> `| sh` there fails.

`obsctl` uses the Pages-hosted URL because that is the form its README documents;
the same script is attached to each release at
`releases/latest/download/install.sh` if you prefer that.

**scenedeck** is the one tool with no installer script. It is published to the
Snap Store, and for anyone not using snap the second option resolves the current
release tag from the GitHub API, downloads the binary and `install -Dm755`s it —
its assets are version-stamped (`scenedeck-0.1.21-linux-amd64`), so there is no
stable `latest/download` URL. It also links the releases page for the AppImage,
flatpak and arm64 builds.

Where a script is piped to a shell, the block links the raw script as *read it
first* so it can be inspected before running.

> [!NOTE]
> These are copies of upstream instructions. If a tool changes how it is
> installed, update `DATA[...].install` here too — nothing verifies it
> automatically.

## Page structure

| Section | Built from |
| ------- | ---------- |
| Hero + stats band | markup; counters animate from `data-count` |
| The idea | markup; 7-panel carousel auto-advances every 3.2s, pauses on hover |
| The map + detail | rendered from `DATA` + `GEO` + `EDGES` |
| The toolkit | rendered from `DATA` + `CARD_META` (per-card accent, blurb, features) |
| Questions | markup (`<details>`); covers the two-machine, OBS-version and YouTube questions |
| In the terminal | `DEMO` transcript, typed character by character on a loop |
| Quick start | markup; commands taken from the obsctl-rs README |

## Theming

Two themes: dark (the default) and a warm-paper light. Both are pure token
swaps — `:root` holds dark, `[data-theme="light"]` overrides the same names, and
**no rule below the token block names a colour literally**. That is the whole
contract; if a new rule hardcodes a hex, one of the two themes will be wrong.

Tokens cover more than the obvious palette: panel steps, shadows, the code
block and map-label surfaces, the OBS preview mock, the SVG edge strokes, the
overlay opacities, and the blend mode the cursor glow uses (`screen` on dark,
`multiply` on light — on paper the light pools colour rather than adding it).

The `--fx-*` entries are space-separated RGB triplets so one value serves both
`rgb(var(--fx-c1) / 20%)` in CSS and `getComputedStyle` in the canvas engine.

Resolution order, and why it is split:

1. An inline script in `<head>` reads `localStorage` (falling back to
   `prefers-color-scheme`) and sets `data-theme` **before the first paint**. It
   is inline and tiny on purpose — deferring it to `app.js` would show a dark
   flash to light-theme visitors.
2. `initTheme()` in `app.js` wires the header toggle, persists the choice, and
   keeps following the OS preference for as long as nothing is stored.
3. On every change it re-reads the palettes that JS caches (the background
   engine's, the travelling light's) and fires a `worxbend:theme` event.

Map edges, arrowheads, packets and labels are coloured by CSS class rather than
by JS-written attributes, so a theme swap costs no repaint pass at all.

## Motion

There is no animation library. Everything is CSS transitions, a few small rAF
loops, and one canvas.

### The background engine

`assets/bg.js` is standalone: it owns one fullscreen canvas inside
`#background-canvas` and knows nothing about the site's markup. It draws a
particle network — nodes drift on a low-frequency noise field, connect to their
neighbours into springs, and light up as the cursor drags energy through the
mesh.

| System | What it does |
| ------ | ------------ |
| Configuration | every tunable in one object — density, damping, connection distance, spring stiffness, attraction radius and strength, energy gain and decay, vibration, glow, speed |
| ParticleSystem | position, velocity, acceleration, radius, mass and energy as flat typed arrays, allocated once |
| SpatialHash | uniform grid + counting sort; neighbour search is O(n), never O(n²) |
| PhysicsSystem | integrate, damp, add noise wind, push back from the edges with a soft force rather than a bounce |
| ConnectionSystem | rebuilds the edge list each frame, capped per particle |
| SpringSystem | Hooke's law along each edge plus a damper on the closing speed, so strings vibrate and then settle |
| InteractionSystem | inverse-square cursor attraction, clamped, with a tangential share so particles orbit instead of collapsing; clicks fire an expanding ripple |
| EnergySystem | the cursor charges what it passes over; energy flows along edges to neighbours and decays exponentially |
| Renderer | Canvas2D by default, WebGL via PixiJS when the machine is willing |
| AnimationLoop | rAF, paused while the tab is hidden |

Energy drives everything visual: colour (idle → interaction → high), glow
radius, core size, line brightness, and how hard each string vibrates — edges
above a threshold are drawn as quadratic Béziers whose control point rides a
sine wave.

**Nothing inside the frame loop allocates.** Arrays are sized at start and
reused; edges, brightness buckets and the glow sprites are all pooled.

Density scales with viewport area (one particle per ~8600px², clamped to
60–340), so a phone gets a sparse mesh and a desktop a full one. If frame times
stay long the loop sheds particles, shrinks the glow and drops to 1× pixel
ratio rather than dropping frames.

Rendering starts on Canvas2D immediately — small, no dependency — and swaps to
the GPU renderer once PixiJS has loaded, carrying the running simulation across.
Each step is optional: no `bg.js`, no background; no PixiJS, Canvas2D keeps
going; no WebGL at all, same. `<html>` carries `fx-live` and `fx-webgl` as
state hooks so you can see which path a browser took from the console.

### The travelling light

A single moving light source washes over the background, every widget and the
page chrome. `initSpotlight()` in `app.js` keeps three followers chasing the
pointer at different damping rates and publishes them as custom properties on
`:root` — `--pt-x/y` (quick), `--pt2-*`, `--pt3-*` (slowest), plus a palette that
cycles as the pointer travels. **Nothing reads the raw cursor position**: the lag
*is* the effect.

Two consumers share those properties:

- `.glow-cursor` — three soft discs over the whole page. Each is a solid colour
  behind a radial mask and is moved with `translate3d`, so following the pointer
  is a composite rather than a repaint.
- `[data-spot]` widgets — cards, panels, the map and its nodes, command boxes.
  `app.js` hit-tests the *lagging* point once per frame and lights only the
  widget under it, giving that one a surface sheen (`::after`) and an edge
  hairline (`.lit-edge`).

The background engine deliberately does **not** read these — the mesh attracts
to the real cursor, not the lagging one, or grabbing a particle would feel
rubbery. The two effects stay coherent because both draw from the same `--fx-*`
theme tokens.

Colour writes repaint, so they are throttled to ~12Hz; the palette drifts far
slower than the pointer moves and the difference is invisible. If frame times
stay long while the pointer is moving, a watchdog adds `fx-lite` to `<html>`,
which sheds the grain and the widest disc.

### Reveals

`data-reveal` on a `.reveal` element picks its entrance — `up`, `left`, `right`,
`scale`, `wipe`, `stagger`, `stagger-self`. The hero headline is split into
per-word boxes that slide up from behind their own clipping.

> [!NOTE]
> The `wipe` variant uses `mask-size`, not `clip-path`. An element clipped to
> zero area reads as *not intersecting*, so IntersectionObserver never fires and
> the heading stays hidden forever.

Three safety nets guarantee content is never stranded invisible: the effect is
gated behind a `has-js` class, a 2.5s timer reveals anything already on screen,
and a post-scroll sweep catches elements a hard flick carried past the observer
between samples.

### Reduced motion and touch

`prefers-reduced-motion: reduce` turns all of it off — reveals resolve to
visible, counters jump to their final value, the terminal renders as a finished
transcript, the carousel stops auto-advancing (its dots still work), and the
background engine, grain, boot sweep and travelling light are never started —
the engine's host element is removed outright rather than left idling.

Touch-only devices skip the pointer effects; there is no pointer to trail. The
check is `(pointer: coarse)` **and** not `(any-hover: hover)` — `(hover: none)`
alone is also true wherever no input device is attached yet, and would disable
the effects on machines that should have them.

## Editing content

Tool copy, chips and links live in the `DATA` object at the top of `assets/app.js`.
Map geometry is `GEO` (node boxes) and `EDGES` (connector paths) just below it —
node anchor coordinates in the edge list are hand-tuned to the boxes, so if you move
a node, update the matching edge endpoints. The stage is 1040x720; the zone
rectangles and labels are absolutely positioned in `index.html` in the same
coordinate space and have to move with it.

The layout has one load-bearing property: OBS sits high on the right, which
keeps the whole band beneath it clear. Every workstation-to-destination edge
(`msm`, `twi`, `yc`) runs through that band, so none of them has to cross the
rig. Move OBS down and those three edges start cutting through it.

## Notes

- Fonts (Space Grotesk, JetBrains Mono) load from Google Fonts.
- Map nodes are real `<button>`s, so keyboard and screen-reader navigation work.
- `assets/vendor/pixi.min.js` is a vendored build, not edited by hand. It is
  committed rather than pulled from a CDN so the site has no third-party runtime
  dependency and works offline. Refresh it with the command in its own header:

  ```sh
  curl -fsSL -o assets/vendor/pixi.min.js \
    https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/dist/pixi.min.js
  ```

  It exposes the global `PIXI`; `assets/bg.js` expects nothing else from it.
