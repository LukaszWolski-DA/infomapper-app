// A selected item's key on the canvas (slice 2a): a card's, a frame's, a note's or a requirement card's. A type only, in
// the domain since slice 27 (F1) because the line data it belongs to is drawn by the documents' figures too.
export type SelectionKey = `entity:${string}` | `source:${string}` | `frame:${string}` | `note:${string}` | `req:${string}`;
