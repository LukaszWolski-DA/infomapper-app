// Where the canvas toolbar's groups move into “More” (slice 38, B2; slice 6a's idea): by the room the toolbar's strip
// offers it (its content width: the canvas's width less 12 px each side), not by the window's width. A plain module, so
// the canvas page (a server component) and `MoreTools` (a client one) share them. Each group's wrapper in the toolbar
// carries `inBar`, a container query on the strip (`@container` in `CanvasToolbar`), so the first paint is right and
// nothing is set on the page (AD-24 rule 4). “More”'s items live in a portal no container query reaches: they compare
// `at` with the strip's width as `toolbarRoom` reports it (`inMenu`).
//
// The groups leave in slice 6a's order: the names first, then Focus, Changes and the notation, then the four tools; the
// layer switch, zoom and “More” itself stay. Each `at` is the toolbar's width with that group and every group before it
// in the bar (measured in step 2 as an editor, every tool shown: 631 px with everything, 591 without “Names ▾” and with
// “More”, 440 without Focus, Changes and the notation, 313 without the tools), plus 4 px: below it the group goes. At
// 1,280 px with both panels at their default widths (264 and 340 px) the strip offers 652 px, and every group stays
// (21 px to spare). Below 313 px (a phone) the toolbar scrolls sideways.

export interface MoreGroup {
  /** The strip's content width (px) from which the group stays in the toolbar. */
  readonly at: number;
  /** On the group's wrapper in the toolbar: hidden below `at` (a container query; the literal, for Tailwind's scanner). */
  readonly inBar: string;
}

/** The names' “Names ▾” (slice 11's check boxes). “More” itself shows below this width. */
export const MORE_NAMES: MoreGroup = { at: 635, inBar: "@max-[635px]:hidden" };
/** Focus, the Changes view and the notation switch. */
export const MORE_FOCUS: MoreGroup = { at: 595, inBar: "@max-[595px]:hidden" };
/** The Hand, Entity, Note and Frame tools. */
export const MORE_TOOLS: MoreGroup = { at: 444, inBar: "@max-[444px]:hidden" };
/** “More”'s button: shown only while a group is in it. */
export const MORE_BUTTON = "@min-[635px]:hidden";

/** Whether a group is in “More” at the strip's width (`null` before the first report: every group in the toolbar). */
export const inMore = (group: MoreGroup, room: number | null): boolean => room !== null && room < group.at;
