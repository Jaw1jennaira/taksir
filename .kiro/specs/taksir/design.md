# Taksir — Design

> Companion to `requirements.md`. This document is the implementation
> contract: file map, data model, pricing formula (full detail),
> matching logic, storage schema, PWA strategy, UI view map.

## 1. Architecture

Plain JavaScript SPA, no build step, no framework (stack decision:
reliability over novelty — the app must run from any static server and
still be demo-able offline on judging day).

```
taksir/
├── index.html            # app shell, all views as <section> elements
├── styles.css            # design system (CSS variables, mobile-first)
├── app.js                # routing, form wiring, view rendering (ES module)
├── manifest.json         # PWA manifest
├── sw.js                 # service worker, cache-first app shell
├── package.json          # { "type": "module", "scripts": { "test": "npm test" } }
├── src/
│   └── pricing.js        # pure pricing engine (browser + Node + MCP share it)
├── data/
│   └── comparables.json  # SEEDED SAMPLE reference dataset (14 rows)
├── tests/
│   └── pricing.test.js   # node:test unit + property-style tests
└── .kiro/
    ├── specs/taksir/     # requirements.md, design.md (this file), tasks.md
    ├── steering/         # product.md, tech.md, structure.md
    ├── hooks/            # run tests on save
    ├── agents/           # pricing-reviewer.md (custom agent)
    ├── mcp.json          # MCP server registration
    └── mcp-server/
        └── server.js     # zero-dep Node MCP server over stdio
```

### Module boundaries

| Module | Knows about | Must NOT know about |
|---|---|---|
| `src/pricing.js` | item + comparables data, arithmetic | DOM, network, storage |
| `app.js` | DOM, routing, storage, pricing (import) | pricing internals |
| `sw.js` | cache names, app-shell file list | app state |
| `.kiro/mcp-server/server.js` | JSON-RPC, pricing (import) | DOM, storage |

## 2. Data model

### Item

```js
{
  id: "itm-<uuid-ish>",          // generated: Date.now().toString(36) + random
  brand: "Lenovo",               // required
  model: "ThinkPad T480",        // required
  cpu: "Core i5-8350U",          // free text; tier derived by cpuTier()
  ramGB: 8,                      // required, number
  storageGB: 256,                // required, number
  storageType: "SSD",            // "SSD" | "HDD"
  screenInch: 14,                // number, optional
  batteryHealth: 82,             // 0–100, optional (default 100 if unknown)
  cosmetic: "good",              // "like-new" | "good" | "fair" | "poor", required
  accessories: ["charger","bag"],// subset of ["charger","bag","mouse","box"]
  ageYears: 5,                   // number, optional (default 3 if unknown)
  notes: "",                     // free text, optional
  photo: "data:image/jpeg;...",  // optional, downscaled ≤1200px wide
  status: "available",           // "available" | "sold"
  sellerName: "", city: "",      // denormalised snapshot at creation (optional)
  createdAt: 1763300000000, updatedAt: 1763300000000
}
```

### Comparable (row in `data/comparables.json`)

Same spec fields as Item, plus:

```js
{ id: "cmp-01", priceIDR: 4500000, city: "Jakarta",
  listedDate: "2026-11-01", source: "sample", cpuTier: 3 }
```

`cpuTier` is precomputed in the file for transparency; the engine
re-derives it from `cpu` via `cpuTier()` when the field is absent.

### Seller settings

```js
{ storeName: "Toko Laptop Yusmara", sellerName: "YUSMARA",
  city: "Tasikmalaya", whatsapp: "6285111215414" }  // digits only, country code
```

## 3. Pricing engine — full formula

Implemented in `src/pricing.js`. Pure functions, no I/O.

### 3.1 CPU tiers (transparent buckets)

| Tier | CPU families |
|---|---|
| 1 | Celeron, Pentium, Atom |
| 2 | Core i3, Ryzen 3 |
| 3 | Core i5, Ryzen 5 |
| 4 | Core i7, Ryzen 7 |
| 5 | Core i9, Ryzen 9, Apple M1–M4 |

