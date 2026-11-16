# Taksir — Devpost Submission Draft (Kiroween 2026)

> STATUS: DRAFT — do not submit yet. YouTube video link (unlisted upload)
> still pending; paste it under "Video" before submitting.
> Submit by **4 Dec 2026 14:00 PT (5 Dec 05:00 WIB)** from Devpost account
> **bambagsugiono1208**. Solo entry.

## Title
Taksir

## Tagline
Transparent price estimates, listings, and a storefront for second-hand sellers — offline-first.

## Category
Frankenstein

## Links
- GitHub repo: https://github.com/Jaw1jennaira/taksir
- Live app: https://jaw1jennaira.github.io/taksir/
- Demo video (<3 min): [PASTE UNLISTED YOUTUBE LINK HERE — file: demo-video.mp4, 67 s, in repo staging dir]

## Inspiration
Millions of small second-hand sellers in Indonesia price laptops by gut
feeling — or by copying a random listing. Overprice and the laptop never
sells; underprice and the seller loses money they cannot afford to lose.
The hardest question in the trade is: *berapa harga yang wajar?* ("what
is a fair price?"). Taksir exists to answer it honestly: a transparent
estimate, the reasoning behind it, and the tools to sell at that price.

## What it does
The seller uploads a photo and fills in the condition (brand, model, CPU,
RAM, storage, screen, battery health, cosmetic condition, accessories,
age). Taksir returns:
1. A price estimate with a **fully transparent breakdown** — base price
   from the closest comparable listings, then one visible adjustment per
   factor (CPU, RAM, storage, battery, condition, age, accessories),
   each with its percentage and reason — plus the 5 matched comparables.
2. One-tap listing text in **Indonesian and English**, ready to
   copy-paste to Facebook, WhatsApp, or Marketplace.
3. A **public storefront** per seller with a WhatsApp order button
   (prefilled message) on every item.
4. Simple **inventory** (add / edit / delete / mark sold), stored on the
   device.
5. **Offline-first PWA** — works with no network after the first load
   (service worker + manifest + localStorage).

Honesty is a feature, not a footnote: the engine is a transparent
rule-based scoring model over a reference dataset. It is NOT machine
learning, NOT AI vision, and NOT live market scraping — and every
estimate in the app says so ("Taksiran dari data referensi" — estimate
from reference data). The dataset is seeded sample data the seller can
edit or replace.

## How we built it
- **Stack:** plain JavaScript SPA — no framework, no build step, no
  install to run. ES modules, semantic HTML, CSS variables,
  mobile-first. `src/pricing.js` holds the pricing engine as pure
  functions shared by the app, the tests, and the MCP server.
- **Kiro, spec-first:** the project was built from `.kiro/specs/taksir/`
  — `requirements.md` (EARS-style requirements + acceptance criteria),
  `design.md` (data model, full pricing formula with weights/caps and a
  worked example, matching logic, storage schema, PWA strategy), and
  `tasks.md` (numbered implementation tasks worked in order).
- **Steering:** `.kiro/steering/` (product, tech, structure) kept every
  implementation decision aligned with the product vision.
- **Hooks:** `.kiro/hooks/` defines run-tests-on-save and an
  honesty-check grep on save (forbidding ML/AI-vision/live-price claims).
- **MCP:** `.kiro/mcp.json` registers a zero-dependency Node MCP server
  (`.kiro/mcp-server/server.js`, JSON-RPC over stdio) exposing
  `list_comparables`, `estimate_price`, `get_price_breakdown` — wrapping
  the exact same pricing module as the app, so agent estimates can never
  drift from app estimates. Smoke-tested (see `MCP_SMOKE_TEST.md`).
- **Custom agent:** `.kiro/agents/pricing-reviewer.md` — a
  pricing-fairness + honesty-of-copy reviewer that audited the app
  before release.
- **Property-based testing:** 10 fast-check property tests
  (`tests/pricing.pbt.test.js`) alongside 14 unit tests — 24/24 green.
  The property tests caught **two real bugs** in the engine: (1) the
  matcher let adjustment-priced fields pick the reference set, breaking
  monotonicity in RAM/cosmetic/CPU (~40% of random items); fixed by
  making matching identity-only (brand + model + storage type). (2) Raw
  adjustment sums could reach −97%; fixed with a ±50% clamp shown as
  its own breakdown row. The same suite fails 5/10 against the original
  engine and passes 10/10 against the fixed one.
- **Verification:** headless-browser walkthrough of the full flow
  (35/35 checks, 0 console errors) including an offline reload —
  recorded in `VERIFICATION.md` with screenshots.

## Challenges we ran into
- **Honesty vs. hype:** the tempting move was to call the estimator
  "AI pricing". We refused — a black-box claim would have been a lie,
  and a wrong price costs a real seller real money. Making the breakdown
  fully visible turned out to be the better product decision anyway.
- **Monotonicity:** the first matcher could price a 16 GB laptop below
  an identical 12 GB one. Property-based testing found it; the fix
  (identity-only matching) is documented in `design.md` §3.2.
- **Offline-first without a framework:** service worker + cache
  versioning by hand, verified with a real offline reload in Chromium.

## Accomplishments that we're proud of
- A complete, working tool for a real audience — not a demo mockup.
- An estimate a seller can argue with: every number is explained.
- Property-based tests that caught real bugs before release.
- The same pricing module powers the app, the tests, and the MCP
  server — one source of truth, zero drift.

## What we learned
- Spec-first (requirements → design → tasks) kept a one-person build
  coherent across three work sessions.
- Property-based tests earn their keep exactly where unit tests go
  quiet: invariants across the whole input space.
- Transparency is a product feature: showing the math builds more trust
  than claiming a smarter black box.

## What's next for Taksir
- Let sellers import their own comparables (CSV / paste a listing URL)
  and share a storefront link that works on any device.
- More categories beyond laptops (phones, cameras) using the same
  transparent engine.
- A printable price-card (QR → storefront) for physical shops.

## Built with
JavaScript, PWA (Service Worker + Web App Manifest), fast-check,
Node.js, Kiro (specs, steering, hooks, MCP, custom agent).

## Try it out
- Live: https://jaw1jennaira.github.io/taksir/
- Repo: https://github.com/Jaw1jennaira/taksir
- Test case to try: Lenovo ThinkPad T480, i5-8350U, 8 GB RAM, 256 GB
  SSD, battery 82%, good condition, with charger → estimate
  Rp 5.600.000 (range Rp 5.050.000–6.150.000).
