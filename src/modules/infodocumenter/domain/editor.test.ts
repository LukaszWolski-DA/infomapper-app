// Slice 26, step 2: the recipe's new fields and the editor's commands (F9 to F12, D10, Q8, Q9): the style's defaults
// and its patch, the upgrade of a slice 25 recipe (idempotent, Text's heading moved), a new document's language, a
// section's heading and page break, add, remove and move with their refusals, the page frame's fields (D6, D8).

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { access, ids, makeCtx } from "@/domain/__fixtures__/domain";
import { sectionKinds, type DocumentSectionKind } from "@/domain/document/sections";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Workspace, WorkspaceRole } from "@/domain/types";
import { addDocumentSection, createDocument, moveDocumentSection, removeDocumentSection, SECTION_TEXTS, updateDocument } from "./commands";
import { fillFrameField } from "./document";
import { RIGHTS_TEXTS } from "./rights";
import { INFODOC_SECTION_KINDS } from "./sections";
import { defaultStyle, SECTIONS_MAX, STYLE_DEFAULTS, upgradeDocument } from "./style";
import type { DocumentDefinition } from "./types";

const CUBE: DocumentSectionKind & { module: string } = {
  type: "cube.dim",
  module: "InfoCube",
  available: (w) => w.infocube,
  presets: ["s2t"],
  defaults: () => ({ facts: true }),
  options: z.object({ facts: z.boolean() }).strict() as unknown as z.ZodType<Record<string, unknown>>,
};
const KINDS = sectionKinds<DocumentSectionKind & { module?: string | null }>([...INFODOC_SECTION_KINDS, CUBE]);
const ME = ids.actor;
const as = (role: WorkspaceRole, ws: Partial<Workspace> = {}): WorkspaceAccess => {
  const a = access(role, { infodoc: true, ...ws });
  return { ...a, member: { ...a.member!, user_id: ME } };
};
const ok = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const made = (ws: Partial<Workspace> = {}, preset: "dictionary" | "s2t" | "blank" = "dictionary") =>
  ok(createDocument(makeCtx(ME), as("reader", ws), { workspaceId: ids.ws, preset }, KINDS)).document;
const at = (d: DocumentDefinition) => ({ workspaceId: ids.ws, documentId: d.id, expectedVersion: d.version });
const refusal = (r: { ok: boolean; error?: { message: string } }) => (r.ok ? null : r.error!.message);

describe("the style and the recipe's upgrade (F9 to F11)", () => {
  it("gives a new document the workspace's language and the defaults; the ETL preset has no draft mark", () => {
    const d = made({ doc_language: "pl" });
    expect(d.style).toEqual({ ...STYLE_DEFAULTS, language: "pl" });
    expect(d.sections.every((s) => s.heading === null && s.newPage)).toBe(true);
    expect(made({}, "s2t").style.watermark).toBe(false);
  });

  it("upgrades a slice 25 recipe: the defaults with the workspace's language, Text's heading moved to its entry; idempotent", () => {
    const old = {
      id: "d",
      scope: {},
      cover: {},
      sections: [
        { id: "a", type: "text", on: true, options: { heading: "Scope", body: "x" } },
        { id: "b", type: "dict", on: false, options: { entity: [], columns: [] } },
      ],
    };
    const up = upgradeDocument(old)!;
    expect(up.style).toEqual(STYLE_DEFAULTS);
    expect(up.sections).toEqual([
      { id: "a", type: "text", on: true, heading: "Scope", newPage: true, options: { body: "x" } },
      { id: "b", type: "dict", on: false, heading: null, newPage: true, options: { entity: [], columns: [] } },
    ]);
    expect(upgradeDocument(up)).toBeNull();
    // a style missing a later field gets it; what it has stays
    expect(upgradeDocument({ ...up, style: { language: "de", paper: "A3" } })!.style).toEqual({ ...STYLE_DEFAULTS, language: "de", paper: "A3" });
  });

  it("saves a style patch, a header's part alone keeping the other, and refuses a value outside its list", () => {
    const d = made();
    const s = ok(updateDocument(makeCtx(ME), as("reader"), d, { ...at(d), style: { paper: "A3", header: { right: " {date} " } } }, KINDS)).document;
    expect(s.style).toEqual({ ...d.style, paper: "A3", header: { left: null, right: "{date}" } });
    expect(refusal(updateDocument(makeCtx(ME), as("reader"), d, { ...at(d), style: { keepRows: 12 } }, KINDS))).toBe("Choose one of the row counts.");
    expect(refusal(updateDocument(makeCtx(ME), as("reader"), d, { ...at(d), style: { colour: "red" } }, KINDS))).not.toBeNull();
  });
});

