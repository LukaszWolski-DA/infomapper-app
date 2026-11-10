// S24-01 (slice 24, data, D-79): every seeded workspace has the five built-in stereotypes with names and definitions in
// its documentation language ("Sales analytics" Polish); an entity with a code that is not a live stereotype is refused by
// the domain, through the app's action as well. A file written before slice 24 loads with the five rows (English names,
// definitions in its language) and an own row for any other code: the local file's upgrade, a unit test
// (`src/data/local/upgrade-16.test.ts`).

import { readDb } from "../../src/data/local/file";
import { updateEntity } from "../../src/domain/commands/entity";
import { BUILTIN_STEREOTYPE_CODES, BUILTIN_STEREOTYPE_TEXTS, UNKNOWN_STEREOTYPE, type BuiltinStereotypeCode } from "../../src/domain/model/stereotypes";
import { E2E_DB } from "../config";
import { refusalAs } from "../slice-15a/helpers";
import { expect, test } from "./fixtures";
import { loadModel, SEED_IDS, storedEntity } from "./helpers";

test("S24-01: every seeded workspace has the five built-in stereotypes in its documentation language", async () => {
  const db = await readDb(E2E_DB);
  expect(db.workspace.length).toBeGreaterThan(1);
  for (const w of db.workspace) {
    const rows = db.stereotype.filter((s) => s.workspace_id === w.id);
    expect(rows.map((s) => s.code)).toEqual([...BUILTIN_STEREOTYPE_CODES]);
    for (const s of rows) {
      const text = BUILTIN_STEREOTYPE_TEXTS[w.doc_language][s.code as BuiltinStereotypeCode];
      expect(s).toMatchObject({ origin: "builtin", name: text.name, definition: text.definition, deleted_at: null });
    }
  }
  const sales = db.workspace.find((w) => w.id === SEED_IDS.wsSales)!;
  expect(sales).toMatchObject({ name: "Sales analytics", doc_language: "pl" });
  expect(db.stereotype.filter((s) => s.workspace_id === sales.id).map((s) => s.name)).toEqual(["Obiekt", "Powiązanie", "Słownik", "Kontekst", "Informacyjna"]);
});

test("S24-01: an entity on a code that is not a live stereotype is refused by the domain", async () => {
  const m = await loadModel();
  const customer = await storedEntity("Customer");
  const state = { entity: customer, entities: m.entities, concept: null, stereotypes: m.stereotypes };
  for (const code of ["hub", "event"]) {
    expect(await refusalAs(SEED_IDS.userLukasz, (ctx, access) => updateEntity(ctx, access, state, { entityId: customer.id, expectedVersion: customer.version, stereotype: code }))).toBe(UNKNOWN_STEREOTYPE);
  }
  // a built-in one passes, and nothing was written by the refusals
  expect(await refusalAs(SEED_IDS.userLukasz, (ctx, access) => updateEntity(ctx, access, state, { entityId: customer.id, expectedVersion: customer.version, stereotype: "context" }))).toBeNull();
  expect((await storedEntity("Customer")).stereotype).toBe("object");
});
