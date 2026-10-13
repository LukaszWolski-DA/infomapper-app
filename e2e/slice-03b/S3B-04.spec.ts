import { expect, test } from "./fixtures";
import {
  callActionDirectly,
  canvasUrl,
  captureActionId,
  card,
  contextOn,
  expectToast,
  labelNamed,
  linkedTo,
  loadModel,
  newSession,
  openCanvas,
  removeLabel,
  RETAIL,
  rowNamed,
  SEED_IDS,
  undo,
  WHOLE_CO,
} from "./helpers";

test("S3B-04: a reviewer and a reader see no context switch; a write sent with a context by a reviewer is refused and changes nothing; a deleted label switches the context off with its toast", async ({ browser }) => {
  test.setTimeout(180_000);

  // Piotr (reviewer) and Kasia (reader): no switch
  for (const who of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    const { page } = await newSession(browser, who);
    await openCanvas(page, canvasUrl(), WHOLE_CO);
    await expect(page.getByTestId("bar-top")).toBeVisible();
    await expect(page.getByTestId("button-context"), who).toHaveCount(0);
    await expect(page.getByTestId("status-context"), who).toHaveCount(0);
    await page.context().close();
  }

  // Piotr's page never sends a context (it clears a stale one); a write sent with one directly (his approval of a
  // mapping, which the context would label) is refused and changes nothing. Łukasz uses the status action once for its id.
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const drafts = model.mappings.filter((m) => m.status === "draft" && model.attributes.find((a) => a.id === m.attribute_id)?.entity_id === customer.id);
  const [used, draft] = [drafts[0]!, drafts[1] ?? drafts[0]!];
  const labelOf = (m: (typeof drafts)[number]) => {
    const input = model.sourceColumns.find((c) => c.id === model.mappingInputs.find((i) => i.mapping_id === m.id)!.source_column_id)!;
    return `${model.sourceTables.find((t) => t.id === input.source_table_id)!.name}.${input.name}`;
  };
  const owner0 = await newSession(browser, "Łukasz");
  const o0 = owner0.page;
  await openCanvas(o0, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await rowNamed(o0, "Customer", model.attributes.find((a) => a.id === used.attribute_id)!.name).click();
  await o0.getByTestId("list-attribute-mappings").getByRole("button").filter({ hasText: labelOf(used) }).click();
  const statusId = await captureActionId(o0, () => o0.getByTestId("panel-mapping").getByTestId("seg-mapping-status").getByRole("button", { name: "In review" }).click());
  await owner0.page.context().close();

  const links = await linkedTo("CR-23");
  const target = (await loadModel()).mappings.find((m) => m.id === draft.id)!;
  const reviewer = await newSession(browser, "Piotr Wiśniewski");
  const p = reviewer.page;
  await openCanvas(p, canvasUrl(), WHOLE_CO);
  await contextOn(p, "CR-23", SEED_IDS.userPiotr);
  const answer = await callActionDirectly(p, statusId, [RETAIL, { mappingId: target.id, expectedVersion: target.version, status: "approved" }]);
  expect(answer).toContain("As a reviewer you cannot change labels.");
  expect((await loadModel()).mappings.find((m) => m.id === draft.id)!.status).toBe(target.status);
  expect(await linkedTo("CR-23")).toEqual(links);
  await reviewer.page.context().close();

  // Łukasz works on JIRA-481; Anna deletes it meanwhile: his next model change is refused, and the fresh page switches the
  // context off with its toast
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await contextOn(o, "JIRA-481");
  await openCanvas(o, canvasUrl(), { x: 0, y: 0, zoom: 1 });
  await expect(o.getByTestId("button-context")).toContainText("Working on JIRA-481");
  await removeLabel("JIRA-481");
  await rowNamed(o, "Customer", "first_name").click();
  const name = o.getByTestId("input-attribute-name");
  await name.fill("given_name");
  await name.press("Enter");
  await expectToast(o, "The working context JIRA-481 was deleted, so it is off now.");
  await expect(o.getByTestId("button-context")).toHaveAttribute("aria-pressed", "false");
  expect((await loadModel()).attributes.some((a) => a.name === "given_name")).toBe(false);

  // deleting the active context's own label in its panel: one toast that says both, with Undo; Undo brings the label
  // back, the context stays off
  const cr23 = (await labelNamed("CR-23"))!;
  await contextOn(o, "CR-23");
  await o.goto(`${canvasUrl()}?label=${cr23.id}`);
  await expect(o.getByTestId("panel-label")).toBeVisible();
  await expect(o.getByTestId("button-context")).toContainText("Working on CR-23");
  await o.getByTestId("button-label-delete").click();
  await expectToast(o, "Deleted the label CR-23; the working context is off.");
  await expect(o.getByTestId("button-context")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await labelNamed("CR-23")) === undefined).toBe(true);
  await undo(o);
  await expect.poll(async () => (await labelNamed("CR-23"))?.id).toBe(cr23.id);
  await expect(o.getByTestId("button-context")).toHaveAttribute("aria-pressed", "false");
  await expect(card(o, "Customer")).toBeVisible();
});
