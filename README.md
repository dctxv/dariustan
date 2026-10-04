# dariustan

Personal index for Darius Clay Tan Yi. One page, one fixed grid, no build step.

## Files

- `index.html` - all content, mirrored around a centre column on one grid
- `styles.css` - grid, hairlines, paper grain (generated SVG noise), responsive stacking
- `main.js` - crosshair cursor and hover/focus tracking box
- `urchi.js` - draws Urchi's head into the centre cell
- `assets/urchi-head.js` - Urchi's head, bundled from `urchi-head/`
- `assets/fonts/` - Geist and DM Mono, self-hosted (both SIL Open Font License)

## Urchi

The source lives in `urchi-head/`. The site loads a single bundled file instead, so there is
still no build step on deploy. After changing anything in `urchi-head/`, rebuild it:

    npx esbuild urchi-head/character.ts --bundle --format=esm --target=es2020 --minify --outfile=assets/urchi-head.js

`.vercelignore` keeps `urchi-head/` and this README out of the deployed site.

## The rule

If something does not fit in a cell, it gets cut. No new pages, sections or modals.

## Run locally

The scripts load as modules, which needs a server rather than `file://`:

    python3 -m http.server

Deploys to Vercel as a static site with no config.
