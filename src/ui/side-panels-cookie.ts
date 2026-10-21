// Where the side panels' layout is kept (slice 5a, P1): a preference of one person, in their browser. It is a cookie
// the browser writes (never the server), so the server can draw the panels as they were left, from the first paint,
// without a flash or a second canvas resize. A missing or unreadable cookie means the defaults: both panels shown.

/** The prototype's limits and defaults (`PANEL`). */
export const PANEL_LIMITS = {
  left: { min: 200, max: 520, def: 264 },
  right: { min: 280, max: 640, def: 340 },
} as const;

export type PanelSide = keyof typeof PANEL_LIMITS;

export interface SidePanelsState {
  left: boolean;
  right: boolean;
  /** The panels' widths in px, kept while a panel is hidden. */
  leftWidth: number;
  rightWidth: number;
}

export const DEFAULT_SIDE_PANELS: SidePanelsState = {
  left: true,
  right: true,
  leftWidth: PANEL_LIMITS.left.def,
  rightWidth: PANEL_LIMITS.right.def,
};

/** One cookie per person. */
export const sidePanelsCookieName = (userId: string): string => `im-panels.${userId}`;

/** A year, like the other preferences. */
export const SIDE_PANELS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const clampWidth = (side: PanelSide, width: number): number => {
  const { min, max } = PANEL_LIMITS[side];
  return Math.min(max, Math.max(min, Math.round(width)));
};

/** `l1.r0.264.340`: left shown, right hidden, the two widths. */
export const formatSidePanelsCookie = (s: SidePanelsState): string =>
  `l${s.left ? 1 : 0}.r${s.right ? 1 : 0}.${clampWidth("left", s.leftWidth)}.${clampWidth("right", s.rightWidth)}`;

export function parseSidePanelsCookie(value: string | null | undefined): SidePanelsState {
  const m = value ? /^l([01])\.r([01])\.(\d{1,4})\.(\d{1,4})$/.exec(value) : null;
  if (!m) return DEFAULT_SIDE_PANELS;
  return {
    left: m[1] === "1",
    right: m[2] === "1",
    leftWidth: clampWidth("left", Number(m[3])),
    rightWidth: clampWidth("right", Number(m[4])),
  };
}
