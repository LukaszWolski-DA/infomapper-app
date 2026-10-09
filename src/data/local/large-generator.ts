// The canvas spike's synthetic data set, copied from spikes/canvas-react-flow/src/data/generate.ts (the spike stays
// untouched). Same seed, same random sequence, same positions, so the C-01 measurement can be repeated inside the
// application (slice 1a, S1A-14). Only types and index access are adapted to this project's compiler settings.
//
//  - 60 source tables (8–40 columns) + 40 entities (5–25 attributes) = 100 cards
//  - 1 extra entity with 200 attributes (tall card test)
//  - 300 mappings column → attribute
//  - 40 relationships between entities, with cardinalities and labels
//  - 8 frames holding 6–15 cards each (stored as free frames by seed-large.ts, slice 2b)

export const CARD_W = 256;
const HEAD_H = 54;
const ROW_H = 26;
const BODY_PAD = 6;

export type Kind = "src" | "ent";

export interface GenRow {
  id: string;
  name: string;
  dataType: string;
  pk?: boolean;
  fk?: boolean;
}

export interface GenCard {
  id: string;
  kind: Kind;
  name: string;
  /** source: "System / db.schema"; entity: stereotype */
  sub: string;
  rows: GenRow[];
  x: number;
  y: number;
  w: number;
  frameId?: string;
  color?: string;
}

export interface GenMapping {
  id: string;
  srcCard: string;
  column: string;
  entCard: string;
  attribute: string;
}

export interface GenRelationship {
  id: string;
  from: string;
  to: string;
  fromMin: 0 | 1;
  fromMax: "1" | "N";
  toMin: 0 | 1;
  toMax: "1" | "N";
  label?: string;
}

export interface GenFrame {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cards: string[];
}

export interface GenDataSet {
  seed: number;
  cards: GenCard[];
  mappings: GenMapping[];
  relationships: GenRelationship[];
  frames: GenFrame[];
}

const cardHeight = (rows: number) => HEAD_H + BODY_PAD * 2 + Math.max(1, rows) * ROW_H;

/* ---------- seeded RNG (mulberry32) ---------- */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
  const shuffle = <T>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    }
    return xs;
  };
  return { next, int, pick, shuffle };
}

