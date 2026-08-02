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

### Custom domain

`CNAME` contains `obs.worxbend.com` and is copied into the published artifact,
so Pages picks the domain up on deploy.

It lives at the repo root because Pages here is served from an Actions artifact
whose root is the site root. `docs/CNAME` is only correct for the other Pages
mode — *deploy from a branch* with the `/docs` folder as source.

DNS for a subdomain needs a `CNAME` record:

```
obs.worxbend.com.   CNAME   worxbend.github.io.
```

Then tick **Enforce HTTPS** in Settings → Pages once the certificate is issued.

> A custom domain can be claimed by only one repository at a time. If another
> `worxbend` repo currently serves `obs.worxbend.com`, remove it there first —
> GitHub will otherwise reject the domain on this repo.

### Serving both places at once

Netlify and Pages can both deploy from this repo simultaneously; they are
independent. The `CNAME` file is inert on Netlify (it is just a static file, and
Netlify domains are configured in its own UI), so nothing conflicts.

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
