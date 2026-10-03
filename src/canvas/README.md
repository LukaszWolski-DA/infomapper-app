# src/canvas

The modeling canvas: React Flow with the AD-24 rules (detail by zoom level below 40 %, no handle per row, row
positions from data, the spike report's CSS rules). The spike in `spikes/canvas-react-flow` shows the approach.

- `card-data.ts`, `geometry.ts`, `names.ts`: pure TypeScript (card contents, sizes, fit, zoom, middle truncation),
  tested in `canvas.test.ts`.
- `ModelCanvas.tsx`, `CardNode.tsx`, `Overview.tsx`, `ZoomControls.tsx`, `CanvasProvider.tsx`: the client
  components. Writes go through server actions passed in as props; this layer never imports `app` or `data`.
