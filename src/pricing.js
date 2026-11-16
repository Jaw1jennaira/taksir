// Taksir pricing engine — TRANSPARENT RULE-BASED model.
// NOT machine learning, NOT AI vision, NOT live market scraping.
// The estimate is derived from the reference comparables dataset
// (data/comparables.json, labelled sample data) by the rules below.
// Every adjustment is listed in the breakdown the UI shows.
//
// Formula (all percentages relative to the base price unless stated):
//   base       = median price of matched comparables
//                (fallback: same-brand median, then global median)
//   matching    = IDENTITY only (brand, model, storage type — see
//                similarityScore). Fields that are priced by adjustments
//                (RAM, cosmetic, battery, age, CPU tier) deliberately do
//                NOT take part in matching: if they did, changing one of
//                them would swap the reference set and could move the base
//                median more than the adjustment, so e.g. more RAM could
//                LOWER the estimate. Matching on identity only makes the
//                estimate monotone in every adjustment field (property
//                tests in tests/pricing.pbt.test.js).
//   adjustments (each returns { label, percent, amountIDR, reason }):
//   - CPU tier difference vs matched median tier: +/- 6% per tier step (cap +/-18%)
//   - RAM vs matched median RAM: +/- 4% per 8 GB step (cap +/-12%)
//   - Storage: SSD vs HDD +8%; per 256 GB above/below median +/- 2% (cap +/-8%)
//   - Battery health: >=90% 0%; 80–89% -5%; 70–79% -10%; <70% -15%
//   - Cosmetic: like-new 0%; good -5%; fair -12%; poor -20%
//   - Age: -6% per year beyond the matched median age (cap -30%); newer than
//     median by >=1 year: +4% per year (cap +8%)
//   - Accessories: +2% each, cap +6% (charger, bag, mouse, original box)
//   - Screen: no adjustment (shown for transparency; size affects matching only)
//   - TOTAL: sum of adjustments is clamped to ±50% and the clamp is
//     shown as its own breakdown row (never silent) — see priceBreakdown.
// estimate    = round(base * (1 + sum(percent)) to nearest Rp 50.000)
// low / high  = estimate -/+ 10% (rounded to nearest Rp 50.000)
// ---------------------------------------------------------------------------

export const COSMETIC_LEVELS = ["like-new", "good", "fair", "poor"];
export const CPU_TIERS = {
  // tier: [representative CPU families] — coarse, transparent buckets
  1: ["Celeron", "Pentium", "Atom"],
  2: ["Core i3", "Ryzen 3"],
  3: ["Core i5", "Ryzen 5"],
  4: ["Core i7", "Ryzen 7"],
  5: ["Core i9", "Ryzen 9", "M1", "M2", "M3", "M4"],
};

export function cpuTier(cpuLabel) {
  if (!cpuLabel) return 3;
  const label = String(cpuLabel);
  for (const [tier, names] of Object.entries(CPU_TIERS)) {
    if (names.some((n) => label.toLowerCase().includes(n.toLowerCase()))) {
      return Number(tier);
    }
  }
  return 3; // unknown CPU -> middle tier, stated in breakdown
}

export function isKnownCpu(cpuLabel) {
  if (!cpuLabel) return false;
  const label = String(cpuLabel).toLowerCase();
  return Object.values(CPU_TIERS).flat().some((n) => label.includes(n.toLowerCase()));
}

export function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function roundTo50k(n) {
  return Math.round(n / 50000) * 50000;
}

function similarityScore(item, comp) {
  // 0–70 match score. IDENTITY fields only (see design.md §3.2):
  // brand, model, storage type. RAM, cosmetic condition, battery,
  // age and CPU tier are priced by adjustments, not by matching —
  // letting them pick the reference set made the estimate
  // non-monotone in those fields (e.g. 16 GB RAM estimating lower
  // than 12 GB on the same laptop).
  let score = 0;
  if (comp.brand === item.brand) score += 40;
  if (comp.model === item.model) score += 25;
  if ((comp.storageType || "") === (item.storageType || "")) score += 5;
  return score;
}

/**
 * Find comparables most similar to the item, best first.
 * @param {object} item - the seller's laptop
 * @param {Array} comparables - reference dataset rows
 * @param {number} limit - max rows to return (default 5)
 * @returns {Array<{comparable, score}>}
 */
