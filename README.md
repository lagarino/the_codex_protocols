# Necron Army Builder

A browser-based tool for configuring Necron armies for Tabletop Simulator (TTS) and Yellowscribe.
Drag leaders onto bodyguard units, share abilities between them, filter the ability list, and export
a print-ready card sheet or a modified TTS save file.

## Quick start

```bash
npm install
npm run test       # run all tests once
npm run test:watch # re-run tests on save
```

## Development

The app has two processes that must run together in separate terminals:

```bash
# Terminal 1 — Express API server (proxies Yellowscribe upload server-side)
npm run dev:server   # → http://localhost:3001

# Terminal 2 — Vite dev server (React frontend)
npm run dev          # → http://localhost:5173
```

Open `http://localhost:5173`. Vite proxies `/api/*` requests to the Express server automatically, so the "Export Yellowscribe" button works without CORS issues.

## Deployment

### Docker (recommended for AWS)

```bash
# Build image — compiles the Vite frontend and assembles a lean Node 22 runtime
docker build -t codex-protocols .

# Run locally to verify
docker run -p 3001:3001 codex-protocols
# → http://localhost:3001
```

The container serves both the React SPA and the `/api/yellowscribe` proxy from a single port. Set the `PORT` environment variable to override the default (3001):

```bash
docker run -p 8080:8080 -e PORT=8080 codex-protocols
```

### AWS options

All three approaches use the same Docker image:

| Option | Notes |
|---|---|
| **ECS / Fargate** | Push image to ECR, create a Fargate service, point an ALB to the container port |
| **Elastic Beanstalk** | Use the "Docker" platform; EB sets `PORT` automatically |
| **EC2** | Pull image, run with `docker run -d -p 80:3001 codex-protocols` |

### Without Docker (Node.js host)

```bash
npm install
npm run build      # compiles frontend → dist/
npm start          # serves dist/ + API on $PORT (default 3001)
```

## Supported input formats

| Format | Load | Export JSON | Export Yellowscribe | Print |
|---|---|---|---|---|
| TTS save (`.json`) | ✓ | ✓ | ✓ | ✓ |
| Yellowscribe (`.json`) | ✓ | — | ✓ | ✓ |

## Project structure

```
src/
  parser/          Pure functions: raw JSON → internal army model
    detect.js        detectFormat()
    tts.js           parseTTS(), parseFullUnit(), parseModels(), parseWeapons()
    yellowscribe.js  parseYellowscribe(), parseFullUnit()
    utils.js         Shared helpers (stripColour, extractKeywords, …)
    index.js         Re-exports

  engine/          Pure functions: army model → output artifacts
    output.js        generateOutput() — TTS JSON export
    yellowscribe.js  generateYellowscribe() — Yellowscribe JSON export (works from both formats)
    print.js         buildPrintOutput() — HTML print document

  state/
    store.js         Zustand store — all state and actions
    profile.js       localStorage save/load

  components/      Shared UI components
    Header.jsx       Nav, file load, export/print buttons
    AbilityModal.jsx Leader ↔ bodyguard ability selection
    ProfileBanner.jsx Saved-profile restore prompt
    Toast.jsx        Notification system

  screens/         Route-level page components
    Builder.jsx      Main drag-and-drop canvas (/)
    Filter.jsx       Ability inclusion/exclusion panel (/filter)
    Print.jsx        Redirect placeholder (/print)

  styles/
    global.css       Design tokens and shared classes

tests/
  parser/          Unit tests for parsers
  engine/          Unit tests for output and print engines
  fixtures/        Sample JSON files for tests
```

## Architecture notes

**Data flow:** File loads → `detectFormat` → `parseTTS` or `parseYellowscribe` → internal model
stored in Zustand → UI reads from store → `generateOutput` / `buildPrintOutput` produce artifacts.

**Internal model:** Every unit is either a `Leader`, `Group`, or `Character`. All three are flat
arrays in the store. Attachments are a `Map<leaderId, Attachment>`. Excluded abilities are a
`Map<unitId, Set<abilityName>>`. Nothing else needs to know about the source format.

**Testing:** Parser and engine modules are pure functions — no DOM, no side effects. Tests import
them directly with real fixture data. Component tests use `@testing-library/react` and are in the
same `tests/` tree.

**Adding a new input format:** Write a `parseXxx(data)` function that returns `{ leaders, groups,
characters }` and a `parseFullUnit(data, id)` for print. Add the format to `detectFormat` and
`handleFile` in the store. The rest of the app is unchanged.
```
