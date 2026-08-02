# worxbend — streaming tools map

Landing page for the worxbend OBS Studio / Twitch tooling: an interactive map of how
`scenedeck`, `obsctl-rs`, `obsctl`, `obs-stats` and `twi` talk to a remote OBS over
obs-websocket 5.x.

Implemented from the Claude Design source `Worxbend Streaming Tools.dc.html`.

## Stack

None. It is a static site — plain HTML, CSS and one vanilla JS file. No build step,
no framework, no bundler. The design source used the Claude Design `dc-runtime`
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
index.html          markup and copy
assets/styles.css   design tokens + all styling
assets/app.js       tool data, map graph, carousel, background canvas
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
| `scenedeck` | Snap Store | strict-confinement snap |
| `scenedeck` | GitHub release binary | for people who do not use snap |

Every `curl` uses `-fsSL`. The `L` matters: the release-asset URLs answer `302`,
so a command without `-L` pipes a redirect body into `sh` and silently does
nothing.

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
| The idea | markup; 5-panel carousel auto-advances every 3.2s, pauses on hover |
| The toolkit | rendered from `DATA` + `CARD_META` (per-card accent, blurb, features) |
| The map + detail | rendered from `DATA` + `GEO` + `EDGES` |
| In the terminal | `DEMO` transcript, typed character by character on a loop |
| Quick start | markup; commands taken from the obsctl-rs README |
| Why terminal-first, Questions | markup (`<details>` for the FAQ) |

## Motion

Everything is CSS transitions plus a little JS; there is no animation library.

- Scroll-reveal, the scroll-progress bar, active-section nav highlighting,
  back-to-top, stat counters, the typing demo and the background icosphere.
- The reveal effect is gated behind a `has-js` class added by `app.js`, so with
  scripting unavailable the content is simply visible rather than stuck at
  `opacity: 0`.
- `prefers-reduced-motion: reduce` turns all of it off: reveals resolve to
  visible, counters jump to their final value, the terminal renders as a finished
  transcript, and the carousel stops auto-advancing (its dots still work).

## Editing content

Tool copy, chips and links live in the `DATA` object at the top of `assets/app.js`.
Map geometry is `GEO` (node boxes) and `EDGES` (connector paths) just below it —
node anchor coordinates in the edge list are hand-tuned to the boxes, so if you move
a node, update the matching edge endpoints.

## Notes

- Fonts (Space Grotesk, JetBrains Mono) load from Google Fonts.
- `prefers-reduced-motion` disables the dash flow, the sphere rotation and the
  carousel auto-advance; the dots still work manually.
- Map nodes are real `<button>`s, so keyboard and screen-reader navigation work.
