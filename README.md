# dariustan

Personal index for Darius Clay Tan Yi. One page, one fixed grid, no build step.

## Files

- `index.html` - all content, mirrored around a centre column on one grid
- `styles.css` - grid, hairlines, paper grain (generated SVG noise), responsive stacking
- `main.js` - crosshair cursor and hover/focus tracking box
- `assets/mark.svg` - the centre mark
- `assets/fonts/` - Geist and DM Mono, self-hosted (both SIL Open Font License)

## Swap in Urchi

Replace `assets/mark.svg` with Urchi as a one-colour silhouette (SVG, or a PNG with
transparency, renamed in `styles.css` under `.mark`). The CSS uses it as a mask, so the
ink colour and grain apply automatically. The cell is sized for roughly 7:6.

## The rule

If something does not fit in a cell, it gets cut. No new pages, sections or modals.

## Run locally

The mark is loaded as a CSS mask, which needs a server rather than `file://`:

    python3 -m http.server

Deploys to Vercel as a static site with no config.
