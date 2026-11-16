# Taksir — Implementation Tasks

> Work through in order. Each task is small and checkable — tick it off
> only when its acceptance line holds. Specs: `requirements.md` (what),
> `design.md` (how). Do NOT change the pricing formula without updating
> `design.md` §3 AND the pinned test numbers, and record why.
>
> Status at handoff: scaffold only — pricing engine + MCP server are
> COMPLETE and tested; app UI is a working skeleton with stub handlers
> that must be filled in below.

## Phase A — Foundation (scaffold, done — verify, don't redo)

- [x] A1. Repo scaffold: `index.html`, `styles.css`, `app.js`,
  `src/pricing.js`, `data/comparables.json`, `manifest.json`, `sw.js`,
  `README.md`, `.gitignore`, `package.json` (type: module, test script).
- [x] A2. Pricing engine implemented per `design.md` §3
  (`estimatePrice`, `priceBreakdown`, `findComparables`,
  `generateListing`, `formatIDR`, `cpuTier`, `median`).
- [x] A3. Seeded `data/comparables.json` — 14 sample rows, `_meta`
  sample-data label.
- [x] A4. MCP server (`.kiro/mcp-server/server.js`) + `mcp.json`,
  smoke-tested (see `MCP_SMOKE_TEST.md` in repo root).
- [x] A5. `node --check` passes on all JS; `npm test` passes.

## Phase B — App wiring (the main work)

- [x] B1. **Storage layer** (`app.js`): implement `loadItems()`,
  `saveItems()`, `loadSeller()`, `saveSeller()` on the
  `taksir.items.v1` / `taksir.seller.v1` keys (design.md §4).
  Handle corrupt JSON (reset to empty + console warning) and
  localStorage quota errors (save item without photo + warn seller).
  *Acceptance: reload keeps items; corrupt key doesn't crash the app.*
- [x] B2. **Router** (`app.js`): hash routing for all routes in
  design.md §6 (`#/`, `#/tambah`, `#/barang/<id>`,
  `#/barang/<id>/listing`, `#/toko`, `#/toko/<seller-id>`,
  `#/pengaturan`). Show exactly one `<section>` at a time;
  unknown route → home. *Acceptance: every route renders, back/forward works.*
- [x] B3. **Add-item form** (`#view-add`, REQ-1): wire all fields,
  per-field validation errors (brand, model, RAM, storage, cosmetic
  required), photo input with preview + downscale to ≤1200 px
  (canvas), accessories multi-select. On submit: save item, go to
  `#/barang/<id>`. *Acceptance: REQ-1 acceptance criteria pass.*
- [x] B4. **Estimate view** (`#view-estimate`, REQ-2): render estimate,
  low–high range, "Taksiran dari data referensi" label, full breakdown
  table (base + each adjustment with label/percent/IDR/reason), top-5
  comparables with match scores, sample-data notice, low-match warning
  when best score < 30. *Acceptance: REQ-2 acceptance criteria pass;
  worked example in design.md §3.6 reproduces within rounding.*
- [x] B5. **Listing view** (`#view-listing`, REQ-3): render ID + EN
  text from `generateListing`, copy buttons with toast confirmation.
  *Acceptance: REQ-3 acceptance criteria pass.*
- [x] B6. **Inventory list + CRUD** (`#view-home`, REQ-6): render all
  items with status chips; edit (prefill `#view-add`), delete (confirm
  dialog), mark sold / mark available. *Acceptance: REQ-6 acceptance
  criteria pass.*
- [x] B7. **Storefront** (`#view-storefront`, REQ-4): seller header +
  available-items grid; `#/toko/<seller-id>` renders read-only
  (no edit/delete buttons); sold items hidden. *Acceptance: REQ-4
  acceptance criteria pass.*
- [x] B8. **WhatsApp button** (REQ-5): `wa.me/<number>?text=...`
  with item title + estimate; missing number → settings prompt.
  Place on estimate view, listing view, storefront cards.
  *Acceptance: REQ-5 acceptance criteria pass.*
- [x] B9. **Seller settings** (`#view-settings`, REQ-8): store name,
  seller name, city, WhatsApp number (digits-only validation).
  Persist + reflect in storefront header and wa.me links.
  *Acceptance: REQ-8 acceptance criteria pass.*
- [x] B10. **PWA finish** (REQ-7): register `sw.js`, verify offline
  reload works, offline banner via `online`/`offline` events,
  real 192/512 px icons (replace SVG placeholders in `manifest.json`).
  *Acceptance: REQ-7 acceptance criteria pass; Lighthouse PWA
  checks pass or failures are listed with reasons.*
- [x] B11. **Polish**: empty states (no items yet, no photo),
  toast system, confirm dialog, loading state while comparables
  load, responsive check at 360 px, accessibility pass (labels,
  alt text, status not colour-only — NFR-5).

## Phase C — Tests, honesty audit, verification

- [x] C1. **Expand tests** (`tests/pricing.test.js`): add property-style
  tests — estimate always within [low, high]; better cosmetic never
  lowers the estimate (all else equal); more RAM never lowers it;
  adjustments sum to `totalPercent`; `findComparables` returns best
  match first; `generateListing` contains only entered fields.
  Run `npm test` — all green.
- [x] C2. **Honesty audit** (use `.kiro/agents/pricing-reviewer.md`):
  grep the whole repo for forbidden claims ("AI", "machine learning",
  "real-time", "harga pasar", "live market") — every hit must be a
  denial ("bukan AI…") or be removed. Verify the estimate label,
  sample-data notice, and breakdown appear on every screen that
  shows a price.
- [x] C3. **Full manual verification**: run through every acceptance
  criterion in `requirements.md` on a local static server, offline
  reload included; record results in `VERIFICATION.md`
  (pass/fail per REQ + screenshots or notes).
- [ ] C4. **Demo video** (< 3 min, for Devpost): record the flow
  add item → estimate + breakdown → listing copy → storefront →
  WhatsApp button, with a voiceover or captions in Indonesian/English;
  save as `demo.mp4` (git-ignored) and upload to YouTube (unlisted).
- [ ] C5. **Devpost submission**: public repo pushed, README + demo
  video link + description filled in on Devpost; submit before
  4 Dec 2026 14:00 PT (5 Dec 05:00 WIB). Needs the user's Devpost
  account (bambagsugiono1208) — do NOT submit from any other account.

## Post-scaffold (only if time remains)

- [ ] P1. IndexedDB photo store (replace data-URL-in-localStorage
  when quota becomes a problem).
- [ ] P2. Seller-editable comparables UI (edit/replace rows, stored
  under `taksir.comparables.v1`).
- [ ] P3. More categories (phones, cameras) — new spec first, then code.
