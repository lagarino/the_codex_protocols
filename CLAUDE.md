# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development — run both in separate terminals
npm run dev          # Vite dev server → http://localhost:5173
npm run dev:server   # Express API server → http://localhost:3001

# Production
npm run build        # Vite build → dist/
npm start            # Express serves dist/ + API on $PORT (default 3001)

# Tests
npm run test         # run all tests once (vitest)
npm run test:watch   # vitest in watch mode

# Run a single test file
npx vitest run tests/parser/tts.test.js

# Run tests matching a name pattern
npx vitest run -t "merges attached leader"
```

## Architecture

**Data flow:** JSON file → `detectFormat` → `parseTTS` or `parseYellowscribe` → internal army model stored in Zustand → UI reads from store → `generateOutput` (TTS JSON), `generateYellowscribe` (Yellowscribe JSON), or `buildPrintOutput` (HTML) produce artifacts.

**Internal army model** (flat arrays, format-agnostic):
- `leaders` — Character units with a `Leader` or `Support` ability. Have `id`, `name`, `role`, `objIdx`, `abilities`, `keywords`.
- `groups` — Bodyguard/regular units. Have `uuid`, `name`, `models` (count), `indices` (array of source object indices/keys), `abilities`.
- `characters` — Character units without `Leader`/`Support` (e.g. epic heroes). Have `objIdx`, `name`.
- `attachments` — `Map<leaderId, { leaderId, groupUuid, abilitiesForward, abilitiesReverse }>`. `abilitiesForward` are leader abilities shared onto the bodyguard; `abilitiesReverse` are bodyguard abilities shared onto the leader.
- `excludedAbilities` — `Map<unitId, Set<abilityName>>`. Keys are always `String(unitId)`.

**ID conventions differ by format:**
- TTS: `leader.id = String(objectIndex)`, `leader.objIdx = numeric index`, `group.uuid = UUID string from LuaScript tag`
- Yellowscribe: `leader.id = uuid string`, `leader.objIdx = same uuid string`, `group.uuid = same uuid string`

**Parser import gotcha:** Both `tts.js` and `yellowscribe.js` export a function named `parseFullUnit`. When importing both in the same file, alias them. The barrel at `src/parser/index.js` already does this (`parseFullUnitTTS`, `parseFullUnitYellowscribe`). When importing directly from a parser file, use `{ parseFullUnit as parseFullUnitTTS }`.

**State:** All mutations go through named actions in `src/state/store.js` (Zustand). Components never mutate state. `_persist()` saves attachments, excludedAbilities, and fontScale to `localStorage` keyed by filename so sessions survive page refresh.

**Output engines** (`src/engine/`) are pure functions — no DOM, no store access:
- `output.js → generateOutput(rawData, armyState)` — deep-clones the TTS JSON, strips excluded abilities from `Description` and `LuaScript`, injects shared abilities, applies font scaling.
- `yellowscribe.js → generateYellowscribe(rawData, format, armyState)` — produces a Yellowscribe JSON from either input format. For Yellowscribe input: clone + patch. For TTS input: converts from scratch via `parseFullUnitTTS`. Shared abilities are written as `"Ability (from Unit Name)"` in both the `abilities` dict and model ability list.
- `print.js → buildPrintOutput(rawData, format, armyState)` — returns a self-contained HTML document (A4 landscape, auto-prints on load). Calls format-aware `parseFullUnit` to fetch full stats/weapons per unit.

**Adding a new format:** Implement `parseFoo(data)` returning `{ leaders, groups, characters }` and `parseFullUnit(data, id)` returning full unit stats. Register in `detectFormat` and `store.loadFile`. No other files need changing.

**Backend server** (`server/index.js`): Lightweight Express 5 app. In development, only the `/api/yellowscribe` route is active — Vite dev server handles the frontend and proxies `/api/*` to Express on port 3001 (configured in `vite.config.js`). In production (or after `npm run build`), the server also serves `dist/` and catches unknown paths with `index.html` for SPA routing. The proxy route POSTs the army JSON to `https://yellowscribe.link/getArmyCode` server-to-server (no CORS restriction), then returns `{ code }` to the browser. `PORT` env var overrides the default port 3001. The `Dockerfile` is a two-stage build (Node 22 Alpine): stage 1 builds the Vite frontend, stage 2 assembles a lean runtime image with `--omit=dev` deps, `server/`, and `dist/`.

**Tests** use real fixture data from `tests/fixtures/`. Parser and engine modules are pure functions tested directly with Vitest + jsdom. No mocking of parsers or the store in engine tests.
