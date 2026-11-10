// Entity stereotypes (slice 24, D-79; prototype `CONV.st`, `stName`, `stDef`, `stSnake`): the workspace's list of what an
// entity is in the model. Entities keep a stereotype's code, never its name, so a rename changes no entity.
//   The five built-in ones have fixed codes and are never removed (`object` is every new entity's and every fact's and
// dimension's, C-5); own ones have a code too, required, set when they are added and never changed.
//   Names and codes are compared as D-78 compares classifications (`normClassification`: case, spaces, `_`, `-` and `/`
// ignored), in either direction (F5): a name is refused when it is another live stereotype's name or any row's code,
// removed and deleted ones included; a code when it is any row's code or a live stereotype's name. A row's own code never
// blocks its own name. A removed own one and an undone add are soft-deleted rows, so a code is never given twice (F4).
//   Built-in texts (Appendix A): a name and a definition per documentation language; a workspace gets them in its
// language when it is created, and a later change of the language renames nothing.
//   One write rule (F1, Łukasz): every live entity's code is a live stereotype of its workspace. The domain is its only
// keeper in the local adapter (no foreign key that is not an id there); the SQL migration adds the composite key.

import type { CommandContext, Write } from "../changes";
import type { Uuid } from "../ids";
import type { DocLanguage, Entity, Stereotype } from "../types";
import { normClassification } from "./classifications";

/** The built-in codes, in the list's order. */
export const BUILTIN_STEREOTYPE_CODES = ["object", "link", "dictionary", "context", "informative"] as const;
export type BuiltinStereotypeCode = (typeof BUILTIN_STEREOTYPE_CODES)[number];

/** A new entity's stereotype, and every fact's and dimension's (C-5). */
export const DEFAULT_STEREOTYPE: BuiltinStereotypeCode = "object";

const BUILTIN_CODES: ReadonlySet<string> = new Set(BUILTIN_STEREOTYPE_CODES);
export const isBuiltinStereotypeCode = (code: string): code is BuiltinStereotypeCode => BUILTIN_CODES.has(code);

export interface StereotypeText {
  name: string;
  definition: string;
}

/** The built-in names and definitions per documentation language (PRD Appendix A; the German texts are to be reviewed). */
export const BUILTIN_STEREOTYPE_TEXTS: Readonly<Record<DocLanguage, Readonly<Record<BuiltinStereotypeCode, StereotypeText>>>> = {
  en: {
    object: { name: "Object", definition: "A business thing with its own identity and life cycle: customer, product, order." },
    link: { name: "Link", definition: "Connects objects and takes its identity from them, e.g. an order line." },
    dictionary: { name: "Dictionary", definition: "A list of codes and their meanings (reference data)." },
    context: { name: "Context", definition: "Describes another object in a given context or over time, e.g. a role or a changing set of attributes." },
    informative: { name: "Informative", definition: "Derived or reported information, not a business object of its own." },
  },
  pl: {
    object: { name: "Obiekt", definition: "Rzecz biznesowa z własną tożsamością i cyklem życia: klient, produkt, zamówienie." },
    link: { name: "Powiązanie", definition: "Łączy obiekty i bierze od nich tożsamość, np. pozycja zamówienia." },
    dictionary: { name: "Słownik", definition: "Lista kodów i ich znaczeń (dane referencyjne)." },
    context: { name: "Kontekst", definition: "Opisuje inny obiekt w danym kontekście lub w czasie, np. rolę albo zmieniający się zestaw atrybutów." },
    informative: { name: "Informacyjna", definition: "Informacja wyliczana lub raportowa, nie samodzielny obiekt biznesowy." },
  },
  de: {
    object: { name: "Objekt", definition: "Ein Geschäftsobjekt mit eigener Identität und eigenem Lebenszyklus: Kunde, Produkt, Bestellung." },
    link: { name: "Verknüpfung", definition: "Verbindet Objekte und erhält seine Identität von ihnen, z. B. eine Bestellposition." },
    dictionary: { name: "Wörterbuch", definition: "Eine Liste von Codes und ihren Bedeutungen (Referenzdaten)." },
    context: { name: "Kontext", definition: "Beschreibt ein anderes Objekt in einem Kontext oder über die Zeit, z. B. eine Rolle oder wechselnde Attribute." },
    informative: { name: "Informativ", definition: "Abgeleitete oder berichtete Information, kein eigenes Geschäftsobjekt." },
  },
};

export const builtinStereotypeText = (code: BuiltinStereotypeCode, language: DocLanguage): StereotypeText => BUILTIN_STEREOTYPE_TEXTS[language][code];

