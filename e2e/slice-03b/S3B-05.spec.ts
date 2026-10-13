import { expect, test } from "./fixtures";
import { canvasUrl, expectToast, ids, labelNamed, liveCards, openCanvas, RETAIL, SEED_IDS, signInAs, store, WHOLE_CO } from "./helpers";

test("S3B-05: “Open as live canvas” on CR-23 (label panel and project home) makes one canvas named CR-23 with Customer full and the tables of its mapping as context cards with the labeled filter, arranged into frames; opening again goes to it; from another project it is added there first", async ({ page }) => {
  test.setTimeout(150_000);
  const cr23 = (await labelNamed("CR-23"))!;
  const { entity, table } = await ids();
  const liveCanvases = async () => (await store().canvases.list(RETAIL)).filter((c) => c.deleted_at === null && c.live_label_id === cr23.id);
  await signInAs(page, "Łukasz");

  // the label panel: “Open as live canvas” makes it and opens it with the toast
  await page.goto(`${canvasUrl()}?label=${cr23.id}`);
  const open = page.getByTestId("button-label-live");
  await expect(open).toHaveText("Open as live canvas");
  await open.click();
  await expectToast(page, "Live canvas for CR-23. It follows the label: what you label appears here, what you unlabel disappears.");
  await expect.poll(async () => (await liveCanvases()).length).toBe(1);
  const live = (await liveCanvases())[0]!;
  expect(live.name).toBe("CR-23");
  await expect(page).toHaveURL(new RegExp(`/c/${live.id}$`));
  expect(await liveCards(live.id)).toEqual(
    expect.arrayContaining([
      [entity("Customer").id, "full", "all"],
      [table("web_users").id, "context", "labeled"],
    ]),
  );
  // arranged into frames by concept and system: every card in a frame
  const items = await store().canvasItems.listOfCanvas(RETAIL, live.id);
  const frames = await store().frames.listOfCanvas(RETAIL, live.id);
  expect(frames.map((f) => f.kind).sort()).toEqual(["concept", "source_system"]);
  expect(items.every((i) => frames.some((f) => f.id === i.frame_id))).toBe(true);
  await expect(page.getByTestId("frame")).toHaveCount(2);

  // the project home: “Open live canvas” goes to it, no second one
  await page.goto(`/w/${RETAIL}/p/${SEED_IDS.projCustomer360}`);
  const row = page.getByTestId("item-project-label").filter({ hasText: "CR-23" });
  await expect(row.getByTestId("button-project-label-live")).toHaveText("Open live canvas");
  await row.getByTestId("button-project-label-live").click();
  await expect(page).toHaveURL(new RegExp(`/c/${live.id}$`));
  expect(await liveCanvases()).toHaveLength(1);

  // from another project (Order management): “Go to its live canvas” adds it there first, then opens it
  await openCanvas(page, canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement), WHOLE_CO);
  await page.goto(`${canvasUrl(SEED_IDS.canvasOrderLines, SEED_IDS.projOrderManagement)}?label=${cr23.id}`);
  await expect(page.getByTestId("button-label-live")).toHaveText("Go to its live canvas");
  await page.getByTestId("button-label-live").click();
  await expectToast(page, "Added the live canvas CR-23 to Order management.");
  await expect(page).toHaveURL(new RegExp(`/p/${SEED_IDS.projOrderManagement}/c/${live.id}$`));
  expect((await store().canvases.listLinksOfProject(RETAIL, SEED_IDS.projOrderManagement)).some((l) => l.canvas_id === live.id)).toBe(true);
  expect(await liveCanvases()).toHaveLength(1);
});
