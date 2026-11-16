# Taksir — Taksir Harga Laptop Bekas

> Kiroween 2026 · Devpost category: **Frankenstein** — a pricing tool, a
> listing generator, and a storefront stitched into one offline-first
> tool for small second-hand sellers.

Taksir helps small second-hand laptop sellers in Indonesia answer the
hardest question in their trade: *"berapa harga yang wajar untuk barang
ini?"* The seller uploads a photo, fills in the condition, and gets a
price estimate with a **transparent breakdown**, listing text in
Indonesian and English, a public storefront, and a WhatsApp order button.

## Honesty note (read first)

The pricing engine is a **transparent rule-based scoring model** over a
reference comparables dataset. It is **NOT** machine learning, **NOT**
AI vision, and **NOT** live market scraping. Every estimate in the app
is labelled *"Taksiran dari data referensi"* (estimate from reference
data) with the full breakdown visible. The dataset in
`data/comparables.json` is **seeded sample data** (~14 plausible
listings) that the seller can edit or replace. Taksir never claims a
"real-time market price".

## Features

1. Photo upload + condition form (brand, model, CPU, RAM, storage,
   screen, battery health, cosmetic condition, accessories, age)
2. Price estimate with transparent breakdown + matched comparables
3. Listing text generator (Indonesian + English, one-tap copy)
4. Public storefront per seller (`#/toko`)
5. WhatsApp order button (`wa.me` with prefilled message)
6. Inventory CRUD (add / edit / delete / mark sold)
7. Offline-first PWA (localStorage persistence + service worker +
   manifest — works with no network after first load)

## Run locally

No build step, no framework, no install needed — any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000 (or the port shown). ES modules require
`http(s)` — opening `index.html` directly from disk will not load
`app.js` / `src/pricing.js` in most browsers.

## Tests

```bash
npm test        # node:test: 14 unit tests + 10 fast-check property tests
                # (fast-check is a dev-only test dependency; the app
                # itself still runs with no install)
```

## MCP server (for Kiro / agents)

A zero-dependency Node MCP server wraps the same pricing module the
app uses, so agent estimates can never drift from app estimates:

```bash
node .kiro/mcp-server/server.js   # JSON-RPC over stdio
```

Tools: `list_comparables`, `estimate_price`, `get_price_breakdown`.
Registered for Kiro in `.kiro/mcp.json`. Smoke test record:
`MCP_SMOKE_TEST.md`.

## Project layout

- `.kiro/specs/taksir/` — requirements, design, implementation tasks
- `.kiro/steering/` — product vision, tech conventions, repo structure
- `.kiro/hooks/` — run tests + honesty check on save
- `.kiro/agents/pricing-reviewer.md` — custom agent: pricing fairness
  + honesty audit
- `src/pricing.js` — the pricing engine (pure functions, shared by
  app, tests, and MCP server)
- `data/comparables.json` — seeded **sample** reference dataset

## Status

Phase 2 complete (16 Nov 2026): app fully wired (storage, routing,
form + photo downscale, estimate + breakdown + comparables, ID/EN
listing + copy, inventory CRUD, storefront, WhatsApp links, seller
settings, PWA with real 192/512 px icons, offline reload verified in
a real headless browser — 35/35 checks, 0 console errors, see
`VERIFICATION.md`). Tests: 24/24 green, including 10 real
property-based tests with fast-check (`tests/pricing.pbt.test.js`).
Two engine bugs found by the property tests and fixed (matching is
now identity-only so estimates are monotone in every adjustment
field; total adjustments clamp at ±50% with a visible breakdown row)
— see `design.md` §3.2/§3.5 and the PBT file header.

Remaining: demo video (C4) + Devpost submission (C5) — a later agent
does deploy + video + submit. Submit by **4 Dec 2026 14:00 PT**
(5 Dec 05:00 WIB).
