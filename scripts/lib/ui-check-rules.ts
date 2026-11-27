// Slice 37 (S37-02, S37-03): the check script's rules, pure. `scripts/ui-check.ts` collects every control of a screen in
// the browser (its box, the part of it its scrolling ancestors show, its look) and these functions decide what is wrong
// and group the controls into kinds. Tested in tests/ui-check-rules.test.ts.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** What a control is for the report: a button (any `<button>`, `role=button`, a link drawn as one), a field, a drop-down. */
export type ControlKind = "button" | "link" | "tab" | "field" | "select" | "check";

export interface ControlLook {
  readonly height: number;
  readonly fontSize: number;
  readonly radius: number;
  readonly borderWidth: number;
  readonly borderColor: string;
}

export interface Control {
  readonly id: number;
  readonly kind: ControlKind;
  /** `button`, `a`, `input[type=text]`, `select`, … */
  readonly tag: string;
  readonly testId: string | null;
  readonly text: string;
  readonly rect: Box;
  /** The part its scrolling or clipping ancestors (not the page itself) show; null when none of it shows. */
  readonly visible: Box | null;
  /** Ids of the controls it lies inside in the DOM. */
  readonly inside: readonly number[];
  /** A link inside a sentence (WCAG 2.5.8's inline exception). */
  readonly inline: boolean;
  /** Why the rules skip it (the canvas's cards, a generated document), or null. */
  readonly exempt: string | null;
  readonly look: ControlLook;
  /** How far its own content runs past its box while it does not clip (`scrollWidth - clientWidth`, overflow visible). */
  readonly spill: number;
  /** The box of its own text (a DOM range over it), or null without text. */
  readonly textBox: Box | null;
  /** What lies on top at its centre: itself (null), another control (its id) or something else, such as a panel that
   *  slides over the page on a narrow screen ("other"). */
  readonly coveredBy: number | "other" | null;
  /** In a pop-over that lies over the page (it or an ancestor is `position: fixed`: the toolbox, the picker, a menu). */
  readonly floating?: boolean;
}

export interface Overlap {
  readonly a: Control;
  readonly b: Control;
  readonly w: number;
  readonly h: number;
}

/** Overlap beyond this many px in both directions counts (S37-03). */
export const OVERLAP_PX = 2;
/** WCAG 2.2, 2.5.8: a target at least 24 × 24 px, or a 24 px circle that touches no other target. */
export const TARGET_PX = 24;

const intersect = (a: Box, b: Box): Box | null => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
  return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null;
};

const checked = (cs: readonly Control[]) => cs.filter((c) => c.visible !== null && c.exempt === null);

/** Controls that cover one another by more than `OVERLAP_PX` in both directions, one not inside the other. */
export function overlaps(controls: readonly Control[], tolerance = OVERLAP_PX): Overlap[] {
  const cs = checked(controls);
  const out: Overlap[] = [];
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i]!, b = cs[j]!;
      if (a.inside.includes(b.id) || b.inside.includes(a.id)) continue;
      // a control under a panel or a dialog lying over the page is not seen, so it collides with nothing
      if (a.coveredBy === "other" || b.coveredBy === "other") continue;
      // a pop-over over the page covers what it lies on: the covered control below it is not seen (slice 37, step 3b)
      if (!!a.floating !== !!b.floating && (a.floating ? b : a).coveredBy !== null) continue;
      const box = intersect(a.visible!, b.visible!);
      if (box && box.w > tolerance && box.h > tolerance) out.push({ a, b, w: Math.round(box.w), h: Math.round(box.h) });
    }
  }
  return out;
}

/** Controls whose text runs out of their own box by more than `OVERLAP_PX` (the left panel's "SourcesRequirements"). */
export function spilling(controls: readonly Control[], tolerance = OVERLAP_PX): Control[] {
  return checked(controls).filter((c) => c.spill > tolerance);
}

/** Neighbouring controls' words closer than this read as one (S37-03: "SourcesRequirements"). */
export const WORD_GAP_PX = 8;

export interface Crowded {
  readonly a: Control;
  readonly b: Control;
  readonly gap: number;
}

