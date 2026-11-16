// Taksir pricing PROPERTY tests — fast-check (real PBT, not examples).
// Run with: npm test
// These properties are the fairness contract of the estimator:
// a better laptop (more RAM, better condition, healthier battery,
// stronger CPU, bigger storage, younger) must never estimate LOWER
// than a worse one, all else equal.
//
// WHAT THE PBT CAUGHT (16 Nov 2026, Phase 2) — two real bugs:
// 1. MONOTONICITY: with the original matching (brand + model + CPU-tier
//    closeness + RAM closeness + storage type + cosmetic), a brute-force
//    check over 4.000 random items found monotonicity violations in
//    ~40% of items for RAM (e.g. the pinned T480: 16 GB RAM estimated
//    Rp 5.700.000 vs 12 GB at Rp 5.850.000) and ~25% for cosmetic
//    condition. Root cause: fields priced by adjustments also picked
//    the reference set, so the base median moved more than the
//    adjustment. FIX: matching is now identity-only (brand + model +
//    storage type, max score 70) — see design.md §3.2. Pinned T480
//    numbers are unchanged by the fix.
// 2. TOTAL CLAMP: the raw sum of adjustments could reach -97% for
//    absurd inputs (MacBook Pro entered as Celeron / 2 GB / HDD /
//    poor / 12 years), collapsing the estimate to ~3% of base.
//    FIX: total clamped to ±50%, shown as its own breakdown row
//    ("Batas total penyesuaian") — see design.md §3.5.
// 3. ROUNDING: the naive property "Σ adjustment IDR == estimate -
//    base" is FALSE by design, not a bug: the estimate is rounded to
//    the nearest Rp 50.000 (disclosed in design.md §3.5) and each
//    adjustment amount is rounded to the nearest rupiah. The property
//    below therefore asserts equality within that rounding tolerance
//    (±Rp 25.000 + one rupiah per adjustment), and asserts each
//    amountIDR equals round(base * percent / 100) exactly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fc from "fast-check";
import {
  estimatePrice, priceBreakdown, findComparables, generateListing,
  formatIDR,
} from "../src/pricing.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPARABLES = JSON.parse(readFileSync(join(ROOT, "data", "comparables.json"), "utf-8")).comparables;

// Random seller item over the same value space as the form + dataset.
const itemArb = fc.record({
  id: fc.uuid(),
  brand: fc.constantFrom("Lenovo", "HP", "Dell", "Acer", "Asus", "Apple", "Toshiba", "Samsung"),
  model: fc.constantFrom(
    "ThinkPad T480", "ThinkPad X1", "EliteBook 840", "Latitude 5400",
    "Aspire 5", "VivoBook 14", "MacBook Air M1 (2020)", "IdeaPad Slim 3",
    "Pavilion 14", "ZenBook 14", "ThinkPad T490", "ProBook 450",
  ),
  cpu: fc.constantFrom(
    "Core i3-1115G4", "Core i5-8350U", "Core i5-1135G7", "Core i7-8650U",
    "Core i7-1165G7", "Ryzen 3 5300U", "Ryzen 5 5500U", "Ryzen 7 5700U",
    "M1", "Celeron N4020", "SomeChip X9000",
  ),
  ramGB: fc.constantFrom(2, 4, 8, 12, 16, 24, 32, 64),
  storageGB: fc.constantFrom(128, 256, 512, 1024, 2048),
  storageType: fc.constantFrom("SSD", "HDD"),
  screenInch: fc.constantFrom(13.3, 14, 15.6),
  batteryHealth: fc.integer({ min: 0, max: 100 }),
  cosmetic: fc.constantFrom("like-new", "good", "fair", "poor"),
  accessories: fc.uniqueArray(fc.constantFrom("charger", "bag", "mouse", "box"), { maxLength: 4 }),
  ageYears: fc.integer({ min: 0, max: 12 }),
});

// Non-decreasing ladder check (equal steps allowed: rounding to 50k).
function isNonDecreasing(xs) {
  return xs.every((x, i) => i === 0 || xs[i - 1] <= x);
}
function isNonIncreasing(xs) {
  return xs.every((x, i) => i === 0 || xs[i - 1] >= x);
}

test("PBT: estimate always lies within [low, high]", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const r = estimatePrice(item, COMPARABLES);
      assert.ok(r.low <= r.estimate && r.estimate <= r.high,
        `low ${r.low} <= est ${r.estimate} <= high ${r.high} for ${JSON.stringify(item)}`);
      assert.ok(r.estimate >= 0, "estimate never negative");
    }),
    { numRuns: 500 },
  );
});

test("PBT: more RAM never lowers the estimate (all else equal)", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const ladder = [4, 8, 16, 32].map((ram) => estimatePrice({ ...item, ramGB: ram }, COMPARABLES).estimate);
      assert.ok(isNonDecreasing(ladder), `RAM ladder ${ladder} for ${JSON.stringify(item)}`);
    }),
    { numRuns: 300 },
  );
});

test("PBT: better cosmetic condition never lowers the estimate", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const ladder = ["poor", "fair", "good", "like-new"]
        .map((c) => estimatePrice({ ...item, cosmetic: c }, COMPARABLES).estimate);
      assert.ok(isNonDecreasing(ladder), `cosmetic ladder ${ladder} for ${JSON.stringify(item)}`);
    }),
    { numRuns: 300 },
  );
});

