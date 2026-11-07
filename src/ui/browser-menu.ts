// Where the browser's own context menu stays (slice 16, item 7, D-71): text fields and selects (paste, spelling), the
// description editor (`contenteditable`), links (open in a new tab) and a right click on selected text (copy).
// Everywhere else in the app it is cancelled: the browser's Back and Reload break the app's own navigation. One rule for
// the document's listener (`NoBrowserMenu`), the canvas's toolbox gesture and the toolbox itself. Firefox opens its menu
// on Shift+right-click whatever a page does.

const KEEPS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], a[href]';

/** Whether a `contextmenu` event should show the browser's own menu. */
export function keepsBrowserMenu(event: { target: EventTarget | null }): boolean {
  const target = event.target;
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  if (el.closest(KEEPS)) return true;
  const selection = typeof window === "undefined" ? null : window.getSelection();
  return !!selection && !selection.isCollapsed && selection.toString().trim() !== "" && selection.containsNode(el, true);
}
