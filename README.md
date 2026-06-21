# Necron Army Builder

A browser-based tool for configuring Necron armies for Tabletop Simulator (TTS) and Yellowscribe.
Drag leaders onto bodyguard units, share abilities between them, filter the ability list, and export
a print-ready card sheet or a modified TTS save file.

## Quick start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run test       # run all tests once
npm run test:watch # re-run tests on save
npm run build      # production build → dist/
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
