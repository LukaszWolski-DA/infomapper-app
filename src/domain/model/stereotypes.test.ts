import { describe, expect, it } from "vitest";
import { builtinStereotype, builtinStereotypes, entity, ids, makeCtx, NOW, ownStereotype } from "../__fixtures__/domain";
import type { Write } from "../changes";
import type { Entity } from "../types";
import {
  BUILTIN_STEREOTYPE_CODES,
  BUILTIN_STEREOTYPE_TEXTS,
  builtinStereotypeRows,
  byStereotypeOrder,
  entityWithoutStereotype,
  proposedCode,
  STEREOTYPE_BAD_CODE,
  STEREOTYPE_CODE_TAKEN,
  stereotypeCodeRefusal,
  stereotypeIndex,
  stereotypeNameTakenBy,
  stereotypeUses,
  stereotypeWritesRefusal,
  typedStereotypeCode,
  UNKNOWN_STEREOTYPE,
  writesStereotypeCodes,
} from "./stereotypes";

const EVENT = "01900000-0000-7000-8000-5000000000e1";
const event = (over = {}) => ownStereotype(EVENT, "Event", "business_event", { created_at: "2026-10-03T00:00:00.000Z", ...over });

describe("the built-in stereotypes (slice 24, Appendix A)", () => {
  it("has five fixed codes with a name and a definition in English, Polish and German", () => {
    expect(BUILTIN_STEREOTYPE_CODES).toEqual(["object", "link", "dictionary", "context", "informative"]);
    for (const language of ["en", "pl", "de"] as const) {
      for (const code of BUILTIN_STEREOTYPE_CODES) {
        expect(BUILTIN_STEREOTYPE_TEXTS[language][code].name.length).toBeGreaterThan(0);
        expect(BUILTIN_STEREOTYPE_TEXTS[language][code].definition.length).toBeGreaterThan(0);
      }
    }
    expect(BUILTIN_STEREOTYPE_TEXTS.pl.object.name).toBe("Obiekt");
    expect(BUILTIN_STEREOTYPE_TEXTS.de.link.name).toBe("Verknüpfung");
  });

  it("makes a workspace's rows in its language, or English names with the definitions in its language (F18)", () => {
    const pl = builtinStereotypeRows(makeCtx(), ids.ws, "pl");
    expect(pl.map((s) => [s.code, s.name, s.origin, s.version, s.deleted_at])).toEqual([
      ["object", "Obiekt", "builtin", 1, null],
      ["link", "Powiązanie", "builtin", 1, null],
      ["dictionary", "Słownik", "builtin", 1, null],
      ["context", "Kontekst", "builtin", 1, null],
      ["informative", "Informacyjna", "builtin", 1, null],
    ]);
    expect(pl[0]!.name_key).toBe("obiekt");
    const kept = builtinStereotypeRows(makeCtx(), ids.ws, "de", "en");
    expect(kept[1]).toMatchObject({ name: "Link", definition: BUILTIN_STEREOTYPE_TEXTS.de.link.definition, created_at: NOW });
  });
});

describe("the list's order (decision 6)", () => {
  it("puts the built-in ones first in their order, then own ones in the order they were added", () => {
    const later = ownStereotype("01900000-0000-7000-8000-5000000000e2", "Agreement", "agreement", { created_at: "2026-10-04T00:00:00.000Z" });
    const list = [later, event(), ...builtinStereotypes().reverse()].sort(byStereotypeOrder);
    expect(list.map((s) => s.code)).toEqual(["object", "link", "dictionary", "context", "informative", "business_event", "agreement"]);
  });
});

describe("the code's proposal (F6, the prototype's stSnake)", () => {
  it("lower-cases, drops diacritics and ł, joins runs of other characters with one _, trims _ and cuts at 30", () => {
    expect(proposedCode("Event")).toBe("event");
    expect(proposedCode("  Business event ")).toBe("business_event");
    expect(proposedCode("Słownik / lokalny")).toBe("slownik_lokalny");
    expect(proposedCode("Zdarzenie gospodarcze")).toBe("zdarzenie_gospodarcze");
    // ß has no decomposition: it is another character, as in the prototype
    expect(proposedCode("-- Größe --")).toBe("gro_e");
    expect(proposedCode("2nd level")).toBe("s_2nd_level");
    expect(proposedCode("a".repeat(40))).toHaveLength(30);
    expect(proposedCode("!!!")).toBe("");
  });

  it("reads a typed code trimmed and lower-cased; empty is none", () => {
    expect(typedStereotypeCode("  Business_Event ")).toBe("business_event");
    expect(typedStereotypeCode("   ")).toBeNull();
  });
});

