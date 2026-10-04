// Middle truncation of long row names (D-37, prototype nmSplit): the head may be cut with an ellipsis, the tail stays
// visible. The tail is the part from the last underscore when it is short, else the last five characters.

export function splitName(name: string): { head: string; tail: string } {
  if (name.length <= 14) return { head: name, tail: "" };
  const i = name.lastIndexOf("_");
  const tail = i > 3 && name.length - i <= 12 ? name.slice(i) : name.slice(-5);
  return { head: name.slice(0, name.length - tail.length), tail };
}
