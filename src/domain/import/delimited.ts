// Delimited text for the import standard (slice 7a, prototype `parseDelimited`, `toCSV`): the delimiter (comma,
// semicolon or tab) is the one that occurs most often outside quotes in the first line, a comma on a tie; fields may
// be quoted, with a doubled quote inside; rows may end in \n, \r\n or \r. Blank rows are dropped. Each row keeps the
// line it starts on, so warnings name the line a person sees in an editor.

export type Delimiter = "," | ";" | "\t";

export interface DelimitedRow {
  cells: string[];
  /** 1-based line of the file where the row starts. */
  line: number;
}

export function detectDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\n" || ch === "\r") {
      if (!quoted) break;
    } else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as Delimiter]++;
  }
  let best: Delimiter = ",";
  for (const d of [";", "\t"] as const) if (counts[d] > counts[best]) best = d;
  return best;
}

export function parseDelimited(text: string): { rows: DelimitedRow[]; delimiter: Delimiter } {
  const delimiter = detectDelimiter(text);
  const rows: DelimitedRow[] = [];
  const n = text.length;
  let cells: string[] = [];
  let line = 1;
  let rowLine = 1;
  let i = 0;
  const endRow = () => {
    if (cells.some((c) => c.trim() !== "")) rows.push({ cells, line: rowLine });
    cells = [];
  };
  while (i <= n) {
    // one field
    let value: string;
    if (text[i] === '"') {
      let j = i + 1;
      let out = "";
      for (;;) {
        const q = text.indexOf('"', j);
        if (q === -1) {
          out += text.slice(j);
          j = n;
          break;
        }
        out += text.slice(j, q);
        if (text[q + 1] === '"') {
          out += '"';
          j = q + 2;
        } else {
          j = q + 1;
          break;
        }
      }
      for (let k = i; k < j; k++) if (text[k] === "\n" || (text[k] === "\r" && text[k + 1] !== "\n")) line++;
      // anything between the closing quote and the delimiter belongs to the field, as in the prototype
      let k = j;
      while (k < n && text[k] !== delimiter && text[k] !== "\n" && text[k] !== "\r") k++;
      value = out + text.slice(j, k);
      i = k;
    } else {
      let k = i;
      while (k < n && text[k] !== delimiter && text[k] !== "\n" && text[k] !== "\r") k++;
      value = text.slice(i, k);
      i = k;
    }
    cells.push(value);
    if (i >= n) {
      endRow();
      break;
    }
    const ch = text[i];
    if (ch === delimiter) {
      i++;
      continue;
    }
    // a row ends
    i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
    line++;
    endRow();
    rowLine = line;
    if (i === n) break;
  }
  return { rows, delimiter };
}

/** CSV with commas; a field with a comma, semicolon, tab, quote or line break is quoted. */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const field = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(field).join(",")).join("\n");
}