Unknown CPU → tier 3 (middle), stated in the breakdown reason.

### 3.2 Matching — `findComparables(item, comparables, limit=5)`

Similarity score 0–100 per comparable:

| Rule | Points |
|---|---|
| Same brand | +40 |
| Same model | +25 |
| CPU tier closeness | +15 − 5 × \|tier diff\| (min 0) |
| RAM closeness | +10 − \|RAM diff in GB\| (min 0) |
| Same storage type | +5 |
| Same cosmetic level | +5 |

Sort descending by score, take top 5. A best score < 30 is flagged
in the UI ("kecocokan rendah — taksiran kurang yakin") but the estimate
still uses the fallback median (REQ-2.4).

### 3.3 Base price

```
base = median(price of top-5 matched comparables)
```

Fallback chain (recorded in `baseSource`, always shown):
1. `matched-median` — median of matched rows (normal case)
2. `same-brand-median` — median of same-brand rows
3. `global-median` — median of the whole dataset
4. `no-data` — empty dataset → estimate 0 + explanatory note

### 3.4 Adjustments (percent of base, each capped)

| Adjustment | Rule | Cap |
|---|---|---|
| CPU | ±6% per tier step vs matched median tier | ±18% |
| RAM | ±4% per 8 GB step vs matched median RAM | ±12% |
| Storage type | SSD vs median HDD +8%; HDD vs median SSD −8% | ±8% |
| Storage size | ±2% per 256 GB step vs matched median size | ±8% |
| Battery health | ≥90%: 0; 80–89%: −5%; 70–79%: −10%; <70%: −15% | −15% |
| Cosmetic | like-new 0; good −5%; fair −12%; poor −20% | −20% |
| Age | −6% per year older than matched median age; +4% per year newer | −30% / +8% |
| Accessories | +2% each (charger, bag, mouse, box) | +6% |

Each adjustment is clamped to ±30% individually as a safety rail.
Screen size does NOT adjust price (shown for transparency; it only
affects matching indirectly via model match).

### 3.5 Final numbers

```
totalPercent = Σ adjustments
estimate     = roundTo50k(base × (1 + totalPercent/100))
low          = roundTo50k(estimate × 0.90)
high         = roundTo50k(estimate × 1.10)
```

`roundTo50k` = round to nearest Rp 50.000 (prices in the Indonesian
second-hand market are quoted in round figures; the rounding itself
is disclosed in the breakdown note).

### 3.6 Worked example

Item: Lenovo ThinkPad T480, Core i5-8350U (tier 3), 8 GB RAM,
256 GB SSD, 14", battery 82%, cosmetic good, 5 years old, accessories
[charger]. Dataset: the 14 seeded rows.

1. Matching: cmp-01 (same brand+model, tier 3, 8 GB, SSD, good) scores
   40+25+15+10+5+5 = 100; cmp-02 (same model, tier 4, 16 GB) ≈ 82;
   cmp-14 (same brand, IdeaPad Slim 3, tier 3, 8 GB) ≈ 70;
   cmp-03 (same brand, X1 Carbon) ≈ 57; cmp-04 (HP EliteBook, tier 3,
   8 GB, SSD, good) ≈ 35 — top 5.
2. Base = median of top-5 prices {4.500.000, 6.200.000, 6.800.000,
   7.800.000, 4.800.000} = **Rp 6.200.000** (`matched-median`).
3. Matched medians: tier 3, RAM 8 GB, storage 512 GB, age 5 years.
4. Adjustments: CPU 0 (tier 3 = median); RAM 0; storage type 0
   (SSD = median); storage size −2% (256 vs 512 GB, one 256 GB step);
   battery −5% (82%); cosmetic −5% (good); age 0; accessories +2%.
   Total = **−10%**.
