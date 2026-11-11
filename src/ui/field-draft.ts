// A text field's draft (slice 13, D-66): what the person typed stays until it is saved or they drop it. The field is
// uncontrolled, so its text lives in the element and typing renders nothing; this module keeps the rest, without the
// DOM, so its rules have unit tests:
// - which stored value the element shows (`taken`): a fresh value replaces it only while the field has neither the
//   focus nor a draft (a text different from `taken`), and a text equal to the stored value ends the draft;
// - what leaving the field saves: a text different from the value on its way (`sent`) or, with nothing on its way,
//   from the stored value; so an Enter pressed again before an answer arrives does not send the same text twice and
//   get "Nothing to change." (F8);
// - a refusal (any kind, a cut included) keeps the text and forgets `sent`, so leaving the field again saves it;
// - a stored save, with the row's version its answer gives (fix/field-draft-after-undo): once the field is drawn with
//   that version or a newer one, still holds the text it sent and has no focus, it takes the stored value, whatever it
//   is (the command's trimmed form of the text, an undo, another person's write). A render whose value equals the text
//   is not needed: the page of the save may be drawn in one commit with a later one (an Undo pressed before it), and a
//   command may store the text in another form. A field given no version keeps the rules above only.

/** What a field does with a stored value that reaches it (a render with a new or the same `stored`). */
export type Take = "take" | "keep" | "end";

/**
 * What a save's answer says, as far as a field needs it: stored, refused, or not sent at all; with the row's new version
 * (`value.version` of a panel action's `Saved`, or `version` of a canvas save) where it gives one.
 */
export type SaveAnswer = { ok: boolean; code?: string; value?: unknown; version?: number } | boolean | null | undefined | void;

/** True when the answer says the value was stored; `undefined` when it says nothing (a save that answers nothing). */
export function storedBy(answer: SaveAnswer): boolean | undefined {
  if (answer === undefined || answer === null) return undefined;
  if (typeof answer === "boolean") return answer;
  return answer.ok;
}

/** The row's version a stored save's answer gives, or null when it gives none. */
export function versionBy(answer: SaveAnswer): number | null {
  if (!answer || typeof answer !== "object" || !answer.ok) return null;
  if (typeof answer.version === "number") return answer.version;
  const v = (answer.value as { version?: unknown } | null | undefined)?.version;
  return typeof v === "number" ? v : null;
}

export class FieldDraft {
  /** The stored value the element was last given (its `defaultValue` at mount, or a value written in later). */
  taken: string;
  /** The value of the newest save on its way, until it is stored or refused. */
  sent: string | null = null;
  /** Saves on their way. */
  private inflight = 0;
  /** Numbers the saves, so only the newest one's answer clears `sent`. */
  private started = 0;
  /** The text of the newest save sent. */
  private lastSent = "";
  /** The newest save, stored: its text and the row's version it wrote, until the field is drawn with that version. */
  private landed: { text: string; version: number } | null = null;

  constructor(stored: string) {
    this.taken = stored;
  }

  /** Whether the element's text is a draft: different from the stored value it was given. */
  hasDraft(text: string): boolean {
    return text !== this.taken;
  }

  /**
   * A stored value reaches the field: `end` (the text equals it: the draft ends, nothing to write), `keep` (the
   * field has the focus or a draft: the element keeps its text) or `take` (write `stored` into the element).
   */
  receive(stored: string, text: string, focused: boolean, version?: number | null): Take {
    if (this.settle(stored, version, text, focused)) return text === stored ? "end" : "take";
    // the save on its way is stored; with none on its way, a stored value that differs from it (the server trimmed it,
    // or a later write) is the one to compare with
    if (this.sent === stored || this.inflight === 0) this.sent = null;
    if (text === stored) {
      this.taken = stored;
      return "end";
    }
    if (focused || this.hasDraft(text)) return "keep";
    this.taken = stored;
    return "take";
  }

  /** Whether leaving the field with `value` (already trimmed or parsed by the field) saves it. */
  shouldSave(value: string, stored: string): boolean {
    return value !== (this.sent ?? stored);
  }

  /** A save of `value` is sent; returns its number for `answered`. */
  send(value: string): number {
    this.sent = value;
    this.lastSent = value;
    this.landed = null;
    this.inflight++;
    return ++this.started;
  }

  /**
   * The save numbered `n` answered: on a refusal the text stays and leaving the field saves it again. The newest save,
   * stored with the row's `version`, is remembered for `settle`.
   */
  answered(n: number, stored: boolean | undefined, version?: number | null): void {
    this.inflight = Math.max(0, this.inflight - 1);
    if (n !== this.started) return;
    if (stored === false) this.sent = null;
    if (stored === true && typeof version === "number") this.landed = { text: this.lastSent, version };
  }

  /**
   * The field shows the row's `version` with the value `stored`: true when the newest stored save is in it (that
   * version or a newer one) while the element still holds the text it sent and has no focus. The draft then ends on
   * `stored` and the field writes it into the element. Text typed since that save ends the rule (the draft stays, as
   * any draft); with the focus it waits for the field to be left (`commit`). Without a version (the field's or the
   * answer's), never.
   */
  settle(stored: string, version: number | null | undefined, text: string, focused: boolean): boolean {
    const l = this.landed;
    if (!l || version === null || version === undefined || version < l.version) return false;
    if (text !== l.text) {
      this.landed = null;
      return false;
    }
    if (focused) return false;
    this.landed = null;
    this.taken = stored;
    if (this.inflight === 0) this.sent = null;
    return true;
  }

  /** The element was given `stored` by the field itself (an empty required name put back, Escape). */
  reset(stored: string): void {
    this.taken = stored;
    this.landed = null;
    if (this.inflight === 0) this.sent = null;
  }
}

/**
 * A choice field (a select, a check box) keeps no draft (slice 13, R4): it shows the choice from its click until the
 * stored value changes or the save is refused, then the stored value. `chosen` remembers the stored value it was made
 * on, so a fresh page with any newer stored value replaces it without an effect.
 */
export interface Chosen<T> {
  value: T;
  on: T;
}

export const choiceShown = <T>(chosen: Chosen<T> | null, stored: T): T => (chosen && Object.is(chosen.on, stored) ? chosen.value : stored);

/**
 * Whether a choice is stored (slice 15b): the stored value came to equal it. `useChoice` then forgets it, so a later
 * change back to the value it was made on (an undo) shows as stored instead of the old choice again.
 */
export const choiceLanded = <T>(chosen: Chosen<T>, stored: T): boolean => !Object.is(chosen.on, chosen.value) && Object.is(stored, chosen.value);
