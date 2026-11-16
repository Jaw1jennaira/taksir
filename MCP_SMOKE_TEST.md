# MCP Smoke Test — Taksir pricing server

- **Date:** 16 Nov 2026
- **Server:** `.kiro/mcp-server/server.js` (Node, zero dependencies,
  JSON-RPC 2.0 over stdio, wraps `src/pricing.js` + `data/comparables.json`)
- **Command:**
  `printf '<initialize>' '<notifications/initialized>' '<tools/list>' '<tools/call estimate_price>' '<tools/call get_price_breakdown>' | node .kiro/mcp-server/server.js`

## Session

1. `initialize` (id 1) → `serverInfo: { name: "taksir-pricing", version: "0.1.0" }`, `capabilities: { tools: {} }` ✅
2. `notifications/initialized` → no response (correct: notifications get none) ✅
3. `tools/list` (id 2) → `["list_comparables", "estimate_price", "get_price_breakdown"]` ✅
4. `tools/call estimate_price` (id 3) — Lenovo ThinkPad T480 / i5-8350U /
   8 GB / 256 GB SSD / battery 82% / good / 5 years / charger →
   `estimate 5600000, low 5050000, high 6150000, base 6200000 (matched-median)` ✅
   (matches the pinned values in `tests/pricing.test.js`)
5. `tools/call get_price_breakdown` (id 4) — same item → 4 adjustments,
   `totalPercent -10`, 5 matched comparables; first adjustment
   `Storage size -2% (-Rp 124.000, "256 GB vs matched median 512 GB")` ✅

## Result

**PASS — 4/4 responses correct, 0 errors.** Re-run after any change to
`src/pricing.js`, `data/comparables.json`, or `.kiro/mcp-server/server.js`.
