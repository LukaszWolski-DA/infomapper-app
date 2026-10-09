import { checkMappingTypes } from "../../src/domain/model/type-check";
import { expect, test } from "./fixtures";
import { canvasUrl, frameEl, ids, makeFrame, namePoint, openCanvas, signInAs, FRAMED } from "./helpers";

test("S2B-07: the label chips show mapped, used, type, drafts and misplaced counts that match the model; the panel shows the same counts and the frame's cards", async ({ page }) => {
  // a Customer concept frame around Customer and the CRM table customers (a table is misplaced in a concept frame)
  await makeFrame({ x: 16, y: 0, width: 760, height: 376 }, { name: "Customer area", concept: "Customer" });

  // the numbers, counted from the model
  const { model, entity, table } = await ids();
  const attrs = model.attributes.filter((a) => a.entity_id === entity("Customer").id);
  const cols = model.sourceColumns.filter((c) => c.source_table_id === table("customers").id);
  const inputsOf = (mappingId: string) => model.mappingInputs.filter((i) => i.mapping_id === mappingId).map((i) => i.source_column_id);
  const attrIds = new Set(attrs.map((a) => a.id)), colIds = new Set(cols.map((c) => c.id));
  const mapped = attrs.filter((a) => model.mappings.some((m) => m.attribute_id === a.id)).length;
  const used = cols.filter((c) => model.mappingInputs.some((i) => i.source_column_id === c.id)).length;
  const touching = model.mappings.filter((m) => attrIds.has(m.attribute_id) || inputsOf(m.id).some((c) => colIds.has(c)));
  const drafts = touching.filter((m) => m.status === "draft").length;
  const types = touching.filter((m) => {
    const attribute = model.attributes.find((a) => a.id === m.attribute_id)!;
    const columns = inputsOf(m.id).map((id) => model.sourceColumns.find((c) => c.id === id)!);
    return !checkMappingTypes(m, attribute, columns).ok;
  }).length;
  expect(touching.length).toBeGreaterThan(0);
  const chips = [
    `${mapped}/${attrs.length} mapped`,
    `${used}/${cols.length} used`,
    ...(types ? [`${types} type`] : []),
    ...(drafts ? [`${drafts} draft${drafts > 1 ? "s" : ""}`] : []),
    "1 misplaced",
  ];
  const sentence = [
    `${mapped} of ${attrs.length} attributes mapped.`,
    `${used} of ${cols.length} columns used.`,
    ...(types ? [`${types} type problem${types > 1 ? "s" : ""}.`] : []),
    ...(drafts ? [`${drafts} draft mapping${drafts > 1 ? "s" : ""}.`] : []),
  ].join(" ");

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(frameEl(page, "Customer area").getByTestId("frame-chip")).toHaveText(chips);

  // the panel: the same counts, the frame's cards, what does not belong here
  const at = await namePoint(page, "Customer area");
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("panel-frame")).toBeVisible();
  await expect(page.getByTestId("text-frame-counts")).toHaveText(sentence);
  const members = (await page.getByTestId("frame-card").allInnerTexts()).map((t) => t.split("\n")[0]!.trim()).sort();
  expect(members).toEqual(["Customer", "customers"]);
  await expect(page.getByTestId("frame-misplaced")).toHaveCount(1);
  await expect(page.getByTestId("frame-misplaced")).toContainText("customers");
  await expect(page.getByTestId("frame-misplaced")).toContainText("system CRM");

  // the canvas overview lists the frame with its card count
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("frame-link")).toHaveCount(1);
  await expect(page.getByTestId("frame-link")).toContainText("Customer area");
  await expect(page.getByTestId("frame-link")).toContainText("2 cards");
});