export function findComparables(item, comparables, limit = 5) {
  return comparables
    // Never match the item against itself (e.g. if a seller's own
    // listing ever lands in the reference dataset, the estimate
    // must not be based on itself).
    .filter((c) => item.id == null || c.id !== item.id)
    .map((comparable) => ({ comparable, score: similarityScore(item, comparable) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function medianOf(rows, field) {
  const values = rows.map((r) => r[field]).filter((v) => typeof v === "number");
  return values.length ? median(values) : null;
}

/**
 * Full transparent breakdown. Every number the UI shows comes from here.
 * @returns {{basePrice, baseSource, matchedCount, matched, adjustments, estimate, low, high}}
 */
export function priceBreakdown(item, comparables) {
  const matched = findComparables(item, comparables, 5);
  const matchedRows = matched.map((m) => m.comparable);
  let basePrice = 0;
  let baseSource = "global-median";
  if (matchedRows.length > 0) {
    basePrice = median(matchedRows.map((r) => r.priceIDR));
    baseSource = "matched-median";
  }
  if (!basePrice) {
    const sameBrand = comparables.filter((c) => c.brand === item.brand);
    if (sameBrand.length) {
      basePrice = median(sameBrand.map((r) => r.priceIDR));
      baseSource = "same-brand-median";
    }
  }
  if (!basePrice && comparables.length) {
    basePrice = median(comparables.map((r) => r.priceIDR));
    baseSource = "global-median";
  }
  if (!basePrice) {
    return {
      basePrice: 0, baseSource: "no-data", matchedCount: 0, matched: [],
      adjustments: [], estimate: 0, low: 0, high: 0,
      note: "No reference data available — cannot estimate.",
    };
  }

  const medianTier = medianOf(matchedRows, "cpuTier") ?? cpuTier(item.cpu);
  const medianRam = medianOf(matchedRows, "ramGB") ?? item.ramGB ?? 8;
  const medianStorage = medianOf(matchedRows, "storageGB") ?? item.storageGB ?? 256;
  const medianAge = medianOf(matchedRows, "ageYears") ?? 3;
  const medianStorageType = matchedRows[0]?.storageType;

  const adjustments = [];
  const add = (label, percent, reason) => {
    const pct = Math.max(-30, Math.min(30, percent));
    if (pct !== 0) {
      adjustments.push({ label, percent: pct, amountIDR: Math.round(basePrice * pct / 100), reason });
    }
  };

  // CPU tier vs matched median
  const itemTier = cpuTier(item.cpu);
  const tierDiff = itemTier - (typeof medianTier === "number" ? medianTier : itemTier);
  add("CPU", Math.max(-18, Math.min(18, tierDiff * 6)),
    `CPU tier ${itemTier} vs matched median tier ${medianTier}` +
    (isKnownCpu(item.cpu) ? "" : " (unknown CPU — middle tier 3 used as fallback)"));

  // RAM vs matched median
  const ramSteps = Math.round(((item.ramGB || 0) - medianRam) / 8);
  add("RAM", Math.max(-12, Math.min(12, ramSteps * 4)),
    `${item.ramGB || 0} GB vs matched median ${medianRam} GB`);

  // Storage type + size
  if (item.storageType === "SSD" && medianStorageType === "HDD") {
    add("Storage type", 8, "SSD vs matched median HDD");
  } else if (item.storageType === "HDD" && medianStorageType === "SSD") {
    add("Storage type", -8, "HDD vs matched median SSD");
  }
  const storageSteps = Math.round(((item.storageGB || 0) - medianStorage) / 256);
  add("Storage size", Math.max(-8, Math.min(8, storageSteps * 2)),
    `${item.storageGB || 0} GB vs matched median ${medianStorage} GB`);

  // Battery health
  const battery = item.batteryHealth ?? 100;
  if (battery >= 90) { /* 0 */ }
  else if (battery >= 80) add("Battery health", -5, `Battery health ${battery}% (80–89%)`);
  else if (battery >= 70) add("Battery health", -10, `Battery health ${battery}% (70–79%)`);
  else add("Battery health", -15, `Battery health ${battery}% (below 70%)`);

  // Cosmetic condition
  const cosmeticAdj = { "like-new": 0, good: -5, fair: -12, poor: -20 };
  add("Cosmetic condition", cosmeticAdj[item.cosmetic] ?? -12,
    `Cosmetic condition: ${item.cosmetic || "unknown"}`);

  // Age vs matched median
  const ageDiff = (item.ageYears ?? 3) - medianAge;
  if (ageDiff > 0) add("Age", Math.max(-30, -ageDiff * 6), `${item.ageYears} years old vs matched median ${medianAge}`);
  else if (ageDiff < 0) add("Age", Math.min(8, -ageDiff * 4), `${item.ageYears} years old vs matched median ${medianAge}`);

  // Accessories
  const accessoryCount = Array.isArray(item.accessories) ? item.accessories.length : 0;
  add("Accessories", Math.min(6, accessoryCount * 2),
    `${accessoryCount} included accessories`);

  const totalPercentRaw = adjustments.reduce((sum, a) => sum + a.percent, 0);
  // Safety rail (pricing-reviewer: flag totals beyond ±50%): the sum
  // of adjustments can reach -97% for absurd inputs (e.g. a MacBook
  // Pro entered as Celeron / 2 GB / HDD / poor / 12 years), which
  // would collapse the estimate to ~3% of the base price. Clamp the
  // total to ±50% and show the clamp as its own breakdown row, so
  // the limit is visible, never silent.
  let totalPercent = totalPercentRaw;
  if (totalPercentRaw > 50 || totalPercentRaw < -50) {
    const clamped = Math.max(-50, Math.min(50, totalPercentRaw));
    const clampPct = clamped - totalPercentRaw;
    adjustments.push({
      label: "Batas total penyesuaian",
      percent: clampPct,
      amountIDR: Math.round(basePrice * clampPct / 100),
      reason: `Total penyesuaian dibatasi ${clamped > 0 ? "+" : ""}${clamped}% agar taksiran tetap wajar`,
    });
    totalPercent = clamped;
  }
  const estimate = roundTo50k(basePrice * (1 + totalPercent / 100));
  const low = roundTo50k(estimate * 0.9);
  const high = roundTo50k(estimate * 1.1);

  return {
    basePrice, baseSource, matchedCount: matchedRows.length,
    matched: matched.map((m) => ({ ...m.comparable, matchScore: m.score })),
    adjustments, totalPercent, estimate, low, high,
    note: "Estimate from sample reference data — not a market price.",
  };
}

/**
 * Convenience wrapper: headline estimate + range + breakdown.
 */
export function estimatePrice(item, comparables) {
  const b = priceBreakdown(item, comparables);
  return {
    estimate: b.estimate, low: b.low, high: b.high,
    basePrice: b.basePrice, baseSource: b.baseSource,
    matchedCount: b.matchedCount, adjustments: b.adjustments,
    breakdown: b,
  };
}

/**
 * Generate listing text (Indonesian + English) for one item.
 * Pure string templating — no AI generation, no invented specs:
 * only fields the seller entered plus the estimate range.
 */
export function generateListing(item, estimate, lang = "id") {
  const price = typeof estimate === "object" ? estimate.estimate : estimate;
  const priceText = formatIDR(price);
  const specs = [
    item.brand && item.model ? `${item.brand} ${item.model}` : "",
    item.cpu || "",
    `RAM ${item.ramGB || "-"} GB`,
    `${item.storageGB || "-"} GB ${item.storageType || ""}`.trim(),
    item.screenInch ? `Layar ${item.screenInch}"` : "",
    item.batteryHealth ? `Baterai ${item.batteryHealth}%` : "",
    item.cosmetic ? `Kondisi fisik: ${item.cosmetic}` : "",
    item.ageYears != null ? `Pemakaian ${item.ageYears} tahun` : "",
  ].filter(Boolean).join(" • ");
  const accessories = (item.accessories || []).join(", ") || "-";
  const seller = item.sellerName || "";
  const city = item.city || "";

  if (lang === "en") {
    return [
      `FOR SALE — ${item.brand || ""} ${item.model || ""}`.trim(),
      "",
      specs,
      `Accessories: ${accessories}`,
      `Price: ${priceText} (estimate — open to reasonable offers)`,
      seller || city ? `Seller: ${[seller, city].filter(Boolean).join(" — ")}` : "",
      "Chat on WhatsApp for details and photos.",
    ].filter(Boolean).join("\n");
  }
  return [
    `DIJUAL — ${item.brand || ""} ${item.model || ""}`.trim(),
    "",
    specs,
    `Kelengkapan: ${accessories}`,
    `Harga: ${priceText} (taksiran — nego wajar dipersilakan)`,
    seller || city ? `Penjual: ${[seller, city].filter(Boolean).join(" — ")}` : "",
    "Chat WhatsApp untuk detail & foto.",
  ].filter(Boolean).join("\n");
}

export function formatIDR(n) {
  if (n == null || Number.isNaN(Number(n))) return "Rp -";
  return "Rp " + Math.round(Number(n)).toLocaleString("id-ID");
}