describe("a section's heading and page break; add, remove, move (F12, D10)", () => {
  it("saves a section's heading (trimmed, empty is the default) and its page break", () => {
    const d = made();
    const id = d.sections[1]!.id;
    const named = ok(updateDocument(makeCtx(ME), as("reader"), d, { ...at(d), section: { id, heading: "  Glossary " } }, KINDS)).document;
    expect(named.sections[1]).toMatchObject({ heading: "Glossary", newPage: true });
    const back = ok(updateDocument(makeCtx(ME), as("reader"), named, { ...at(named), section: { id, heading: "", newPage: false } }, KINDS)).document;
    expect(back.sections[1]).toMatchObject({ heading: null, newPage: false });
    expect(refusal(updateDocument(makeCtx(ME), as("reader"), d, { ...at(d), section: { id, heading: "x".repeat(201) } }, KINDS))).toBe("This heading is too long.");
  });

  it("adds a registered type at the end with its defaults and names the new section", () => {
    const d = made();
    const r = ok(addDocumentSection(makeCtx(ME), as("reader"), d, { ...at(d), type: "s2t" }, KINDS));
    expect(r.document.version).toBe(d.version + 1);
    expect(r.document.sections.map((s) => s.type)).toEqual(["text", "dict", "s2t"]);
    expect(r.document.sections[2]).toMatchObject({ id: r.sectionId, on: true, heading: null, newPage: true, options: { group: "entity", unmapped: false } });
  });

  it("refuses a type no module knows, a module's while it is off, and the 51st section", () => {
    const d = made();
    expect(refusal(addDocumentSection(makeCtx(ME), as("reader"), d, { ...at(d), type: "acme.figures" }, KINDS))).toBe(SECTION_TEXTS.notInstalled);
    expect(refusal(addDocumentSection(makeCtx(ME), as("reader"), d, { ...at(d), type: "cube.dim" }, KINDS))).toBe("InfoCube is off in this workspace.");
    expect(ok(addDocumentSection(makeCtx(ME), as("reader", { infocube: true }), d, { ...at(d), type: "cube.dim" }, KINDS)).document.sections).toHaveLength(3);
    const full = { ...d, sections: Array.from({ length: SECTIONS_MAX }, (_, i) => ({ ...d.sections[0]!, id: `0190000${i}-0000-7000-8000-000000000000`.slice(0, 36) })) };
    expect(refusal(addDocumentSection(makeCtx(ME), as("reader"), full, { ...at(full), type: "text" }, KINDS))).toBe("A document holds at most 50 sections.");
  });

  it("removes and moves a section; the first one up changes nothing; a gone section is not found", () => {
    const d = made();
    const [text, dict] = d.sections;
    const moved = ok(moveDocumentSection(makeCtx(ME), as("reader"), d, { ...at(d), sectionId: dict!.id, direction: "up" })).document;
    expect(moved.sections.map((s) => s.id)).toEqual([dict!.id, text!.id]);
    expect(refusal(moveDocumentSection(makeCtx(ME), as("reader"), moved, { ...at(moved), sectionId: dict!.id, direction: "up" }))).toBe("Nothing to change.");
    const removed = ok(removeDocumentSection(makeCtx(ME), as("reader"), moved, { ...at(moved), sectionId: text!.id })).document;
    expect(removed.sections.map((s) => s.id)).toEqual([dict!.id]);
    expect(removeDocumentSection(makeCtx(ME), as("reader"), removed, { ...at(removed), sectionId: text!.id })).toMatchObject({ ok: false, error: { code: "not_found" } });
    // the row's version is checked (D-59)
    expect(removeDocumentSection(makeCtx(ME), as("reader"), removed, { ...at(removed), expectedVersion: d.version, sectionId: dict!.id })).toMatchObject({ ok: false, error: { code: "stale_version" } });
  });

  it("follows the edit rights: another's private document, a shared one for a reader, an archived workspace", () => {
    const mine = made();
    const others = { ...mine, author_id: ids.someoneElse };
    // another's private document is never told to exist (F15)
    expect(addDocumentSection(makeCtx(ME), as("owner"), others, { ...at(others), type: "text" }, KINDS)).toMatchObject({ ok: false, error: { code: "not_found" } });
    const shared = { ...others, shared: true };
    expect(refusal(moveDocumentSection(makeCtx(ME), as("reader"), shared, { ...at(shared), sectionId: shared.sections[1]!.id, direction: "up" }))).toBe(RIGHTS_TEXTS.sharedEdit);
    expect(ok(moveDocumentSection(makeCtx(ME), as("modeler"), shared, { ...at(shared), sectionId: shared.sections[1]!.id, direction: "up" })).document.version).toBe(shared.version + 1);
    expect(removeDocumentSection(makeCtx(ME), as("owner", { archived_at: "2026-11-01T00:00:00.000Z" }), mine, { ...at(mine), sectionId: mine.sections[0]!.id }).ok).toBe(false);
  });
});

