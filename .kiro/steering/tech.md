# Tech — Taksir

## Stack (decided, do not change without recording why)

- **Plain JavaScript SPA, no build step, no framework.** Files at repo
  root: `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`.
- **ES modules** in the browser (`<script type="module">`). The pricing
  engine (`src/pricing.js`) is an ES module importable by the browser
  app, Node tests, and the MCP server alike.
- **Node ≥ 20** for tests (`node:test`, zero test dependencies) and the
  MCP server (zero dependencies, JSON-RPC over stdio).
- **Storage:** localStorage for items + seller settings; photos as
  downscaled data URLs inside the item record (IndexedDB migration is
  a post-scaffold task).
- **PWA:** `manifest.json` + `sw.js` (cache-first app shell).

## Conventions

- **Pricing logic lives ONLY in `src/pricing.js`** as pure functions:
  no DOM, no network, no storage, no `Date.now()` inside the engine.
  Everything else imports it; nothing duplicates its arithmetic.
- **Honesty copy is load-bearing:** never write "AI", "machine
  learning", "real-time", or "harga pasar" as a claim. The estimate is
  always "Taksiran dari data referensi" with the breakdown visible.
- **Indonesian UI copy** (the seller's language). Specs, README, and
  code comments in English. Listing generator outputs both ID and EN.
- **Semantic HTML:** one `<section>` per view with a stable `id`,
  `<label>` for every form field, `alt` text on images, buttons are
  `<button>`, not clickable divs.
- **CSS variables** for the design system (`styles.css` `:root`);
  mobile-first; max-width 720 px container; tap targets ≥ 44 px.
- **IDs:** items `itm-<base36 time><random>`, comparables `cmp-NN`.
- **Money:** integer IDR everywhere; display via `formatIDR()`;
  estimates rounded to the nearest Rp 50.000 (see `design.md` §3.5).
- **Tests:** `npm test`; keep the pricing tests pinned to
  the seeded dataset — if the seed changes, update the pinned
  numbers and record why in the test file, never silently.
- **No secrets, no payments, no wallet, no signing** anywhere in
  this repo. No credentials in code, config, or docs.
