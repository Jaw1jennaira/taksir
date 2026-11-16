# Structure — Taksir

```
taksir/
├── index.html            # app shell; one <section> per view (see below)
├── styles.css            # design system: CSS vars, mobile-first
├── app.js                # routing, storage, form wiring, view rendering
├── manifest.json         # PWA manifest
├── sw.js                 # service worker (cache-first app shell)
├── package.json          # { "type": "module", "scripts": { "test": "npm test" } }
├── README.md             # what Taksir is, how to run, honesty note
├── .gitignore            # node_modules, *.mp4 demo files, .DS_Store — NEVER .kiro/
├── src/
│   └── pricing.js        # pure pricing engine (shared by app, tests, MCP)
├── data/
│   └── comparables.json  # seeded SAMPLE reference dataset (14 rows)
├── tests/
│   └── pricing.test.js   # node:test unit + property-style tests
└── .kiro/
    ├── specs/taksir/
    │   ├── requirements.md   # EARS requirements + acceptance criteria
    │   ├── design.md         # architecture, formula, data model, view map
    │   └── tasks.md          # implementation checklist (this is the work list)
    ├── steering/
    │   ├── product.md        # vision + audience + non-goals
    │   ├── tech.md           # stack + conventions
    │   └── structure.md      # this file
    ├── hooks/
    │   ├── run-tests-on-save.json   # npm test when src/ or tests/ change
    │   └── honesty-check-on-save.json # forbidden-claim grep on save
    ├── agents/
    │   └── pricing-reviewer.md     # custom agent: pricing fairness + honesty
    ├── mcp.json              # registers the taksir-pricing MCP server
    └── mcp-server/
        └── server.js         # zero-dep Node MCP server (stdio JSON-RPC)
```

## Views in index.html (one section each)

| Section id | Route | Purpose |
|---|---|---|
| `#view-home` | `#/` | inventory list + CTAs |
| `#view-add` | `#/tambah` | condition form |
| `#view-estimate` | `#/barang/<id>` | estimate + breakdown + comparables |
| `#view-listing` | `#/barang/<id>/listing` | ID + EN listing + copy buttons |
| `#view-storefront` | `#/toko[/<seller-id>]` | public storefront |
| `#view-settings` | `#/pengaturan` | seller settings |

## Rules for changing this structure

- New view → new `<section>` + route in `app.js` + row in
  `design.md` §6 and in this file. Never render a view from a
  string template injected without an `id`.
- New pricing rule → `src/pricing.js` + `design.md` §3 +
  `tests/pricing.test.js`, in that order.
- Never add a build step, framework, or backend without updating
  `tech.md` and `README.md` first.
