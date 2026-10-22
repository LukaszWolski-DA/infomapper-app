// Whether the open canvas is ready (slice 6b): its view is set and React Flow holds its nodes, so a place can be found
// and selected. `ModelCanvas` sets it with its own `ready` and clears it when it goes; a store outside React state, so
// reading it never re-renders the canvas.

import { createValueStore } from "./value-store";

export const canvasReady = createValueStore(false);
