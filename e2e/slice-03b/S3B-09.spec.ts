import { expect, test } from "./fixtures";
import { canvasUrl, card, cardEl, closeToolbox, ids, labelItem, liveUrl, loadModel, mappingLine, openCanvas, openLiveFor, rowNamed, signInAs, toolboxAt } from "./helpers";

// “Not counted as filtered” belongs to the view-state bar slice (slice 6, D-39; PRD item 9).
test("S3B-09: context cards have the dashed outline and “context only”, relevant rows are bold, unlabeled mappings are faded by colour without opacity; the labeled filter is offered only on live canvases", async ({ page }) => {
  test.setTimeout(120_000);
  const { attribute, table } = await ids();
  // Sales Order comes as context (CR-23 on one attribute), customers whole (CR-23 on the table): its mappings into
  // Customer do not carry CR-23
  await labelItem("CR-23", { kind: "attribute", id: attribute("Sales Order", "order_date").id });
  await labelItem("CR-23", { kind: "source_table", id: table("customers").id });
  const live = await openLiveFor("CR-23");
  await signInAs(page, "Łukasz");
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 0.6 });

  // a context entity: the class on the card, its dashed outline, “context only” and the tooltip; no opacity
  const sales = cardEl(page, "Sales Order");
  await expect(sales).toHaveClass(/\bctx\b/);
  await expect(sales).toHaveAttribute("data-live", "context");
  await expect(sales).toHaveAttribute("data-filter", "labeled");
  await expect(sales).toHaveAttribute("title", "Context: the entity itself is not labeled CR-23, only some of its attributes are");
  await expect(sales.locator(".c-l1")).toContainText("context only");
  expect(await sales.evaluate((e) => [getComputedStyle(e).outlineStyle, getComputedStyle(e).opacity])).toEqual(["dashed", "1"]);
  // the full table is not a context card
  await expect(cardEl(page, "customers")).not.toHaveClass(/\bctx\b/);
  await expect(cardEl(page, "customers")).toHaveAttribute("data-live", "full");

  // a relevant row is bold (a class on the row, no new element)
  const orderDate = rowNamed(page, "Sales Order", "order_date");
  await expect(orderDate).toHaveClass(/\blab\b/);
  expect(await orderDate.locator(".nm").evaluate((e) => getComputedStyle(e).fontWeight)).toBe("600");

  // a mapping that does not carry CR-23 is faded by colour: the class, a lighter stroke than a labeled mapping's, no opacity
  const model = await loadModel();
  const faded = model.mappings.find((m) => m.attribute_id === attribute("Customer", "customer_id").id)!;
  const labeled = model.mappings.find((m) => m.attribute_id === attribute("Customer", "email").id && model.mappingInputs.some((i) => i.mapping_id === m.id && model.sourceColumns.find((c) => c.id === i.source_column_id)?.source_table_id === table("web_users").id))!;
  await expect(mappingLine(page, faded.id)).toHaveClass(/\bctxline\b/);
  await expect(mappingLine(page, labeled.id)).not.toHaveClass(/\bctxline\b/);
  const style = (id: string) =>
    mappingLine(page, id).locator("path.s").first().evaluate((e) => {
      const s = getComputedStyle(e);
      return { stroke: s.stroke, opacity: s.opacity, strokeOpacity: s.strokeOpacity };
    });
  const f = await style(faded.id), l = await style(labeled.id);
  expect([f.opacity, f.strokeOpacity]).toEqual(["1", "1"]);
  expect(f.stroke).not.toBe(l.stroke);

  // the Labeled filter: in a live canvas's entity card toolbox, not on a normal canvas
  await openCanvas(page, liveUrl(live), { x: 0, y: 0, zoom: 0.6 });
  let head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  await expect(page.getByTestId("menu-toolbox")).toContainText("Labeled");
  await closeToolbox(page);
  await openCanvas(page, canvasUrl(), { x: 0, y: 0, zoom: 0.6 });
  head = (await card(page, "Customer").locator(".c-head").boundingBox())!;
  await toolboxAt(page, { x: head.x + 20, y: head.y + 10 });
  await expect(page.getByTestId("menu-toolbox")).toContainText("Mapped");
  await expect(page.getByTestId("menu-toolbox")).not.toContainText("Labeled");
});