describe("names and codes (item 5, F5)", () => {
  const list = [...builtinStereotypes(), event()];

  it("refuses a name another live one has or any row's code is, but never the row's own code", () => {
    expect(stereotypeNameTakenBy(list, "link")?.code).toBe("link");
    expect(stereotypeNameTakenBy(list, "OBJECT")?.code).toBe("object");
    expect(stereotypeNameTakenBy(list, "Business-Event")?.code).toBe("business_event");
    expect(stereotypeNameTakenBy(list, "Association")).toBeNull();
    // renaming Object to OBJECT: its own code does not block it
    expect(stereotypeNameTakenBy(list, "OBJECT", builtinStereotype("object").id)).toBeNull();
    expect(stereotypeNameTakenBy(list, "Link", builtinStereotype("object").id)?.code).toBe("link");
  });

  it("keeps a removed one's code taken for names, and frees its name", () => {
    const removed = [...builtinStereotypes(), event({ deleted_at: NOW })];
    expect(stereotypeNameTakenBy(removed, "business_event")?.id).toBe(EVENT);
    expect(stereotypeNameTakenBy(removed, "Event")).toBeNull();
  });

  it("refuses a code of the wrong shape, any row's code (removed ones too) and a live name", () => {
    expect(stereotypeCodeRefusal(list, "Event")).toBe(STEREOTYPE_BAD_CODE);
    expect(stereotypeCodeRefusal(list, "1event")).toBe(STEREOTYPE_BAD_CODE);
    expect(stereotypeCodeRefusal(list, "a".repeat(31))).toBe(STEREOTYPE_BAD_CODE);
    expect(stereotypeCodeRefusal(list, "link")).toBe(STEREOTYPE_CODE_TAKEN);
    expect(stereotypeCodeRefusal(list, "businessevent")).toBe(STEREOTYPE_CODE_TAKEN);
    expect(stereotypeCodeRefusal([...builtinStereotypes(), event({ deleted_at: NOW })], "business_event")).toBe(STEREOTYPE_CODE_TAKEN);
    expect(stereotypeCodeRefusal(list, "event")).toBe(STEREOTYPE_CODE_TAKEN);
    expect(stereotypeCodeRefusal(list, "agreement")).toBeNull();
    // a built-in code, even without the workspace's rows
    expect(stereotypeCodeRefusal([], "dictionary")).toBe(STEREOTYPE_CODE_TAKEN);
  });
});

describe("the index (items 9, 10)", () => {
  it("names a code by its row, its live row's definition, and an unknown code by itself", () => {
    const ix = stereotypeIndex([...builtinStereotypes(), event(), ownStereotype("01900000-0000-7000-8000-5000000000e3", "Gone", "gone", { deleted_at: NOW })]);
    expect(ix.live.map((s) => s.code)).toEqual(["object", "link", "dictionary", "context", "informative", "business_event"]);
    expect(ix.name("link")).toBe("Link");
    expect(ix.definition("link")).toBe(BUILTIN_STEREOTYPE_TEXTS.en.link.definition);
    expect(ix.definition("business_event")).toBeNull();
    expect(ix.of("gone")).toBeUndefined();
    expect(ix.name("gone")).toBe("Gone");
    expect(ix.name("other")).toBe("other");
    expect(stereotypeIndex([]).name("dictionary")).toBe("Dictionary");
  });

  it("counts live logical entities per code, not facts and dimensions", () => {
    const es: Entity[] = [entity(ids.customer), entity(ids.salesOrder, { stereotype: "link" }), entity("01900000-0000-7000-8000-00000000f001", { model_level: "dimensional" }), entity("01900000-0000-7000-8000-00000000f002", { deleted_at: NOW })];
    expect(stereotypeUses(es)).toEqual({ object: 1, link: 1 });
  });
});

describe("the write rule (F1)", () => {
  const customer = entity(ids.customer);
  const update = (row: Entity, before: Entity = customer): Write => ({ kind: "update", table: "entity", before, row });

  it("reads the model only for own codes written or a stereotype removed", () => {
    expect(writesStereotypeCodes([update({ ...customer, name: "Client" })])).toBe(false);
    expect(writesStereotypeCodes([update({ ...customer, stereotype: "link" })])).toBe(false);
    expect(writesStereotypeCodes([{ kind: "insert", table: "entity", row: { ...customer, stereotype: "object" } }])).toBe(false);
    expect(writesStereotypeCodes([update({ ...customer, stereotype: "business_event" })])).toBe(true);
    expect(writesStereotypeCodes([{ kind: "update", table: "stereotype", before: event(), row: event({ deleted_at: NOW }) }])).toBe(true);
  });

  it("refuses an entity on an own code that is not a live stereotype, after the writes", () => {
    const list = [...builtinStereotypes(), event()];
    expect(stereotypeWritesRefusal([update({ ...customer, stereotype: "business_event" })], [customer], list)).toBeNull();
    expect(stereotypeWritesRefusal([update({ ...customer, stereotype: "hub" })], [customer], list)).toBe(UNKNOWN_STEREOTYPE);
    const on = { ...customer, stereotype: "business_event" };
    // removing it while an entity has it, unless the same writes move the entity
    expect(stereotypeWritesRefusal([{ kind: "update", table: "stereotype", before: event(), row: event({ deleted_at: NOW }) }], [on], list)).toBe(UNKNOWN_STEREOTYPE);
    expect(
      stereotypeWritesRefusal([update({ ...on, stereotype: "object" }, on), { kind: "update", table: "stereotype", before: event(), row: event({ deleted_at: NOW }) }], [on], list),
    ).toBeNull();
  });

  it("treats a built-in code as always live and ignores deleted entities", () => {
    expect(entityWithoutStereotype([entity(ids.customer, { stereotype: "context" })], [])).toBeNull();
    expect(entityWithoutStereotype([entity(ids.customer, { stereotype: "hub", deleted_at: NOW })], [])).toBeNull();
    expect(entityWithoutStereotype([entity(ids.customer, { stereotype: "hub" })], [])?.id).toBe(ids.customer);
  });
});
