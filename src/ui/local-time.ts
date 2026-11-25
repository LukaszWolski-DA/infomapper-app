// A time in the browser's time zone (slice 36, step 1's F7; slice 35's rule, D-87): "yyyy-mm-dd hh:mm", known only once
// the page runs in the browser. Until then (the server's HTML, hydration) the formatter answers "", never a time in the
// server's zone. And the document page's token (F7): a tree built on the server carries a baseline's time as
// `timeToken(iso)`, which `localTimes` turns into the browser's minute before the pages are laid out.

const two = (n: number) => String(n).padStart(2, "0");

/** "yyyy-mm-dd hh:mm" in this runtime's time zone. */
export function minuteText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const OPEN = "⟦t:";
const CLOSE = "⟧";
const TOKENS = new RegExp(`${OPEN}([^${CLOSE}]+)${CLOSE}`, "g");

/** A time the server leaves for the browser to write (the document page). */
export const timeToken = (iso: string): string => `${OPEN}${iso}${CLOSE}`;

/** A text with every time token written as the browser's minute. */
export const localTimes = (text: string): string => text.replace(TOKENS, (_, iso: string) => minuteText(iso));

/** Every text node of a copy of the document with its tokens written (the cover's model state). */
export function localTimesIn(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue?.includes(OPEN)) n.nodeValue = localTimes(n.nodeValue);
}
