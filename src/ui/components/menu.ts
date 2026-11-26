// Slice 37 (S37-02, step 3b): the look of a menu and of a pop-over list (the toolbox, the picker, every DropdownMenu
// with its own items). A pop-over: radius 12, a hairline and `shadow-pop`, 4 px inside; an item: radius 8 in it, the
// row's text in `body`, highlighted on `hover`; at least 28 px tall (`MENU_ITEM` keeps today's 34 px rows). A section's
// name is `small` in `ink-3`; a kind's head (the toolbox's, the picker's title) is the uppercase `label`. Plain classes,
// so Radix's items and the toolbox's own buttons draw the same row.

/** The pop-over's box: a menu's content, the toolbox, the picker. */
export const MENU_CONTENT = "rounded-lg border border-im-line bg-im-surface p-1 text-body text-im-ink shadow-pop"

/** A menu's item: Radix's `DropdownMenuItem` (highlighted) or a plain `<button role="menuitem">` (hovered, focused). */
export const MENU_ITEM =
  "flex min-h-control-sm cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-left outline-none hover:bg-im-hover focus:bg-im-hover focus-visible:bg-im-hover data-[highlighted]:bg-im-hover disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent data-[disabled]:pointer-events-none data-[disabled]:opacity-45"

/** A section's name inside a menu ("Background", a concept's name). */
export const MENU_LABEL = "px-2.5 pb-1 pt-1.5 text-small font-normal text-im-ink-3"

/** A kind's head in a pop-over list (the toolbox's groups, the picker's title): the uppercase label. */
export const MENU_HEAD = "truncate px-2 pb-0.5 pt-1.5 text-label uppercase text-im-ink-3"

/** The line between a menu's groups. */
export const MENU_SEPARATOR = "my-1 h-px border-0 bg-im-line"
