// A canvas's thumbnail in a tile's strip (slice 12b, PRD P2, P5): an `<svg>` whose external `<use>` draws the
// canvas's drawing from its address (`/w/{workspace}/thumbnail/{canvas}?v={key}`, `thumbnail-svg.ts`), so the page
// carries only the address and the shapes take the page's tokens. No hooks, no client code, no layout read: the strip
// has a fixed height and the SVG fills it, keeping the proportions. An empty canvas says so as text. Decorative: the
// tile's name stays its accessible name.

import { THUMBNAIL_SYMBOL } from "./thumbnail-svg";

export function CanvasThumbnail({ href }: { href: string | null }) {
  if (!href) {
    return (
      <span aria-hidden className="grid size-full place-items-center text-[13px] text-im-ink-3" data-testid="tile-thumbnail-empty">
        Empty canvas
      </span>
    );
  }
  return (
    <svg aria-hidden className="block size-full" data-testid="tile-thumbnail">
      <use href={`${href}#${THUMBNAIL_SYMBOL}`} width="100%" height="100%" />
    </svg>
  );
}
