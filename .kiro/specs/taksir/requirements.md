# Taksir — Requirements

> Kiroween 2026 · Devpost category: Frankenstein
> App: price estimator + listing generator + storefront for small
> second-hand sellers (starting with laptops). Indonesian UI, English specs.
> Stack: plain JavaScript SPA, no build step, no framework.
> Source of truth for behaviour: this file. `design.md` explains *how*;
> `tasks.md` is the implementation checklist.

## Honesty rules (apply to every requirement below)

- **H-1 — Rule-based, not ML.** The pricing engine is a transparent
  rule-based scoring model over a reference comparables dataset. The system
  SHALL NEVER claim ML/AI vision, live market scraping, or a "real-time
  market price" anywhere in UI, copy, README, or generated listings.
- **H-2 — Estimate labelling.** Every estimate shown SHALL be labelled
  (Indonesian) "Taksiran dari data referensi" (estimate from reference
  data), with the price breakdown visible next to it.
- **H-3 — Sample data labelling.** `data/comparables.json` is seeded
  SAMPLE data (~14 plausible listings). The file SHALL carry a `_meta`
  label stating it is sample data, and the UI SHALL show a "Data contoh —
  bisa diganti" (sample data — replaceable) notice where comparables appear.
- **H-4 — No invented facts.** Generated listing text SHALL contain only
  fields the seller entered plus the estimate range. It SHALL NOT invent
  specs, condition claims, or guarantees.

---

## Functional requirements

### REQ-1 — Photo upload + condition form

- **REQ-1.1** When the seller opens the "Tambah Barang" view, the system
  SHALL present a form with fields: photo (optional, from device),
  brand, model, CPU, RAM (GB), storage size (GB) + type (SSD/HDD),
  screen size (inch), battery health (%), cosmetic condition
  (like-new / good / fair / poor), accessories (multi-select:
  charger, bag, mouse, original box), age (years), and notes.
- **REQ-1.2** When the seller submits the form with missing required
  fields (brand, model, RAM, storage, cosmetic condition), the system
  SHALL show an inline error per missing field and SHALL NOT save the item.
- **REQ-1.3** When a photo is chosen, the system SHALL show a preview
  thumbnail before saving, and SHALL store the photo locally
  (downscaled data URL, max ~1200 px wide) so the item works offline.
- **Acceptance:** filling the form with valid data saves an item and
  navigates to its estimate; missing brand blocks saving with a visible error.

### REQ-2 — Price estimate with transparent breakdown + comparables

- **REQ-2.1** When an item is saved or viewed, the system SHALL compute
  an estimate using `src/pricing.js` over `data/comparables.json` and
  SHALL display: estimate (rounded to Rp 50.000), a low–high range
  (±10%), and the label from H-2.
- **REQ-2.2** When the estimate is displayed, the system SHALL show the
  full breakdown: base price (median of matched comparables, with the
  source stated) and every adjustment with its label, percent, IDR amount,
  and reason (see `design.md` § Pricing engine).
- **REQ-2.3** When the estimate is displayed, the system SHALL show the
  top 5 matched comparables beside it (brand, model, key specs, price,
  match score), plus the H-3 sample-data notice.
- **REQ-2.4** When no comparable matches well enough (best match score
  < 30) or the dataset is empty, the system SHALL still show an estimate
  from the fallback median and SHALL state which fallback was used.
- **Acceptance:** estimate for a ThinkPad T480 / i5 / 8 GB / 256 GB SSD /
  good / 5 years is Rp 5.600.000 (range Rp 5.050.000–6.150.000, pinned
  in `tests/pricing.test.js` against the seeded dataset) with a visible
  breakdown whose adjustments sum to the shown total; comparables list
  shows 5 rows.

### REQ-3 — Listing text generator (Indonesian + English)

- **REQ-3.1** When the seller opens an item's listing view, the system
  SHALL generate listing text in Indonesian AND in English from the
  item's fields plus the estimate (see `generateListing` in `design.md`).
- **REQ-3.2** When listing text is shown, the system SHALL provide a
  one-tap "Salin" (copy) button per language that copies the exact text
  to the clipboard and confirms with a toast.