/** Two controls side by side on one line whose texts are less than `WORD_GAP_PX` apart. */
export function crowdedTexts(controls: readonly Control[], min = WORD_GAP_PX): Crowded[] {
  // slice 38: a control under a panel or a dialog is not seen, as for overlaps
  const cs = checked(controls).filter((c) => c.textBox !== null && c.kind !== "field" && c.kind !== "select" && c.coveredBy !== "other");
  const out: Crowded[] = [];
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const [a, b] = cs[i]!.textBox!.x <= cs[j]!.textBox!.x ? [cs[i]!, cs[j]!] : [cs[j]!, cs[i]!];
      if (a.inside.includes(b.id) || b.inside.includes(a.id)) continue;
      const ta = a.textBox!, tb = b.textBox!;
      const sameLine = Math.min(ta.y + ta.h, tb.y + tb.h) - Math.max(ta.y, tb.y) > Math.min(ta.h, tb.h) / 2;
      const gap = tb.x - (ta.x + ta.w);
      if (sameLine && gap > -OVERLAP_PX && gap < min) out.push({ a, b, gap: Math.round(gap * 10) / 10 });
    }
  }
  return out;
}

/** Controls whose shown part runs past the screen's left or right edge. */
export function pastTheEdge(controls: readonly Control[], viewportWidth: number): Control[] {
  return checked(controls).filter((c) => c.visible!.x < -1 || c.visible!.x + c.visible!.w > viewportWidth + 1);
}

export interface SmallTarget {
  readonly control: Control;
  /** True when WCAG's spacing exception holds: its 24 px circle touches no other target or circle. */
  readonly spaced: boolean;
}

const isTarget = (c: Control) => c.kind !== "field" && c.kind !== "select" && !c.inline;
const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const distanceTo = (p: { x: number; y: number }, b: Box) => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.w)), Math.max(b.y - p.y, 0, p.y - (b.y + b.h)));

/** Targets smaller than 24 × 24 px (S37-03), each with WCAG's spacing exception decided. */
export function smallTargets(controls: readonly Control[]): SmallTarget[] {
  const targets = checked(controls).filter(isTarget);
  // slice 38: a target under a panel or a dialog is not seen, so it is not judged (its neighbours still are, by it)
  const small = targets.filter((c) => c.coveredBy !== "other" && (c.rect.w < TARGET_PX - 0.5 || c.rect.h < TARGET_PX - 0.5));
  return small.map((control) => {
    const p = centre(control.rect);
    const spaced = targets.every((t) => {
      if (t === control || t.inside.includes(control.id) || control.inside.includes(t.id)) return true;
      if (distanceTo(p, t.rect) < TARGET_PX / 2) return false;
      if (small.includes(t)) {
        const q = centre(t.rect);
        return Math.hypot(p.x - q.x, p.y - q.y) >= TARGET_PX;
      }
      return true;
    });
    return { control, spaced };
  });
}

/** What the page reads of an element whose own text may be cut. */
export interface TextBox {
  readonly overflowX: string;
  readonly textOverflow: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

/** Text cut without an ellipsis: clipped (`overflow` hidden or clip), wider than its box, and no `text-overflow: ellipsis`. */
export const isCutWithoutEllipsis = (t: TextBox): boolean =>
  (t.overflowX === "hidden" || t.overflowX === "clip") && t.scrollWidth > t.clientWidth + 1 && t.textOverflow !== "ellipsis";

const px = (n: number) => Math.round(n * 2) / 2;

/** A control's kind for the inventory: what it is, and its height, font size, radius and edge. */
export function kindKey(c: Control): string {
  const l = c.look;
  const edge = l.borderWidth > 0 ? `${px(l.borderWidth)}px ${l.borderColor}` : "none";
  return `${c.kind} · h ${px(l.height)} · font ${px(l.fontSize)} · radius ${px(l.radius)} · edge ${edge}`;
}

export interface KindCount {
  readonly key: string;
  readonly kind: ControlKind;
  readonly count: number;
  readonly example: string;
}

/** The controls grouped into kinds, most frequent first; exempt controls and those not shown are left out. */
export function kinds(controls: readonly Control[]): KindCount[] {
  const m = new Map<string, { kind: ControlKind; count: number; example: string }>();
  for (const c of checked(controls)) {
    const key = kindKey(c);
    const k = m.get(key) ?? { kind: c.kind, count: 0, example: describe(c) };
    k.count++;
    m.set(key, k);
  }
  return [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** A control in one line: its test id, else its tag and a short text. */
export function describe(c: Control): string {
  const text = c.text.replace(/\s+/g, " ").trim().slice(0, 40);
  return `${c.testId ? `[${c.testId}]` : c.tag}${text ? ` "${text}"` : ""}`;
}

/** The report's groups (S37-02 counts the first three). */
export const GROUPS: Readonly<Record<"buttons" | "fields" | "drop-downs" | "check boxes" | "links", readonly ControlKind[]>> = {
  buttons: ["button", "tab"],
  fields: ["field"],
  "drop-downs": ["select"],
  "check boxes": ["check"],
  links: ["link"],
};
