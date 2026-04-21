# Cascade 2

Conversational, anticipatory emergency mapping on **real public data** for Pinellas County, FL. Spiritual successor to [`cascade1`](https://github.com/franzenjb/cascade1) — same tool-use architecture, same catalog-driven design, but grounded in real CDC SVI, FEMA NRI, United Way ALICE, OpenFEMA declarations, US Census tract geometry, and Florida parcel records.

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

- [`cascade1`](https://github.com/franzenjb/cascade1) — synthetic-data prototype, canonical demo for the "Before You Even Ask" white paper. Not disturbed by cascade2.
- [`spatial-ops-jbf`](https://github.com/franzenjb/spatial-ops-jbf) (ops.jbf.com) — production Red Cross operational app. cascade2 coexists; does not replace.

Both parent apps remain untouched. cascade2 is a new surface that combines cascade1's conversational pattern with spatial-ops-jbf's real-data pipeline.
