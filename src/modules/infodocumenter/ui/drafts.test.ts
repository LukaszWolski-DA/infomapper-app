// Slice 26 (F1): the editor's preview draws a text field's draft over the stored value it was typed on.

import { describe, expect, it } from "vitest";
import { access, ids, makeCtx } from "@/domain/__fixtures__/domain";
import { sectionKinds } from "@/domain/document/sections";
import { createDocument } from "../domain/commands";
import { INFODOC_SECTION_KINDS } from "../domain/sections";
import { nextDraft, withDrafts } from "./drafts";

const made = () => {
  const a = access("reader", { infodoc: true });
  const r = createDocument(makeCtx(ids.actor), { ...a, member: { ...a.member!, user_id: ids.actor } }, { workspaceId: ids.ws, preset: "dictionary" }, sectionKinds(INFODOC_SECTION_KINDS));
  if (!r.ok) throw new Error(r.error.message);
  return r.value.document;
};

describe("the preview's drafts (F1)", () => {
  it("draws a draft over the value it was typed on, and the stored value once it changed", () => {
    const d = made();
    const id = d.sections[0]!.id;
    const drafts = new Map([
      ["cover.subtitle", nextDraft(d, undefined, "cover.subtitle", "For you")],
      [`sec:${id}:body`, nextDraft(d, undefined, `sec:${id}:body`, "Typed")],
      [`sec:${id}:heading`, nextDraft(d, undefined, `sec:${id}:heading`, "  ")],
      ["name", nextDraft(d, undefined, "name", " ")],
    ]);
    const drawn = withDrafts(d, drafts);
    expect(drawn.cover.subtitle).toBe("For you");
    expect(drawn.sections[0]).toMatchObject({ heading: null, options: { body: "Typed" } });
    // an empty name draws the stored one (a name is required)
    expect(drawn.name).toBe(d.name);
    // someone else changed the subtitle meanwhile: the stored value shows
    const changed = { ...d, cover: { ...d.cover, subtitle: "Theirs" } };
    expect(withDrafts(changed, drafts).cover.subtitle).toBe("Theirs");
    // the draft saved: the stored value is the text
    expect(withDrafts({ ...d, cover: { ...d.cover, subtitle: "For you" } }, drafts).cover.subtitle).toBe("For you");
  });
});
