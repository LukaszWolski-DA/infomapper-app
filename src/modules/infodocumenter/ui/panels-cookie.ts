// The editor's side panels (slice 27, item 6; slice 28, item 1): one person's preference in their browser, kept in a
// cookie the browser writes and the server reads, so the editor opens with the panels as they were left from its first
// paint (as slice 5a's canvas side panels). Never stored on the server. A missing or unreadable cookie means the
// defaults: both panels shown at their default widths.
//
// Slice 28 (Q-E): the limits, the defaults and the format are the canvas's (`src/ui/side-panels-cookie.ts`: one rule in
// one place); the cookie stays the editor's own (Q-A), so hiding a panel on the canvas never hides one here. Slice 27's
// value (`250.330`, the two widths) is still read: both panels shown with those widths (Q2).

import { DEFAULT_SIDE_PANELS, clampWidth, parseSidePanelsCookie, type SidePanelsState } from "@/ui/side-panels-cookie";

export type DocPanels = SidePanelsState;
export const DEFAULT_DOC_PANELS: DocPanels = DEFAULT_SIDE_PANELS;

/** One cookie per person. */
export const docPanelsCookieName = (userId: string): string => `im-doc-panels.${userId}`;
/** A year, like the other preferences. */
export const DOC_PANELS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Slice 27's widths-only value, else the canvas's format (`l1.r0.264.340`). */
export function parseDocPanelsCookie(value: string | null | undefined): DocPanels {
  const m = value ? /^(\d{1,4})\.(\d{1,4})$/.exec(value) : null;
  if (m) return { left: true, right: true, leftWidth: clampWidth("left", Number(m[1])), rightWidth: clampWidth("right", Number(m[2])) };
  return parseSidePanelsCookie(value);
}
