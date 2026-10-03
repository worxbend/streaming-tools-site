# worxbend — streaming tools

A lightweight, accessible directory of seven open-source streaming tools. Explore how OBS Studio, Twitch and YouTube fit together, find a tool by purpose, and copy its installation command.

**Live:** https://worxbend.github.io/streaming-tools-site/

## Develop

Node.js 22 or newer is required for development tooling. The website itself is plain HTML, CSS and JavaScript with no runtime packages or external network requests.

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
```

Any static server also works: `python3 -m http.server 8000`. All asset references are relative, including locally hosted fonts, so the site works at a domain root or a GitHub Pages project path.

## Validate and build

```sh
npm run check
npx playwright install --with-deps chromium firefox webkit
npm test
npm run build
```

`check` validates HTML, IDs, local asset paths, anchor destinations and JavaScript syntax. Browser tests exercise the built `_site` output, including tool filtering, map selection, native installation disclosures, theme persistence, keyboard controls, clipboard success/fallback, disabled storage, no-JavaScript content, responsive overflow and accessibility in both themes.

Tests use a dedicated local server on port 4174. Test artifacts stay in the system temporary directory rather than the repository.

## Structure

| File | Responsibility |
| --- | --- |
| `index.html` | Semantic page, complete static tool directory, no-JS documentation links |
| `scenedeck-privacy.html` | Public privacy policy for SceneDeck for Android, linked from the footer |
| `assets/styles.css` | Theme tokens, responsive layouts, focus states, reduced-motion support |
| `assets/data.js` | Verified tool descriptions, categories, source links and exact install commands |
| `assets/app.js` | Progressive enhancements: filters, map selection, copy, preview, theme and menu |
| `assets/fonts/` | Local Inter and JetBrains Mono Latin fonts, with OFL licenses |
| `scripts/` | Static validation, allowlisted production build and local server |
| `tests/` | Playwright interaction, failure-mode and axe accessibility checks |
| `.github/workflows/deploy-pages.yml` | Validate PRs; validate and publish `main` to Pages |

## Content maintenance

There are seven installable tools and three platform records. Stable data keys are `scenedeck`, `obsctl-rs`, `obsctl`, `obs-stats`, `twi`, `yc`, `msm`, `obs`, `twitch` and `youtube`.

When editing a tool, update `assets/data.js` and its matching static `index.html` row. Preserve installer shell requirements: **yc requires Bash**. Install commands are displayed and copied, never executed by the site. Each shell installer has an inspection link; source and release links provide alternatives.

Categories are `control`, `monitor`, `chat` and `live`. Keep `#tool-<id>` links stable: they reveal the appropriate directory entry even when a different filter is active. Native `<details>` keeps documentation reachable without JavaScript.

Facts checked against upstream repositories during the September 2026 redesign:

- SceneDeck is a Rust/GTK4 Linux desktop remote.
- obsctl-rs is a Rust daemon, terminal interface and CLI.
- obsctl is a Crystal daemon, terminal interface and CLI.
- obs-stats is a Rust OBS telemetry dashboard; desktop alerts are Linux-only.
- twi is now written in **Go**.
- yc is a Go YouTube chat client with quota-aware polling.
- multistream-manager prepares platform broadcasts and includes **optional OBS controls**. Preparing a broadcast does not automatically start streaming.

The hero is an explicitly labeled local preview. Scene buttons update example command text; they do not connect to or control OBS. Audio meters are illustrative values, not live telemetry.

## Release

Push to `main` to run the validation workflow. Deployment waits for successful static and browser checks, then publishes an explicit `_site` artifact. Development dependencies, tests, Git metadata and source documentation are excluded.

The repository's existing `CNAME` contains `obs.worxbend.com`, which was served by Netlify at the time of the redesign; GitHub Pages had no custom domain configured. The redesign preserves that file and does not change DNS or Pages domain settings. The guaranteed Pages release URL is the project URL above.

Netlify can also use the included `netlify.toml`: it builds and publishes the same `_site` directory.

## Design and accessibility

The design uses a broadcast-control-room palette, an interactive connection diagram, a filterable editorial directory and a keyboard-operable terminal preview. Light/dark preference is local to the browser. Content remains visible without animation; reduced-motion preferences disable smooth scrolling and transitions. The site makes no analytics, tracking, CDN or API requests at runtime.

Font licenses are included beside the font files. OBS Studio and Twitch SVG marks are sourced from [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0 collection); the marks belong to their respective owners. The toolkit projects carry their own MIT licenses.
