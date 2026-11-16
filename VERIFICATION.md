# Taksir — Verification Record (Phase 2, C3)

Date: 16 Nov 2026. Verified by the Phase 2 implementation agent.
Method: automated headless-browser walkthrough (Playwright, Chromium,
fresh temp profile — never the user's browser profiles) against a local
static server (`python3 -m http.server 8123`), plus `npm test`.
Script: `/tmp/taksir-probe/verify_taksir.py` (scratch, not in repo).
Screenshots: `verification/*.png`. Machine results: `verification/results.json`.

**Result: 35/35 browser checks passed, 0 console errors / page errors.
`npm test`: 24/24 passed (14 unit + 10 property tests).**

## Main flow walked end-to-end (real browser)

Settings (Toko Laptop Yusmara / YUSMARA / Tasikmalaya / WA
6285111215414) → add ThinkPad T480 (i5-8350U, 8 GB, 256 GB SSD, 14",
battery 82%, good, 5 y, charger, 2000×1500 test photo) → estimate
**Rp 5.600.000** (range Rp 5.050.000–6.150.000) → ID + EN listing →
copy (toast) → home CRUD (edit prefill, mark sold / available, delete)
→ storefront (own + public) → offline reload → 360 px layout.

## Per-requirement results

| REQ | Result | Evidence |
|---|---|---|
| REQ-1 photo + condition form | PASS | Photo preview downscaled 2000px → 1200px wide; empty form blocked with visible brand error and no save; all fields present |
| REQ-2 estimate + breakdown + comparables | PASS | Pinned T480 = Rp 5.600.000, range 5.050.000–6.150.000; breakdown 6 rows (base + 4 adjustments + total); 5 comparables; "Taksiran dari data referensi" label; sample-data notice; honesty note |
| REQ-2.4 fallback | PASS (code + unit) | Fallback note renders per `baseSource` (same-brand / global / no-data); empty-dataset unit test returns estimate 0 + note |
| REQ-3 listing ID + EN | PASS | Both texts contain price + entered specs + "taksiran"/"estimate"; copy button shows "disalin" toast |
| REQ-4 storefront | PASS | Header shows store name/seller/city; sold item hidden from grid (empty state shown); available again → item returns |
| REQ-4.2 public `#/toko/<id>` | PASS | Renders without edit/delete controls (no `[data-action]`, no "Ubah"/"Hapus") |
| REQ-5 WhatsApp button | PASS | `wa.me/6285111215414?text=Halo! Saya mau tanya soal Lenovo ThinkPad T480 (Rp 5.600.000 — taksiran)…` on estimate, listing, and storefront cards |
| REQ-5.3 missing number | PASS (code) | No-WA state links to `#/pengaturan` ("Atur nomor WhatsApp dulu" / "Atur nomor WhatsApp") — not exercised in the browser run because settings were filled first |
| REQ-6 inventory CRUD | PASS | Add → edit (prefill verified) → mark sold → mark available → delete (confirm dialog) → empty state; all survive reload (localStorage) |
| REQ-7 offline-first PWA | PASS | SW registered; `context.set_offline(True)` + reload: shell, saved inventory, and estimate (Rp 5.600.000) all load |
| REQ-8 seller settings | PASS | Save shows toast; storefront header + wa.me number updated |
| NFR-2 360 px | PASS | `scrollWidth` = 360, no horizontal overflow; tap targets ≥ 44 px (CSS) |
| NFR-5 accessibility | PASS (manual) | `<label>` per field, alt text on photos, status as text chip ("Tersedia"/"Terjual"), not colour-only |

## Screenshots

- `01-home-empty.png` — empty home + empty state
- `02-settings.png` — seller settings filled
- `03-add-form.png` — add form with photo preview
- `04-estimate.png` — estimate Rp 5.600.000 + range + label
- `05-listing.png` — ID + EN listing text
- `06-home-with-item.png` — inventory card with CRUD buttons
- `07-storefront-sold-hidden.png` — storefront after mark-sold (empty)
- `08-storefront.png` — storefront with available item + WA button
- `09-offline.png` — app reloaded with network off
- `10-mobile-360.png` — add form at 360 px width

## What the property tests caught (C1, honest report)

Running the new fast-check suite against the ORIGINAL (Phase 1)
engine failed 5/10 properties; against the fixed engine 10/10 pass.
Two real bugs were found and fixed (details in
`tests/pricing.pbt.test.js` header + `design.md` §3.2/§3.5):

1. **Monotonicity failure (matching bug).** Old matching let
   adjustment-priced fields (RAM, cosmetic, CPU tier) pick the
   reference set. Brute force over 4.000 random items: RAM violations
   in ~40% of items (T480: 16 GB → Rp 5.700.000 vs 12 GB →
   Rp 5.850.000), cosmetic ~25%, CPU ~5%. Fix: matching is now
   identity-only (brand + model + storage type, max score 70). Pinned
   T480 numbers unchanged (estimate, base, total, top-5 set).
2. **Total-adjustment collapse.** Raw adjustment sums could reach
   −97% (absurd input), collapsing the estimate to ~3% of base. Fix:
   total clamped to ±50%, shown as its own breakdown row ("Batas
   total penyesuaian").
3. **Rounding (not a bug).** Exact "Σ adjustment IDR == estimate −
   base" is false by design: the estimate rounds to the nearest
   Rp 50.000 (disclosed). Property asserts equality within ±Rp 25.000
   + Rp 1 per row.

## Honesty audit (C2, per `.kiro/agents/pricing-reviewer.md`)

- Grep for AI / machine learning / ML / real-time / live market /
  harga pasar / computer vision / scraping / bergaransi / pasti laku:
  every hit is a denial ("bukan AI…", "NOT machine learning", "not
  live market prices") or a spec/reviewer instruction or a test's
  negative assertion. No claim to fix.
- Fixes made during the audit: (a) home inventory cards now carry
  the "Taksiran dari data referensi" label under the price (they were
  bare numbers); (b) unknown-CPU fallback to tier 3 is now stated in
  the breakdown reason and in the settings explainer.
- Fairness: determinism (PBT), caps (each adjustment ±30%, total
  ±50%), edge cases (battery 0%, age 0, RAM/storage extremes, empty
  dataset → estimate 0 + note) all covered by tests; worked example
  in `design.md` §3.6 still reproduces (pinned test green).

## Known gaps / not verified here

- **Lighthouse PWA audit not run** (no Lighthouse in this VM);
  manifest has real 192/512 px PNG icons, SW registers, offline
  reload verified in Chromium — the installability checks Lighthouse
  would add (e.g. maskable icon, screenshots) are still open.
- **REQ-5.3 missing-number path** verified by code reading only (see
  table); the browser run filled the WA number first.
- **`#/toko/<seller-id>` public route** renders the local device's
  own items (single-device app, no backend) — read-only UI verified,
  but there is no real multi-seller sharing yet.
- **Demo video (C4) and Devpost submission (C5)** are NOT this
  phase — a later agent does deploy + video + submit.
- **P1 IndexedDB photo store** (post-scaffold) not done; photos live
  as data URLs in localStorage with the quota fallback (save without
  photo + warn).
