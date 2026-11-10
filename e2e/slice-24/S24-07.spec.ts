// S24-07 (slice 24, item 12, F14 as rewritten in step 1): the app's readers of a stereotype's code work the same after
// all five built-in ones are renamed: every seeded entity's code is unchanged; `createEntity`'s default is `object` for a
// logical entity (whose card shows the new name) and for InfoCube's facts and dimensions (whose cards show their role);
// the seeds' entities keep their codes. On the Sales star (slice 15a's fixture).

import { createEntity } from "../../src/domain/commands/entity";
import { createCubeEntity } from "../../src/modules/infocube/domain/commands";
import { STAR, STAR_VIEW, starUrl } from "../slice-15a/helpers";
import { test } from "../slice-15a/fixtures";
import { asCube } from "../slice-19/helpers";
import { expect } from "./fixtures";
import { card, cardStereotype, expectStoredName, expectToast, loadModel, openCanvas, openConventions, SEED_IDS, stName, stRow, typeAndLeave } from "./helpers";

const RENAMED = { object: "Thing", link: "Association", dictionary: "Code list", context: "Situation", informative: "Report" } as const;

test("S24-07: after renaming all five, every code stays and new entities, facts and dimensions get object", async ({ page }) => {
  const before = (await loadModel()).entities.map((e) => [e.id, e.model_level, e.stereotype]);
  expect(before.some(([, level]) => level === "dimensional")).toBe(true);

  await openConventions(page);
  for (const [code, name] of Object.entries(RENAMED)) {
    await typeAndLeave(stName(stRow(page, code)), name);
    await expectToast(page, `Renamed to ${name}; entities keep the stereotype.`);
    await expectStoredName(code, name);
  }
  // the seeds' entities, logical and dimensional: every code as it was
  expect((await loadModel()).entities.map((e) => [e.id, e.model_level, e.stereotype])).toEqual(before);
  // the Used column still counts by code
  await expect(stRow(page, "object").getByTestId("stereotype-uses")).toHaveText("4 entities");

  // createEntity's default: object, shown by its new name on the card
  const made = await asCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const m = await s.model.load(access.workspace.id);
    const concept = m.concepts.find((c) => c.name === "Sales")!;
    const canvas = (await s.canvases.list(access.workspace.id)).find((c) => c.id === STAR)!;
    return createEntity(ctx, access, { concept, concepts: m.concepts, entities: m.entities, canvas, frames: [] }, { conceptId: concept.id, name: "Loyalty Card", placement: { canvasId: STAR, x: 40, y: 1400, frames: [] } });
  });
  // InfoCube's facts and dimensions: object, never shown (C-5)
  const fact = await asCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const m = await s.model.load(access.workspace.id);
    const concept = m.concepts.find((c) => c.name === "Sales")!;
    return createCubeEntity(ctx, access, { concept, entities: m.entities, canvas: null }, "fact", { conceptId: concept.id, name: "Fact Returns" });
  });
  const dimension = await asCube(SEED_IDS.userLukasz, async (ctx, access, s) => {
    const m = await s.model.load(access.workspace.id);
    const concept = m.concepts.find((c) => c.name === "Sales")!;
    return createCubeEntity(ctx, access, { concept, entities: m.entities, canvas: null }, "dimension", { conceptId: concept.id, name: "Dim Store" });
  });
  const after = (await loadModel()).entities;
  expect(after.find((e) => e.id === made.entityId)).toMatchObject({ model_level: "logical", stereotype: "object" });
  expect(after.find((e) => e.id === fact.entityId)).toMatchObject({ model_level: "dimensional", stereotype: "object" });
  expect(after.find((e) => e.id === dimension.entityId)).toMatchObject({ model_level: "dimensional", stereotype: "object" });

  await openCanvas(page, starUrl(), STAR_VIEW);
  await expect(cardStereotype(card(page, "Customer"))).toHaveText("Thing");
  await expect(card(page, "Fact Sales").getByTestId("card-role")).toHaveText("Fact");
  await expect(card(page, "Dim Customer").getByTestId("card-role")).toHaveText("Dimension");
  await openCanvas(page, starUrl(), { x: 20, y: -1300, zoom: 0.5 });
  await expect(cardStereotype(card(page, "Loyalty Card"))).toHaveText("Thing");
});
