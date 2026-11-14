// The editor's side panels' widths (slice 27, item 6, Q7 as Łukasz answered): one person's preference in their browser,
// kept in a cookie the browser writes and the server reads, so the editor opens with the panels as they were left from
// its first paint (as slice 5a's canvas side panels). Never stored on the server. A missing or unreadable cookie means
// the defaults.

/** The prototype's bounds and defaults (`PANELS`): the sections panel and the options panel, in px. */
export const DOC_PANEL_LIMITS = {
  left: { min: 200, max: 480, def: 250 },
  right: { min: 280, max: 560, def: 330 },
} as const;
export type DocPanel = keyof typeof DOC_PANEL_LIMITS;
export type DocPanelWidths = Readonly<Record<DocPanel, number>>;
export const DEFAULT_DOC_PANELS: DocPanelWidths = { left: DOC_PANEL_LIMITS.left.def, right: DOC_PANEL_LIMITS.right.def };

/** One cookie per person. */
export const docPanelsCookieName = (userId: string): string => `im-doc-panels.${userId}`;
/** A year, like the other preferences. */
export const DOC_PANELS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const clampDocPanel = (side: DocPanel, width: number): number => {
  const { min, max } = DOC_PANEL_LIMITS[side];
  return Math.min(max, Math.max(min, Math.round(width)));
};

/** `250.330`: the two widths. */
export const formatDocPanelsCookie = (w: DocPanelWidths): string => `${clampDocPanel("left", w.left)}.${clampDocPanel("right", w.right)}`;

export function parseDocPanelsCookie(value: string | null | undefined): DocPanelWidths {
  const m = value ? /^(\d{1,4})\.(\d{1,4})$/.exec(value) : null;
  if (!m) return DEFAULT_DOC_PANELS;
  return { left: clampDocPanel("left", Number(m[1])), right: clampDocPanel("right", Number(m[2])) };
}
