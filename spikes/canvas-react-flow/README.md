# Spike: canvas engine (React Flow)

Throwaway spike for AD-24, built to the brief in `docs/spike-canvas-react-flow.md`. Results and the recommendation are in [REPORT.md](REPORT.md).

## Run it

```bash
npm install
npm run spike        # production build, then http://localhost:3100
```

`npm run dev` starts the dev server on the same port.

## What's on the page

One Next.js page with React Flow 12, fed by a seeded generator (`src/data/generate.ts`, seed 20261002). The data set is the same on every run: 101 cards (one of them has 200 rows), 300 mappings, 40 relationships and 8 frames.

| Where | What it does |
| --- | --- |
| Card header | `all`/`mapped`/`keys` filters the rows; `▾` collapses the card |
| Card right edge | Drag to set the width, 200–600 px |
| Row | Hover or click to highlight its lines and the rows at the other end; click empty canvas to clear |
| Frame label | Drag it (or the frame's background) to move the frame; *Collapse* / *Expand* |
| Empty canvas | Drag to lasso (selects only fully enclosed cards). Shift-click adds or removes a card. Arrow keys nudge the selection |
| Navigation | Scroll wheel pans; Ctrl+wheel or pinch zooms (10–300%); Space-drag or right-drag pans; minimap bottom right |
| Top bar | Switch between crow's-foot and UML notation |
| Top right | FPS readout |

URL switches used for the measurements:

| Switch | Effect |
| --- | --- |
| `?wc=off` / `?wc=move` | `will-change` off / only while panning or zooming (default: always on) |
| `?bg=dots` | Show React Flow's dotted background (default: off) |
| `?visibleOnly` | React Flow's `onlyRenderVisibleElements` |
| `/baseline` | The same cards and lines as plain DOM with one SVG, no React Flow (comparison only) |

`window.__spike` gives the scripts the data set and the React Flow instance.

## Code

| File | Purpose |
| --- | --- |
| `src/data/generate.ts` | Seeded data and layout |
| `src/canvas/Canvas.tsx` | React Flow setup, nodes and edges, frame collapse, merged lines |
| `src/canvas/CardNode.tsx` | Card with filter, collapse, width control; a plain block below 40% zoom |
| `src/canvas/FrameNode.tsx` | Frame group node and the collapsed block |
| `src/canvas/LineLayer.tsx` | All mapping, relationship and merged lines in one SVG layer (follow-up step 3) |
| `src/canvas/geometry.ts` | Curves and markers, ported from the prototype; row positions from data |
| `src/canvas/highlight.ts` | Row hover and selection highlight |
| `src/canvas/FpsMeter.tsx` | FPS readout and `window.__perf` recorder |
| `src/baseline/Baseline.tsx` | The plain-DOM comparison page |

## Tests and measurements

```bash
npx playwright install chromium               # once, for the headless checks
npx playwright test --project=functional      # C-03, C-05, C-06, C-07 (headless)
npx playwright test --project=measure         # C-01, C-02, C-04, C-08, C-09, C-10, C-11
```

Notes:
- Both projects build the app and serve it on port 3101.
- The measurement project opens your installed Google Chrome in a visible window, so the GPU is used. Keep the window uncovered while it runs.
- Results are written to `report/results.json` and screenshots to `report/`.
- To run the same measurements against another setup, use for example `SPIKE_QUERY=wc=move SPIKE_OUT=report/results-wc-move.json`.