test("PBT: healthier battery never lowers the estimate", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const ladder = [0, 50, 75, 90, 100]
        .map((b) => estimatePrice({ ...item, batteryHealth: b }, COMPARABLES).estimate);
      assert.ok(isNonDecreasing(ladder), `battery ladder ${ladder} for ${JSON.stringify(item)}`);
    }),
    { numRuns: 300 },
  );
});

test("PBT: stronger CPU tier never lowers the estimate", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const ladder = ["Celeron N4020", "Core i3-1115G4", "Core i5-8350U", "Core i7-8650U", "M1"]
        .map((cpu) => estimatePrice({ ...item, cpu }, COMPARABLES).estimate);
      assert.ok(isNonDecreasing(ladder), `CPU ladder ${ladder} for ${JSON.stringify(item)}`);
    }),
    { numRuns: 300 },
  );
});

test("PBT: bigger storage never lowers the estimate; younger never estimates lower than older", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const storage = [128, 256, 512, 1024]
        .map((s) => estimatePrice({ ...item, storageGB: s }, COMPARABLES).estimate);
      assert.ok(isNonDecreasing(storage), `storage ladder ${storage} for ${JSON.stringify(item)}`);
      const age = [0, 2, 5, 10]
        .map((a) => estimatePrice({ ...item, ageYears: a }, COMPARABLES).estimate);
      assert.ok(isNonIncreasing(age), `age ladder ${age} for ${JSON.stringify(item)}`);
    }),
    { numRuns: 300 },
  );
});

test("PBT: adjustments sum to estimate − base within disclosed rounding", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const b = priceBreakdown(item, COMPARABLES);
      if (b.baseSource === "no-data") return; // estimate 0, no adjustments
      // Percent columns sum exactly to totalPercent (clamp row included).
      const pctSum = b.adjustments.reduce((s, a) => s + a.percent, 0);
      assert.equal(pctSum, b.totalPercent);
      // Each IDR amount is exactly round(base * percent / 100).
      for (const a of b.adjustments) {
        assert.equal(a.amountIDR, Math.round(b.basePrice * a.percent / 100), a.label);
      }
      // IDR sum vs (estimate − base): differs only by the disclosed
      // round-to-50k of the final estimate (±25.000) plus per-row
      // rounding (≤ Rp 1 per row).
      const idrSum = b.adjustments.reduce((s, a) => s + a.amountIDR, 0);
      const gap = Math.abs(idrSum - (b.estimate - b.basePrice));
      assert.ok(gap <= 25000 + b.adjustments.length,
        `IDR gap ${gap} too big for ${JSON.stringify(item)}`);
      // Safety rails: no single adjustment beyond ±30% except the
      // visible total-clamp row; total within ±50%.
      for (const a of b.adjustments) {
        if (a.label !== "Batas total penyesuaian") {
          assert.ok(Math.abs(a.percent) <= 30, `${a.label} ${a.percent}%`);
        }
      }
      assert.ok(Math.abs(b.totalPercent) <= 50, `total ${b.totalPercent}%`);
    }),
    { numRuns: 500 },
  );
});

test("PBT: findComparables returns ≤5, best first, never the item itself", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      // Plant the item itself in the dataset: a naive matcher would
      // return it as the perfect (70-point) match.
      const withSelf = [...COMPARABLES, { ...item, priceIDR: 9999999 }];
      const found = findComparables(item, withSelf, 5);
      assert.ok(found.length <= 5, `got ${found.length}`);
      assert.ok(!found.some((f) => f.comparable.id === item.id), "item itself returned");
      assert.ok(!found.some((f) => f.comparable === item), "item object returned");
      for (let i = 1; i < found.length; i++) {
        assert.ok(found[i - 1].score >= found[i].score, "scores descend");
      }
      const ids = found.map((f) => f.comparable.id);
      assert.equal(new Set(ids).size, ids.length, "no duplicate rows");
      for (const f of found) {
        assert.ok(f.score >= 0 && f.score <= 70, `score ${f.score} out of range`);
      }
    }),
    { numRuns: 300 },
  );
});

test("PBT: listing always includes price + condition in both languages", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const est = estimatePrice(item, COMPARABLES);
      const priceText = formatIDR(est.estimate);
      for (const lang of ["id", "en"]) {
        const text = generateListing(item, est, lang);
        assert.ok(text.includes(priceText), `${lang} missing price ${priceText}`);
        assert.ok(text.includes(item.cosmetic), `${lang} missing condition ${item.cosmetic}`);
        assert.ok(text.includes(item.brand) && text.includes(item.model),
          `${lang} missing brand/model`);
      }
      assert.match(generateListing(item, est, "id"), /taksiran/);
      assert.match(generateListing(item, est, "en"), /estimate/);
    }),
    { numRuns: 300 },
  );
});

test("PBT: same inputs always give the same estimate (determinism)", () => {
  fc.assert(
    fc.property(itemArb, (item) => {
      const a = estimatePrice(item, COMPARABLES);
      const b = estimatePrice({ ...item }, COMPARABLES);
      assert.deepEqual(a, b);
    }),
    { numRuns: 200 },
  );
});
