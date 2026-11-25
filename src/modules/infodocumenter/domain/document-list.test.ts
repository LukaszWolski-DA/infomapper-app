// The Documentation tab's meta line and order (slice 25, D10; slice 36: the source, and B5.1 a: "created {time}" and the
// same name newest first).

import { describe, expect, it } from "vitest";
import { createdText, documentOrder, metaLine, sourceText } from "./document-list";

const row = { audience: "Business", sections: 8, shared: true, author: "Łukasz" };

describe("the meta line", () => {
  it("names the source as the prototype does, then the sections, the language, the paper and a shared one's author", () => {
    expect(metaLine({ ...row, baseline: null }, "English")).toBe("Business · live model · 8 sections · English · A4 · by Łukasz");
    expect(metaLine({ ...row, baseline: "Stage 1 sign-off", shared: false, audience: null, sections: 1 }, "Polski")).toBe("from baseline “Stage 1 sign-off” · 1 section · Polski · A4");
    expect(sourceText("")).toBe("from baseline (missing)");
  });

  it("ends with the time it was made (written in the browser's time zone by the page)", () => {
    expect(createdText("2026-11-25 10:12")).toBe("created 2026-11-25 10:12");
  });
});

describe("the order (B5.1 a)", () => {
  const doc = (name: string, created_at: string, id: string) => ({ name, created_at, id });

  it("is by name in any letter case, the same name newest first, then by id", () => {
    const list = [
      doc("Sign-off", "2026-11-25T09:00:00.000Z", "01a0f9e9-0000-7000-8000-000000000001"),
      doc("alpha", "2026-11-20T09:00:00.000Z", "01a0f9e9-0000-7000-8000-000000000002"),
      doc("sign-off", "2026-11-25T10:00:00.000Z", "01a0f9e9-0000-7000-8000-000000000003"),
      doc("Sign-off", "2026-11-25T09:00:00.000Z", "01a0f9e9-0000-7000-8000-000000000004"),
    ];
    expect([...list].sort(documentOrder).map((d) => d.id.slice(-1))).toEqual(["2", "3", "4", "1"]);
  });
});
