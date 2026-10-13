import { expect, test } from "./fixtures";
import {
  callActionDirectly,
  captureActionId,
  card,
  expectCard,
  ids,
  labelItem,
  labelNamed,
  linkedTo,
  liveCards,
  liveUrl,
  newSession,
  openCanvas,
  openLiveFor,
  RETAIL,
  SEED_IDS,
  store,
  treeItem,
} from "./helpers";

test("S3B-14: as Piotr (reviewer) and as a reader: they can go to an existing live canvas and see it, cannot open a new one, add, remove or unlabel; direct calls are refused and change nothing", async ({ browser }) => {
  test.setTimeout(240_000);
  const { entity } = await ids();
  const live = await openLiveFor("CR-23");
  await labelItem("NEW-1", { kind: "entity", id: entity("Customer").id }); // a label without a live canvas
  const home = `/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`;

  // Łukasz (owner) adds and removes a card and opens a live canvas once, so the action ids can be called again
  const owner = await newSession(browser, "Łukasz");
  const o = owner.page;
  await openCanvas(o, liveUrl(live), { x: 0, y: 0, zoom: 0.6 });
  await treeItem(o, "Order Line").click();
  const labelFor = await captureActionId(o, () => o.getByTestId("button-live-yes").click());
  await expectCard(o, "Order Line");
  await card(o, "Order Line").getByTestId("card-name").click();
  await o.keyboard.press("Delete");
  const removeFrom = await captureActionId(o, () => o.getByTestId("button-live-yes").click());
  await expectCard(o, "Order Line", 0);
  await o.goto(home);
  const jira = o.getByTestId("item-project-label").filter({ hasText: "JIRA-481" });
  const openLive = await captureActionId(o, () => jira.getByTestId("button-project-label-live").click());
  await expect(o).toHaveURL(/\/c\//);
  await owner.page.context().close();

  const links = await linkedTo("CR-23");
  const cards = await liveCards(live);
  const canvases = (await store().canvases.list(RETAIL)).length;
  const customerCard = (await store().canvasItems.listOfCanvas(RETAIL, live)).find((i) => i.entity_id === entity("Customer").id)!;
  const newLabel = (await labelNamed("NEW-1"))!;

  for (const [who, role] of [
    ["Piotr Wiśniewski", "reviewer"],
    ["Kasia Zielińska", "reader"],
  ] as const) {
    const { page } = await newSession(browser, who);
    // the project home: “Open live canvas” for CR-23 (it has one), nothing for NEW-1 (it has none)
    await page.goto(home);
    await expect(page.getByTestId("item-project-label").filter({ hasText: "NEW-1" }).getByTestId("button-project-label-live"), who).toHaveCount(0);
    const row = page.getByTestId("item-project-label").filter({ hasText: "CR-23" });
    await expect(row.getByTestId("button-project-label-live")).toHaveText("Open live canvas");
    await row.getByTestId("button-project-label-live").click();
    await expect(page).toHaveURL(new RegExp(`/c/${live}$`));
    await expectCard(page, "Customer");

    // no add: a click in the left panel asks nothing; no remove: no unlabel in the toolbox, Delete asks nothing
    await treeItem(page, "Sales Order").click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("dialog-live-question"), who).toHaveCount(0);
    const head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
    await page.mouse.click(head.x + 20, head.y + 10, { button: "right" });
    await expect(page.getByTestId("menu-toolbox").getByRole("menuitem", { name: /unlabel/ }), who).toHaveCount(0);
    await page.keyboard.press("Escape");
    await card(page, "Customer").getByTestId("card-name").click();
    await page.keyboard.press("Delete");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("dialog-live-question"), who).toHaveCount(0);

    // direct calls: refused with the domain's message, nothing changes
    const refused = role === "reviewer" ? "As a reviewer you cannot" : "As a reader you cannot";
    expect(await callActionDirectly(page, labelFor, [RETAIL, (await labelNamed("CR-23"))!.id, { entityId: entity("Sales Order").id }])).toContain(refused);
    expect(await callActionDirectly(page, removeFrom, [RETAIL, { canvasItemId: customerCard.id, expectedVersion: customerCard.version }])).toContain(refused);
    expect(await callActionDirectly(page, openLive, [RETAIL, { labelId: newLabel.id, projectId: SEED_IDS.projCustomer360 }])).toContain(refused);
    expect(await linkedTo("CR-23")).toEqual(links);
    expect(await liveCards(live)).toEqual(cards);
    expect((await store().canvases.list(RETAIL)).length).toBe(canvases);
    await page.context().close();
  }
});
