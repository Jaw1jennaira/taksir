# I refused to call my pricing tool "AI" — and it made the product better

*Building Taksir for Kiroween 2026: a transparent price estimator,
listing generator, and storefront for second-hand laptop sellers in
Indonesia. Live at https://jaw1jennaira.github.io/taksir/ — repo:
https://github.com/Jaw1jennaira/taksir*

## The problem

Millions of small second-hand sellers in Indonesia price laptops by gut
feeling — or by copying a random listing. Overprice and the laptop never
sells; underprice and the seller loses money they cannot afford to lose.
The hardest question in the trade is simple: *berapa harga yang wajar?*
— what is a fair price?

I built Taksir to answer it. The Frankenstein part: it stitches together
four things that don't usually live in one app — a pricing tool, a
listing generator, a storefront, and offline-first inventory — into one
tool a seller can open on a cheap phone, with no account and no
connection.

## The decision I almost got wrong

The tempting move was obvious: call the estimator "AI pricing". Every
hackathon project does it. I refused — and that refusal became the
product.

Taksir's engine is a transparent rule-based scoring model over a
reference dataset of comparable listings. It is not machine learning, not
AI vision, not live market scraping. Every estimate in the app says so,
in Indonesian: *"Taksiran dari data referensi"* — estimate from reference
data — with the full breakdown visible: base price from the closest
comparables, then one adjustment per factor (CPU, RAM, storage, battery,
condition, age, accessories), each with its percentage and its reason,
plus the five matched listings it was compared against.

A black-box price is a price a seller cannot argue with. A wrong price
costs a real seller real money. Showing the math turned out to be the
better product decision — and, I think, the more interesting engineering
one. The hard part isn't the model; it's making the model legible.

## How it was built: spec-first, with Kiro

I built Taksir spec-first. Before any app code, I wrote
`.kiro/specs/taksir/`: requirements in EARS style with acceptance
criteria, a design doc with the full pricing formula (weights, caps, and
a worked example), and a numbered task list that the implementation
followed in order. Steering files (product, tech, structure) kept every
later decision aligned; hooks run the tests and an honesty grep on every
save; a zero-dependency MCP server wraps the exact same pricing module
the app uses, so an agent's estimate can never drift from the app's
estimate; and a custom `pricing-reviewer` agent audited fairness and
copy before release.

The stack is deliberately boring: plain JavaScript, no framework, no
build step. The pricing engine is one ES module of pure functions,
shared by the app, the tests, and the MCP server — one source of truth.

## Property-based tests caught two real bugs

Unit tests told me the engine worked on the cases I thought of.
Property-based tests (fast-check, 10 properties) told me about the ones
I didn't:

1. **Monotonicity failure.** The first matcher let adjustment-priced
   fields (RAM, cosmetic condition, CPU tier) pick the reference set.
   Brute force over 4,000 random items showed a 16 GB laptop priced
   *below* an identical 12 GB one in ~40% of cases. Fix: matching is now
   identity-only (brand + model + storage type). The pinned test case
   (ThinkPad T480 → Rp 5.600.000) didn't change at all.
2. **Adjustment collapse.** Raw adjustment sums could reach −97% on
   absurd inputs, collapsing the estimate to ~3% of base. Fix: total
   adjustments clamp at ±50%, shown as its own breakdown row.

The same suite fails 5/10 against the original engine and passes 10/10
against the fixed one. That is the whole argument for property-based
testing, in one sentence.

## What it does, end to end

Upload a photo, fill in the condition, get the estimate with its
breakdown and comparables. One tap generates the listing text in
Indonesian and English, ready to paste to Facebook, WhatsApp, or
Marketplace. Save it to inventory, open your public storefront, and a
buyer taps the WhatsApp button — prefilled with the item and its
estimated price. All offline after the first load.

Try it: Lenovo ThinkPad T480, i5-8350U, 8 GB RAM, 256 GB SSD, battery
82%, good condition, with charger → Rp 5.600.000 (range Rp 5.050.000–
6.150.000).

## What's next

Seller-imported comparables (CSV or pasted listings), more categories
beyond laptops, and a printable price-card with a QR code to the
storefront for physical shops.

*Built for Kiroween 2026 (Frankenstein category). The demo video is 67
seconds; the repo contains the full spec, the MCP server, the tests, and
the verification record.*