describe("the page frame's fields (F9, D6, D8)", () => {
  const values = { org: "InfoMate", title: "T", workspace: "W", state: "Live" };
  it("fills the tokens, keeps an unknown one as typed and the page counters for the CSS", () => {
    expect(fillFrameField("{org} · {title} · {nope}", values, "Page {page} of {pages}")).toBe("InfoMate · T · {nope}");
    expect(fillFrameField("{pagelabel}", values, "Strona {page} z {pages}")).toBe("Strona {page} z {pages}");
    expect(fillFrameField("{page}/{pages}", values, "")).toBe("{page}/{pages}");
  });

  it("drops the page tokens from the header's left part, empties the header without a running header, and the mark when off", async () => {
    const { buildDocument } = await import("./document");
    const state = { snapshot: { workspace: { name: "W", client_name: null, doc_language: "en" }, organization: { name: "Org" }, people: [], model: { concepts: [], entities: [] }, projects: [], projectCanvases: [], canvasItems: [] } };
    const tree = (style = defaultStyle()) =>
      buildDocument({
        definition: { name: "Doc", author_id: ME, scope: { projects: [], concepts: [], logical: true, dimensional: true, mappings: "all" }, cover: { title: null, subtitle: null, version: null, status: null, preparedBy: null }, style, sections: [] },
        state: state as never,
        types: new Map(),
        date: "2026-11-13",
      }).frame;
    expect(tree()).toEqual({ headerLeft: "Org · Doc", headerRight: "", footerLeft: "W · Live model on 2026-11-13", footerRight: "Page {page} of {pages}", watermark: "DRAFT · live model" });
    expect(tree(defaultStyle({ header: { left: "{title} {page} · {pagelabel}", right: "{date}" } }))).toMatchObject({ headerLeft: "Doc", headerRight: "2026-11-13" });
    expect(tree(defaultStyle({ runningHeader: false, watermark: false }))).toMatchObject({ headerLeft: "", headerRight: "", watermark: "" });
    // a document's own language (Q8)
    expect(tree(defaultStyle({ language: "de" })).footerRight).toBe("Seite {page} von {pages}");
  });
});