5. Estimate = roundTo50k(6.200.000 × 0.90) = **Rp 5.600.000**,
   range Rp 5.050.000 – Rp 6.150.000.

(The exact top-5 set depends on the seeded data at runtime; the test
suite pins the estimate for this item at Rp 5.600.000 against the
current seed. If the seed changes, update the pinned numbers, never
the formula, without recording why.)

### 3.7 Listing generator — `generateListing(item, estimate, lang)`

Pure string templating, both languages:
- ID: `DIJUAL — <brand> <model>` + spec line (`•`-separated) +
  `Kelengkapan:` + `Harga: <IDR> (taksiran — nego wajar dipersilakan)` +
  seller/city line + WhatsApp prompt.
- EN: same structure, "FOR SALE", "(estimate — open to reasonable offers)".
- Only seller-entered fields + estimate appear (honesty rule H-4).

## 4. Storage schema

- `localStorage["taksir.items.v1"]` — JSON array of Item objects.
- `localStorage["taksir.seller.v1"]` — JSON Seller object.
- `localStorage["taksir.comparables.v1"]` — optional seller-edited
  override of the dataset (if absent, `data/comparables.json` is
  fetched once and cached in memory; the file remains the default).
- Photos: data URLs inside the Item record (downscaled at upload).
  If localStorage quota errors occur, the app SHALL fall back to
  storing the item without the photo and warn the seller (IndexedDB
  migration is a post-scaffold task, listed in `tasks.md`).

## 5. PWA strategy

- `manifest.json`: name "Taksir — Taksir Harga Laptop Bekas",
  short_name "Taksir", display `standalone`, theme/background
  `#0f766e` (teal — Indonesian marketplace feel), icons: inline
  SVG data-URI placeholders (192 + 512) until a real icon is drawn.
- `sw.js`: cache-first for the app shell
  (`index.html`, `styles.css`, `app.js`, `src/pricing.js`,
  `data/comparables.json`, `manifest.json`); versioned cache name
  `taksir-v1`; network-first fallback for anything else; old caches
  deleted on activate.
- Offline indicator: `navigator.onLine` + `online`/`offline` events
  toggle a banner (REQ-7.3).

## 6. UI view map (hash routing)

| Route | Section id | Purpose |
|---|---|---|
| `#/` | `#view-home` | Inventory list + seller summary + CTA "Tambah Barang" |
| `#/tambah` | `#view-add` | Condition form (REQ-1) |
| `#/barang/<id>` | `#view-estimate` | Estimate + breakdown + comparables (REQ-2) |
| `#/barang/<id>/listing` | `#view-listing` | ID + EN listing text + copy buttons (REQ-3) |
| `#/toko` | `#view-storefront` | Own storefront (REQ-4) |
| `#/toko/<seller-id>` | `#view-storefront` | Public read-only storefront (REQ-4.2) |
| `#/pengaturan` | `#view-settings` | Seller settings (REQ-8) |

Single-page: all sections exist in `index.html`; `app.js` shows one
at a time (`hidden` attribute) and re-renders on `hashchange`.
Header nav: Beranda / Tambah Barang / Toko Saya / Pengaturan.
WhatsApp button (REQ-5) appears on estimate, listing, and storefront
cards. Language: Indonesian UI throughout; EN only inside the
generated EN listing text.

## 7. Design system (styles.css)

- CSS variables: `--brand: #0f766e` (teal), `--brand-dark`,
  `--accent: #f59e0b` (amber CTA), `--bg`, `--surface`, `--text`,
  `--muted`, `--danger`, `--radius`, `--shadow`.
- Mobile-first, max-width 720 px container, cards with soft shadow,
  44 px minimum tap targets, system font stack.
- Breakdown table: monospace-ish numbers, positive adjustments
  green, negative red, base row bold.
- Status: "Tersedia" (green chip) / "Terjual" (grey chip + text, never
  colour alone — NFR-5).