- **REQ-3.3** Generated text SHALL obey H-4 (no invented facts) and
  SHALL label the price as a "taksiran" (estimate).
- **Acceptance:** both ID and EN texts render, contain the entered specs
  and the estimate, contain no spec the seller did not enter; copy works.

### REQ-4 — Public storefront view per seller

- **REQ-4.1** When the seller opens the "Toko Saya" view, the system
  SHALL show their storefront: store name, seller name, city, WhatsApp
  number (if set), and a grid of their available items with photo,
  title, and estimate.
- **REQ-4.2** When a buyer opens a storefront link (`#/toko/<seller-id>`),
  the system SHALL render the same storefront read-only (no edit/delete
  controls visible).
- **REQ-4.3** When an item is marked sold, the system SHALL hide it from
  the storefront grid (or show it greyed as "Terjual") and SHALL NOT
  include it in the available count.
- **Acceptance:** storefront shows only available items; a sold item
  disappears from the grid; the `#/toko/...` route renders without edit UI.

### REQ-5 — WhatsApp order button

- **REQ-5.1** When an item is viewed (estimate view, listing view, or
  storefront card), the system SHALL show a "Pesan via WhatsApp" button.
- **REQ-5.2** When the button is tapped, the system SHALL open
  `https://wa.me/<number>?text=<prefilled message>` where the message
  contains the item title, estimate, and a greeting in Indonesian.
- **REQ-5.3** When the seller has not set a WhatsApp number, the system
  SHALL prompt them to set it in seller settings instead of opening a
  broken link.
- **Acceptance:** button opens a wa.me URL whose text includes the item
  title and price; missing number shows the settings prompt.

### REQ-6 — Inventory CRUD

- **REQ-6.1** When the seller opens the home view, the system SHALL list
  all their items with photo, title, estimate, and status
  (available / sold).
- **REQ-6.2** The seller SHALL be able to add, edit, delete, and mark
  an item sold / back to available, with a confirmation step before
  delete.
- **REQ-6.3** When any inventory change happens, the system SHALL persist
  it locally immediately (see REQ-7) and SHALL update every view that
  lists the item.
- **Acceptance:** add → edit → mark sold → mark available → delete all
  work and survive a page reload.

### REQ-7 — Offline-first PWA

- **REQ-7.1** The system SHALL persist items and seller settings in
  localStorage (with IndexedDB as the photo store if localStorage size
  becomes a problem — see `design.md`), so all features work with no
  network after first load.
- **REQ-7.2** The system SHALL ship a `manifest.json` (name, icons,
  display standalone) and a service worker (`sw.js`) that caches the
  app shell cache-first, so the app loads offline and is installable.
- **REQ-7.3** When the app is offline, the system SHALL show a small
  "Offline — data tersimpan di perangkat" indicator and SHALL NOT block
  any local feature.
- **Acceptance:** after first load, disabling the network and reloading
  still shows the app, items, and estimates; manifest + SW register
  without errors.

### REQ-8 — Seller settings

- **REQ-8.1** The system SHALL provide a settings form for: store name,
  seller name, city, WhatsApp number (digits only, validated).
- **REQ-8.2** When settings are saved, the system SHALL persist them
  locally and SHALL use them in the storefront and WhatsApp messages.
- **Acceptance:** saving settings updates the storefront header and the
  wa.me number.

## Non-functional requirements

- **NFR-1 — No build step.** The app SHALL run by opening `index.html`
  through any static server (`npx serve`, `python3 -m http.server`).
  No bundler, no framework, no npm install required to run.
- **NFR-2 — Mobile-first.** Layout SHALL be usable on a 360 px wide
  phone screen; tap targets ≥ 44 px; forms usable one-handed.
- **NFR-3 — Performance.** First paint of the app shell SHALL be
  < 1 s on a local server; estimate computation SHALL be < 50 ms for
  the seeded dataset.
- **NFR-4 — Testability.** The pricing engine SHALL live in
  `src/pricing.js` as pure functions importable by both the browser
  (ES module) and Node tests, with no DOM or network access.
- **NFR-5 — Accessibility.** Forms SHALL use `<label>` per field,
  images SHALL have `alt` text, colour SHALL NOT be the only signal
  for status (sold items also carry text).
