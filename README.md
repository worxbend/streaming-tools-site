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
