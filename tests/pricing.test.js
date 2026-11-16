// Taksir pricing tests — node:test, zero dependencies.
// Pinned numbers are computed against the SEEDED dataset in
// data/comparables.json. If the seed changes, update the pinned
// numbers AND record why here — never change the formula silently.
// Pinned case: Lenovo ThinkPad T480, i5-8350U, 8 GB, 256 GB SSD,
// battery 82%, cosmetic good, 5 years, accessories [charger].
// Top-5 matched: cmp-01, cmp-02, cmp-14, cmp-03, cmp-04
// (prices 4.5 / 6.2 / 6.8 / 7.8 / 4.8 jt) -> base median Rp 6.200.000.
// Adjustments: storage size -2%, battery -5%, cosmetic -5%,
// accessories +2% -> total -10% -> estimate Rp 5.600.000,
// range Rp 5.050.000 – Rp 6.150.000.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  estimatePrice, priceBreakdown, findComparables, generateListing,
  formatIDR, cpuTier, median,
} from "../src/pricing.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPARABLES = JSON.parse(readFileSync(join(ROOT, "data", "comparables.json"), "utf-8")).comparables;

const T480 = {
  brand: "Lenovo", model: "ThinkPad T480", cpu: "Core i5-8350U",
  ramGB: 8, storageGB: 256, storageType: "SSD", screenInch: 14,
  batteryHealth: 82, cosmetic: "good", accessories: ["charger"], ageYears: 5,
};

test("pinned estimate for the ThinkPad T480 case", () => {
  const r = estimatePrice(T480, COMPARABLES);
  assert.equal(r.basePrice, 6200000);
  assert.equal(r.baseSource, "matched-median");
  assert.equal(r.matchedCount, 5);
  assert.equal(r.estimate, 5600000);
  assert.equal(r.low, 5050000);
  assert.equal(r.high, 6150000);
  assert.equal(r.breakdown.totalPercent, -10);
});

test("breakdown adjustments sum to totalPercent", () => {
  const b = priceBreakdown(T480, COMPARABLES);
  const sum = b.adjustments.reduce((s, a) => s + a.percent, 0);
  assert.equal(sum, b.totalPercent);
  // Every adjustment carries label, percent, IDR amount, reason.
  for (const a of b.adjustments) {
    assert.equal(typeof a.label, "string");
    assert.equal(typeof a.percent, "number");
    assert.equal(typeof a.amountIDR, "number");
    assert.equal(typeof a.reason, "string");
    assert.ok(Math.abs(a.percent) <= 30, "adjustment cap ±30%");
  }
});

test("findComparables returns best match first", () => {
  const found = findComparables(T480, COMPARABLES, 5);
  assert.equal(found.length, 5);
  assert.equal(found[0].comparable.id, "cmp-01");
  assert.equal(found[0].score, 100);
  for (let i = 1; i < found.length; i++) {
    assert.ok(found[i - 1].score >= found[i].score, "scores descend");
  }
});

test("estimate always lies within [low, high]", () => {
  for (const comp of COMPARABLES) {
    const item = { ...comp, accessories: [] };
    const r = estimatePrice(item, COMPARABLES);
    assert.ok(r.low <= r.estimate && r.estimate <= r.high, comp.id);
  }
});

test("property: more RAM never lowers the estimate (all else equal)", () => {
  const base = estimatePrice(T480, COMPARABLES).estimate;
  const more = estimatePrice({ ...T480, ramGB: 16 }, COMPARABLES).estimate;
  assert.ok(more >= base, `${more} >= ${base}`);
});

test("property: better cosmetic never lowers the estimate (all else equal)", () => {
  const good = estimatePrice(T480, COMPARABLES).estimate;
  const likeNew = estimatePrice({ ...T480, cosmetic: "like-new" }, COMPARABLES).estimate;
  const poor = estimatePrice({ ...T480, cosmetic: "poor" }, COMPARABLES).estimate;
  assert.ok(likeNew >= good && good >= poor, `${likeNew} >= ${good} >= ${poor}`);
});

test("property: worse battery never raises the estimate (all else equal)", () => {
  const healthy = estimatePrice(T480, COMPARABLES).estimate;
  const worn = estimatePrice({ ...T480, batteryHealth: 55 }, COMPARABLES).estimate;
  assert.ok(worn <= healthy, `${worn} <= ${healthy}`);
});

test("empty dataset returns estimate 0 with an explanatory note", () => {
  const b = priceBreakdown(T480, []);
  assert.equal(b.estimate, 0);
  assert.equal(b.baseSource, "no-data");
  assert.match(b.note, /No reference data/);
});

test("unknown CPU falls back to tier 3", () => {
  assert.equal(cpuTier("SomeChip X9000"), 3);
  assert.equal(cpuTier("Core i7-1165G7"), 4);
  assert.equal(cpuTier("M1"), 5);
});

test("generateListing contains only entered fields + estimate", () => {
  const est = estimatePrice(T480, COMPARABLES);
  const id = generateListing({ ...T480, sellerName: "YUSMARA", city: "Tasikmalaya" }, est, "id");
  const en = generateListing({ ...T480, sellerName: "YUSMARA", city: "Tasikmalaya" }, est, "en");
  for (const text of [id, en]) {
    assert.match(text, /ThinkPad T480/);
    assert.match(text, /5\.600\.000/);
    assert.doesNotMatch(text, /bergaransi|garansi|pasti laku/i);
  }
  assert.match(id, /DIJUAL/);
  assert.match(id, /taksiran/);
  assert.match(en, /FOR SALE/);
  assert.match(en, /estimate/);
});

test("formatIDR + median helpers", () => {
  assert.equal(formatIDR(5600000), "Rp 5.600.000");
  assert.equal(median([4, 8, 6]), 6);
  assert.equal(median([4, 8]), 6);
  assert.equal(median([]), 0);
});