/** One row of the list, made with the given id and audit values. */
export function stereotypeRow(
  base: Pick<Stereotype, "id" | "workspace_id" | "created_at" | "created_by">,
  values: Pick<Stereotype, "code" | "name" | "definition" | "origin">,
): Stereotype {
  return {
    ...base,
    version: 1,
    updated_at: base.created_at,
    updated_by: base.created_by,
    deleted_at: null,
    ...values,
    name_key: normClassification(values.name),
  };
}

/**
 * The workspace's five built-in rows: a new workspace gets them in its creation's change group, named and defined in its
 * documentation language (decision 7). `names`: the language of the names when it differs (the format's upgrade gives
 * existing workspaces the English names, F18).
 */
export function builtinStereotypeRows(ctx: CommandContext, workspaceId: Uuid, language: DocLanguage, names: DocLanguage = language): Stereotype[] {
  return BUILTIN_STEREOTYPE_CODES.map((code) =>
    stereotypeRow(
      { id: ctx.newId(), workspace_id: workspaceId, created_at: ctx.now, created_by: ctx.actorId },
      { code, name: builtinStereotypeText(code, names).name, definition: builtinStereotypeText(code, language).definition, origin: "builtin" },
    ),
  );
}

export const isBuiltinStereotype = (s: Pick<Stereotype, "origin">): boolean => s.origin === "builtin";
const isLive = (r: { deleted_at: string | null }) => r.deleted_at === null;

/** The list's order (decision 6): the built-in ones in their fixed order, then own ones in the order they were added. */
export function byStereotypeOrder(a: Stereotype, b: Stereotype): number {
  const oa = isBuiltinStereotype(a) ? BUILTIN_STEREOTYPE_CODES.indexOf(a.code as BuiltinStereotypeCode) : 1000;
  const ob = isBuiltinStereotype(b) ? BUILTIN_STEREOTYPE_CODES.indexOf(b.code as BuiltinStereotypeCode) : 1000;
  return oa - ob || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

// ---- names and codes (items 3, 5; F5–F7) ----

export const STEREOTYPE_NAME_TAKEN = "That name is taken";
export const STEREOTYPE_CODE_TAKEN = "That code is taken";
export const STEREOTYPE_BAD_CODE = "Letters, digits and _; starting with a letter";
/** A code's shape: lower-case letters, digits and `_`, starting with a letter, at most 30 characters. */
export const STEREOTYPE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,29}$/;

/** A code as typed: trimmed and lower-cased; empty is none. */
export const typedStereotypeCode = (s: string): string | null => {
  const t = s.trim().toLowerCase();
  return t ? t : null;
};

/**
 * The code proposed from a name while the code field was not edited by hand (the prototype's `stSnake`, F6): trimmed,
 * lower case, diacritics removed (`ł` too, which has none to remove), every run of other characters one `_`, no `_` at
 * either end, `s_` before a leading digit, at most 30 characters.
 */
export function proposedCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "s_$1")
    .slice(0, 30);
}

/**
 * The stereotype a name collides with (F5), or null: another live one with that name, or any row (removed and deleted
 * ones too) whose code is that name. `exceptId`: the one being renamed, whose own code never blocks its name.
 */
export function stereotypeNameTakenBy(list: readonly Stereotype[], name: string, exceptId: Uuid | null = null): Stereotype | null {
  const key = normClassification(name);
  for (const s of list) {
    if (s.id === exceptId) continue;
    if (isLive(s) && s.name_key === key) return s;
    if (normClassification(s.code) === key) return s;
  }
  return null;
}

/**
 * Why a new code is refused, or null (item 5): its shape; then any row's code (removed and deleted ones included, so a
 * code is never given twice) or a live stereotype's name. The new row's own name is not in the list yet: "Event" with
 * the code `event` passes.
 */
export function stereotypeCodeRefusal(list: readonly Stereotype[], code: string): string | null {
  if (!STEREOTYPE_CODE_PATTERN.test(code)) return STEREOTYPE_BAD_CODE;
  const key = normClassification(code);
  if (BUILTIN_STEREOTYPE_CODES.some((b) => normClassification(b) === key)) return STEREOTYPE_CODE_TAKEN;
  for (const s of list) {
    if (normClassification(s.code) === key) return STEREOTYPE_CODE_TAKEN;
    if (isLive(s) && s.name_key === key) return STEREOTYPE_CODE_TAKEN;
  }
  return null;
}

// ---- reading the list (items 9, 10) ----

