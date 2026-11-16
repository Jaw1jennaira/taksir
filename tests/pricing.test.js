// Taksir pricing tests — node:test, zero dependencies.
// Pinned numbers are computed against the SEEDED dataset in
// data/comparables.json. If the seed changes, update the pinned
// numbers AND record why here — never change the formula silently.
// Pinned case: Lenovo ThinkPad T480, i5-8350U, 8 GB, 256 GB SSD,
// battery 82%, cosmetic good, 5 years, accessories [charger].
// Top-5 matched: cmp-01, cmp-02, cmp-03, cmp-14, cmp-04
// (prices 4.5 / 6.2 / 7.8 / 6.8 / 4.8 jt) -> base median Rp 6.200.000.
// Adjustments: storage size -2%, battery -5%, cosmetic -5%,
// accessories +2% -> total -10% -> estimate Rp 5.600.000,
// range Rp 5.050.000 – Rp 6.150.000.
// CHANGE LOG (16 Nov 2026, Phase 2): matching was revised to
// identity-only (brand + model + storage type, max 70) — see
// design.md §3.2. The pinned estimate/base/total are UNCHANGED;
// only match scores changed (cmp-01: 100 -> 70) and the top-5
// order is now cmp-01, cmp-02, cmp-03, cmp-14, cmp-04 (same set,
// ties keep dataset order).

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
  assert.equal(found[0].score, 70);
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

test("total adjustments clamp at ±50% and the clamp is shown", () => {
  // Absurd input whose raw adjustments sum to -97% (found by the
  // property tests, Phase 2): MacBook Pro entered as Celeron / 2 GB /
  // HDD / poor / 12 years. The total must clamp to -50% with a
  // visible breakdown row, never silently collapse the estimate.
  const absurd = {
    brand: "Apple", model: "MacBook Pro 13 M1 (2020)", cpu: "Celeron N4020",
    ramGB: 2, storageGB: 256, storageType: "HDD", batteryHealth: 59,
    cosmetic: "poor", accessories: [], ageYears: 12,
  };
  const b = priceBreakdown(absurd, COMPARABLES);
  assert.equal(b.basePrice, 7800000);
  assert.equal(b.totalPercent, -50);
  assert.equal(b.estimate, 3900000);
  const clamp = b.adjustments.find((a) => a.label === "Batas total penyesuaian");
  assert.ok(clamp, "clamp row present");
  assert.equal(clamp.percent, 47);
  const sum = b.adjustments.reduce((s, a) => s + a.percent, 0);
  assert.equal(sum, b.totalPercent);
});

test("findComparables never returns the item itself", () => {
  const self = { ...T480, id: "cmp-01" };
  const found = findComparables(self, COMPARABLES, 5);
  assert.ok(!found.some((f) => f.comparable.id === "cmp-01"));
  assert.equal(found.length, 5);
});

test("unknown CPU fallback is stated in the breakdown reason", () => {
  const item = {
    brand: "Apple", model: "MacBook Air M1 (2020)", cpu: "SomeChip X9000",
    ramGB: 8, storageGB: 256, storageType: "SSD", batteryHealth: 90,
    cosmetic: "good", accessories: [], ageYears: 4,
  };
  const b = priceBreakdown(item, COMPARABLES);
  const cpuRow = b.adjustments.find((a) => a.label === "CPU");
  assert.ok(cpuRow, "CPU adjustment present (tier 3 vs median tier 5)");
  assert.match(cpuRow.reason, /unknown CPU/);
});

test("formatIDR + median helpers", () => {
  assert.equal(formatIDR(5600000), "Rp 5.600.000");
  assert.equal(median([4, 8, 6]), 6);
  assert.equal(median([4, 8]), 6);
  assert.equal(median([]), 0);
});
