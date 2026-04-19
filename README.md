# Cascade Demo V2

Conversational, anticipatory emergency mapping on **real public data** for Hillsborough County, FL. Spiritual successor to [`cascade-demo`](https://github.com/franzenjb/cascade-demo) — same tool-use architecture, same catalog-driven design, but grounded in real CDC SVI, FEMA NRI, United Way ALICE, OpenFEMA declarations, US Census tract geometry, and Florida parcel records.

## Stack

- Next.js 14 (App Router, TypeScript)
- MapLibre GL JS (open-source map)
- Tailwind CSS + Red Cross brand tokens
- Anthropic Claude Sonnet 4.6 via `@anthropic-ai/sdk`
- Supabase (REST) for SVI / NRI / ALICE / FEMA (reuses the ops.jbf.com public tables)
- TIGERweb (US Census ArcGIS REST) for tract geometry
- `florida-parcels` Railway microservice for parcel-level data

## Quick start

```bash
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY and SUPABASE_ANON_KEY
npm install
npm run dev
# Open http://localhost:3000
```

## Architecture

The `lib/claude.ts` loop streams Claude's response while letting it call tools against the real datasets. `data/semantic_catalog.json` tells Claude what layers exist; `data/system_prompt.md` tells it how to behave. `components/MapView.tsx` renders MapLibre and reacts to `map_instruction` events streamed from the chat.

## Relationship to sibling projects

- [`cascade-demo`](https://github.com/franzenjb/cascade-demo) — synthetic-data prototype, canonical demo for the "Before You Even Ask" white paper. Not disturbed by V2.
- [`spatial-ops-jbf`](https://github.com/franzenjb/spatial-ops-jbf) (ops.jbf.com) — production Red Cross operational app. V2 coexists; does not replace.

Both parent apps remain untouched. V2 is a new surface that combines cascade-demo's conversational pattern with spatial-ops-jbf's real-data pipeline.