export interface StereotypeIndex {
  /** The live stereotypes in the list's order. */
  live: readonly Stereotype[];
  /** The live row of a code. */
  of(code: string): Stereotype | undefined;
  /** What shows for a code: its live row's name, else its row's name, else a built-in code's English name or the code. */
  name(code: string): string;
  /** A live row's definition, or null. */
  definition(code: string): string | null;
}

/** Built once per page from the workspace's rows (`WorkspaceModel.stereotypes`). */
export function stereotypeIndex(list: readonly Stereotype[]): StereotypeIndex {
  const live = list.filter(isLive).sort(byStereotypeOrder);
  const byCode = new Map(live.map((s) => [s.code, s]));
  const anyByCode = new Map(list.map((s) => [s.code, s]));
  return {
    live,
    of: (code) => byCode.get(code),
    name: (code) => byCode.get(code)?.name ?? anyByCode.get(code)?.name ?? (isBuiltinStereotypeCode(code) ? BUILTIN_STEREOTYPE_TEXTS.en[code].name : code),
    definition: (code) => byCode.get(code)?.definition ?? null,
  };
}

/** Live logical entities per code (the tab's Used column; facts and dimensions show their role instead). */
export function stereotypeUses(entities: readonly Pick<Entity, "stereotype" | "model_level" | "deleted_at">[]): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const e of entities) if (e.deleted_at === null && e.model_level === "logical") uses[e.stereotype] = (uses[e.stereotype] ?? 0) + 1;
  return uses;
}

// ---- the write rule (F1, F2) ----

/** An entity on a code the workspace does not have as a live stereotype (F15). */
export const UNKNOWN_STEREOTYPE = "That stereotype is not in the list.";

/**
 * The first live entity (of those `check` picks) whose code has no live stereotype, or null. A built-in code always has
 * one (every workspace has the five rows, never deleted), so only own codes are looked up: an undo of a step recorded
 * before slice 24, or a test model without the list, needs no rows.
 */
export function entityWithoutStereotype(
  entities: readonly Pick<Entity, "id" | "stereotype" | "deleted_at">[],
  stereotypes: readonly Pick<Stereotype, "code" | "deleted_at">[],
  check: (e: Pick<Entity, "id" | "stereotype">) => boolean = () => true,
): Pick<Entity, "id" | "stereotype"> | null {
  const live = new Set(stereotypes.filter(isLive).map((s) => s.code));
  for (const e of entities) if (e.deleted_at === null && !isBuiltinStereotypeCode(e.stereotype) && check(e) && !live.has(e.stereotype)) return e;
  return null;
}

/**
 * Whether a write set can leave an entity on a missing stereotype, so that the rule must read the model: it writes a
 * live entity with an own code (inserted, brought back or changed), or it deletes a stereotype row. A built-in code is
 * always live (every workspace has the five rows, never deleted: the local adapter's check and the SQL's), so a write of
 * built-in codes alone needs no read.
 */
export function writesStereotypeCodes(writes: readonly Write[]): boolean {
  for (const w of writes) {
    if (w.table === "stereotype" && w.kind === "update" && w.before.deleted_at === null && w.row.deleted_at !== null) return true;
    if (w.table !== "entity") continue;
    const row = w.row;
    if (row.deleted_at !== null || isBuiltinStereotypeCode(row.stereotype)) continue;
    if (w.kind === "insert" || w.before.deleted_at !== null || w.before.stereotype !== row.stereotype) return true;
  }
  return false;
}

/**
 * The write rule on any write set (runCommand): after the writes, every live entity they write, and every live entity on
 * a code they remove, has a live stereotype. `entities` and `stereotypes` are the workspace's rows as stored.
 */
export function stereotypeWritesRefusal(writes: readonly Write[], entities: readonly Entity[], stereotypes: readonly Stereotype[]): string | null {
  if (!writesStereotypeCodes(writes)) return null;
  const entityAfter = new Map(entities.map((e) => [e.id, e]));
  const stereotypeAfter = new Map(stereotypes.map((s) => [s.id, s]));
  const written = new Set<string>();
  const removed = new Set<string>();
  for (const w of writes) {
    if (w.kind === "remove") continue;
    if (w.table === "entity") {
      entityAfter.set((w.row as Entity).id, w.row as Entity);
      written.add((w.row as Entity).id);
    } else if (w.table === "stereotype") {
      const row = w.row as Stereotype;
      stereotypeAfter.set(row.id, row);
      if (row.deleted_at !== null) removed.add(row.code);
    }
  }
  const gap = entityWithoutStereotype([...entityAfter.values()], [...stereotypeAfter.values()], (e) => written.has(e.id) || removed.has(e.stereotype));
  return gap ? UNKNOWN_STEREOTYPE : null;
}