/* ---------- vocabulary ---------- */
const SYSTEMS = ["CRM", "ERP", "Billing", "WMS", "HR", "Web Shop"];
const DBS = ["prod", "core", "dwh_stage", "ops"];
const SCHEMAS = ["dbo", "sales", "finance", "logistics", "people"];
const NOUNS = [
  "customer", "account", "order", "invoice", "product", "contract", "address", "payment",
  "shipment", "employee", "supplier", "warehouse", "price", "campaign", "ticket", "store",
  "region", "currency", "subscription", "device", "claim", "policy", "vendor", "lead",
];
const QUAL = ["line", "hist", "status", "detail", "map", "ext", "snapshot", "log", "type", "group"];
const COL_PARTS = [
  "id", "code", "name", "desc", "amount", "qty", "date", "ts", "flag", "status", "type",
  "email", "phone", "city", "zip", "country", "created", "updated", "valid_from", "valid_to",
  "number", "ref", "source", "owner", "channel", "segment", "rate", "total", "net", "gross",
];
const COL_TYPES = ["VARCHAR(50)", "VARCHAR(255)", "INT", "BIGINT", "DATE", "TIMESTAMP", "DECIMAL(18,2)", "CHAR(1)", "BOOLEAN"];
export const ATTR_TYPES = ["String", "Integer", "Date", "Timestamp", "Decimal", "Boolean", "Code"] as const;
export const STEREOS = ["Hub", "Satellite", "Link", "Reference", "Dimension", "Fact"] as const;
const VERBS = ["places", "owns", "belongs to", "contains", "is billed by", "references", "ships to", "is managed by", "covers", "includes"];
export const ENT_COLORS = ["#3346C4", "#0B8A72", "#A0660F", "#9B3FB5", "#C2410C", "#2E7DB5", "#5E7A1E", "#B5306A"];
const FRAME_COLORS = ["#3346C4", "#0B8A72", "#A0660F", "#9B3FB5", "#C2410C", "#2E7DB5", "#5E7A1E", "#B5306A"];
export const FRAME_NAMES = ["Customer", "Sales", "Finance", "Logistics", "Product", "People", "Marketing", "Service"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const title = (s: string) => s.split(/[_ ]/).map(cap).join(" ");

export function generate(seed = 20261002): GenDataSet {
  const r = rng(seed);
  const cards: GenCard[] = [];

  /* sources */
  for (let i = 0; i < 60; i++) {
    const noun = r.pick(NOUNS);
    const name = `${noun}_${r.pick(QUAL)}_${i}`;
    const n = r.int(8, 40);
    const used = new Set<string>();
    const rows: GenRow[] = [];
    for (let c = 0; c < n; c++) {
      let nm = c === 0 ? `${noun}_id` : `${r.pick(NOUNS)}_${r.pick(COL_PARTS)}`;
      while (used.has(nm)) nm = `${nm}_${c}`;
      used.add(nm);
      rows.push({ id: `src:${i}:c${c}`, name: nm, dataType: c === 0 ? "BIGINT" : r.pick(COL_TYPES), pk: c === 0, fk: c > 0 && nm.endsWith("_id") });
    }
    cards.push({ id: `src:${i}`, kind: "src", name, rows, x: 0, y: 0, w: CARD_W, sub: `${r.pick(SYSTEMS)} / ${r.pick(DBS)}.${r.pick(SCHEMAS)}` });
  }

  /* entities (40 normal + 1 with 200 attributes) */
  const makeEntity = (i: number, n: number, name: string) => {
    const used = new Set<string>();
    const rows: GenRow[] = [];
    for (let a = 0; a < n; a++) {
      let nm = a === 0 ? `${name} Key` : title(`${r.pick(NOUNS)} ${r.pick(COL_PARTS)}`);
      while (used.has(nm)) nm = `${nm} ${a}`;
      used.add(nm);
      rows.push({ id: `ent:${i}:a${a}`, name: nm, dataType: a === 0 ? "Integer" : r.pick(ATTR_TYPES), pk: a === 0 });
    }
    cards.push({ id: `ent:${i}`, kind: "ent", name, rows, x: 0, y: 0, w: CARD_W, sub: r.pick(STEREOS), color: r.pick(ENT_COLORS) });
  };
  for (let i = 0; i < 40; i++) makeEntity(i, r.int(5, 25), `${title(r.pick(NOUNS))} ${title(r.pick(QUAL))} ${i}`);
  const BIG = "ent:40";
  makeEntity(40, 200, "Wide Customer Profile");

  const byId = new Map(cards.map((c) => [c.id, c]));
  const srcCards = cards.filter((c) => c.kind === "src");
  const entCards = cards.filter((c) => c.kind === "ent" && c.id !== BIG);

  /* mappings: 300 unique column → attribute pairs; 25 land on the 200-row card */
  const mappings: GenMapping[] = [];
  const seen = new Set<string>();
  const addMap = (s: GenCard, e: GenCard, colIdx?: number, attrIdx?: number) => {
    const col = s.rows[colIdx ?? r.int(0, s.rows.length - 1)]!;
    const attr = e.rows[attrIdx ?? r.int(0, e.rows.length - 1)]!;
    const key = col.id + "|" + attr.id;
    if (seen.has(key)) return false;
    seen.add(key);
    mappings.push({ id: `m${mappings.length}`, srcCard: s.id, column: col.id, entCard: e.id, attribute: attr.id });
    return true;
  };
  const big = byId.get(BIG)!;
  for (let k = 0; k < 25; k++) while (!addMap(r.pick(srcCards), big, undefined, r.int(0, 199)));
  while (mappings.length < 300) addMap(r.pick(srcCards), r.pick(entCards));

  /* relationships: 40 between entities */
  const allEnt = cards.filter((c) => c.kind === "ent");
  const relationships: GenRelationship[] = [];
  while (relationships.length < 40) {
    const a = r.pick(allEnt), b = r.pick(allEnt);
    if (a === b) continue;
    relationships.push({
      id: `r${relationships.length}`, from: a.id, to: b.id,
      fromMin: r.next() < 0.5 ? 0 : 1, fromMax: r.next() < 0.3 ? "N" : "1",
      toMin: r.next() < 0.5 ? 0 : 1, toMax: r.next() < 0.7 ? "N" : "1",
      label: r.next() < 0.75 ? r.pick(VERBS) : undefined,
    });
  }

  /* frames: 8 frames with 6–15 cards each, disjoint; big card stays free */
  const pool = r.shuffle(cards.filter((c) => c.id !== BIG).map((c) => c.id));
  const sizes = Array.from({ length: 8 }, () => r.int(6, 15));
  while (sizes.reduce((a, b) => a + b, 0) > 88) {
    const i = sizes.indexOf(Math.max(...sizes));
    sizes[i]!--;
  }
  const frames: GenFrame[] = [];
  let cursor = 0;
  sizes.forEach((n, i) => {
    const ids = pool.slice(cursor, cursor + n);
    cursor += n;
    ids.sort((a, b) => Number(b.startsWith("src")) - Number(a.startsWith("src")));
    frames.push({ id: `f${i}`, name: FRAME_NAMES[i]!, color: FRAME_COLORS[i]!, x: 0, y: 0, w: 0, h: 0, cards: ids });
  });
  const freeIds = pool.slice(cursor);

  /* layout: masonry columns inside each frame; frames on a 4 × 2 grid */
  const GAP_X = 70, GAP_Y = 36, FPAD = 36;
  const masonry = (ids: string[], cols: number, ox: number, oy: number) => {
    const colY: number[] = new Array(cols).fill(0);
    for (const id of ids) {
      const c = byId.get(id)!;
      const k = colY.indexOf(Math.min(...colY));
      c.x = ox + k * (CARD_W + GAP_X);
      c.y = oy + colY[k]!;
      colY[k]! += cardHeight(c.rows.length) + GAP_Y;
    }
    return { w: cols * CARD_W + (cols - 1) * GAP_X, h: Math.max(...colY) - GAP_Y };
  };

  const FRAME_GAP = 160;
  let fy = 0;
  for (let row = 0; row < 2; row++) {
    let fx = 0, rowH = 0;
    for (let col = 0; col < 4; col++) {
      const f = frames[row * 4 + col]!;
      const cols = Math.min(4, Math.ceil(f.cards.length / 3));
      const box = masonry(f.cards, cols, fx + FPAD, fy + FPAD);
      f.x = fx; f.y = fy; f.w = box.w + FPAD * 2; f.h = box.h + FPAD * 2;
      f.cards.forEach((id) => (byId.get(id)!.frameId = f.id));
      fx += f.w + FRAME_GAP;
      rowH = Math.max(rowH, f.h);
    }
    fy += rowH + FRAME_GAP;
  }
  const framesRight = Math.max(...frames.map((f) => f.x + f.w));
  masonry(freeIds, 6, 0, fy);
  big.x = framesRight + FRAME_GAP;
  big.y = 0;

  return { seed, cards, mappings, relationships, frames };
}
