// Taksir pricing MCP server — zero dependencies, Node, JSON-RPC over stdio.
// Wraps the SAME src/pricing.js module the browser app and the tests use,
// so estimates from the agent, the app, and the tests can never drift apart.
// Tools: list_comparables, estimate_price, get_price_breakdown.
// Protocol: newline-delimited JSON-RPC 2.0 on stdin/stdout.
// Run:  node .kiro/mcp-server/server.js
// Registered for Kiro in .kiro/mcp.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { estimatePrice, priceBreakdown, findComparables } from "../../src/pricing.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPARABLES_PATH = join(ROOT, "data", "comparables.json");

function loadComparables() {
  const raw = JSON.parse(readFileSync(COMPARABLES_PATH, "utf-8"));
  return raw.comparables ?? raw;
}

const COMPARABLES = loadComparables();

const TOOLS = [
  {
    name: "list_comparables",
    description:
      "List the reference comparables dataset (SEEDED SAMPLE data, not live market prices). " +
      "Optional filters: brand, model, maxPriceIDR.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        model: { type: "string" },
        maxPriceIDR: { type: "number" },
      },
    },
  },
  {
    name: "estimate_price",
    description:
      "Estimate a second-hand laptop price with the transparent rule-based model " +
      "(see src/pricing.js). Returns estimate, low/high range, base price and source. " +
      "This is an ESTIMATE from sample reference data, not a market price.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        model: { type: "string" },
        cpu: { type: "string" },
        ramGB: { type: "number" },
        storageGB: { type: "number" },
        storageType: { type: "string", enum: ["SSD", "HDD"] },
        screenInch: { type: "number" },
        batteryHealth: { type: "number" },
        cosmetic: { type: "string", enum: ["like-new", "good", "fair", "poor"] },
        accessories: { type: "array", items: { type: "string" } },
        ageYears: { type: "number" },
      },
      required: ["brand", "model"],
    },
  },
  {
    name: "get_price_breakdown",
    description:
      "Full transparent price breakdown for an item: base price and source, " +
      "every adjustment with label/percent/IDR amount/reason, matched comparables " +
      "with match scores, and the estimate range.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        model: { type: "string" },
        cpu: { type: "string" },
        ramGB: { type: "number" },
        storageGB: { type: "number" },
        storageType: { type: "string", enum: ["SSD", "HDD"] },
        screenInch: { type: "number" },
        batteryHealth: { type: "number" },
        cosmetic: { type: "string", enum: ["like-new", "good", "fair", "poor"] },
        accessories: { type: "array", items: { type: "string" } },
        ageYears: { type: "number" },
      },
      required: ["brand", "model"],
    },
  },
];

function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function callTool(name, args = {}) {
  switch (name) {
    case "list_comparables": {
      let rows = COMPARABLES;
      if (args.brand) rows = rows.filter((r) => r.brand === args.brand);
      if (args.model) rows = rows.filter((r) => r.model === args.model);
      if (typeof args.maxPriceIDR === "number") rows = rows.filter((r) => r.priceIDR <= args.maxPriceIDR);
      return toolResult({
        note: "SAMPLE reference data — not live market prices.",
        count: rows.length,
        comparables: rows,
      });
    }
    case "estimate_price": {
      const result = estimatePrice(args, COMPARABLES);
      return toolResult({ ...result, breakdown: undefined, note: "Estimate from sample reference data — not a market price." });
    }
    case "get_price_breakdown": {
      const breakdown = priceBreakdown(args, COMPARABLES);
      const matched = findComparables(args, COMPARABLES, 5).map((m) => ({
        ...m.comparable, matchScore: m.score,
      }));
      return toolResult({ ...breakdown, matched });
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function handleMessage(msg) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return null;
  const { id, method, params } = msg;
  // Notifications (no id) get no response.
  const respond = (result) => (id === undefined ? null : { jsonrpc: "2.0", id, result });
  const fail = (code, message) => (id === undefined ? null : { jsonrpc: "2.0", id, error: { code, message } });
  try {
    switch (method) {
      case "initialize":
        return respond({
          protocolVersion: params?.protocolVersion ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "taksir-pricing", version: "0.1.0" },
        });
      case "ping":
        return respond({});
      case "tools/list":
        return respond({ tools: TOOLS });
      case "tools/call": {
        const { name, arguments: args } = params ?? {};
        return respond(callTool(name, args ?? {}));
      }
      default:
        return fail(-32601, `Method not found: ${method}`);
    }
  } catch (err) {
    return fail(-32603, err?.message ?? String(err));
  }
}

// Newline-delimited JSON on stdin; one JSON object per response line on stdout.
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0", id: null,
        error: { code: -32700, message: "Parse error" },
      }) + "\n");
      continue;
    }
    const response = handleMessage(msg);
    if (response) process.stdout.write(JSON.stringify(response) + "\n");
  }
});
