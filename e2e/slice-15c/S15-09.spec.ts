import { expect, test } from "./fixtures";
import {
  attrId,
  card,
  cubeLine,
  cubeLines,
  cubeMappingId,
  cubePanel,
  dragTo,
  liveCubeInputs,
  liveCubeMappings,
  model,
  openStar,
  place,
  recordToasts,
  rowNamed,
  signInAs,
  STAR,
  startDrag,
  toasts,
  undo,
  veil,
} from "./helpers";

// S15-09 (IC-07, IC-08; B-6, C4, C5, X3): a dimensional mapping by drag, in both directions, onto a row and onto a
// header; the module decides each drop, a refusal is its toast and writes nothing; while a drag lasts the veil keeps
// the cards that can take it lit, and a column's drag on a canvas with facts or dimensions keeps those under it.

const B6 = "Source columns map to the logical model. Map the column to a logical attribute, then that attribute to the fact or dimension.";
const D_TO_D = "A dimensional attribute is fed from the logical model. Drag a logical attribute onto it.";
const L_TO_L = "A logical attribute maps onto a fact or a dimension. To relate two logical entities, draw a relationship.";

const header = (page: Parameters<typeof card>[0], name: string) => card(page, name).locator(".c-head .c-l2");

test("S15-09: Product.list_price onto Dim Product's header adds an attribute and a Draft line; one undo removes both", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  const before = (await liveCubeMappings()).length;

  await dragTo(page, rowNamed(page, "Product", "list_price"), header(page, "Dim Product"));
  await expect.poll(() => toasts(page)).toContain("Added list_price to Dim Product, fed from Product.list_price. Rename it on the right.");
  await expect(rowNamed(page, "Dim Product", "list_price")).toBeVisible();
  // the new attribute is selected, its panel open
  await expect(page.getByTestId("panel-attribute")).toBeVisible();

  const m = await model();
  const copy = m.attributes.find((a) => a.entity_id === attrIdEntity(m, "prod") && a.name === "list_price")!;
  expect(copy.data_type).toBe("decimal");
  expect(copy.is_primary_key).toBe(false);
  expect(copy.copied_from_attribute_id).toBeNull();
  const mappings = await liveCubeMappings();
  expect(mappings).toHaveLength(before + 1);
  const made = mappings.find((x) => x.attribute_id === copy.id)!;
  expect(made).toMatchObject({ kind: "direct", status: "draft" });
  expect((await liveCubeInputs()).filter((i) => i.mapping_id === made.id).map((i) => i.attribute_id)).toEqual([m.attributes.find((a) => a.name === "list_price" && a.entity_id !== copy.entity_id)!.id]);
  await expect(cubeLine(page, made.id)).toHaveClass(/\bcmap draft\b/);

  // one undo step removes both
  await undo(page);
  await expect(rowNamed(page, "Dim Product", "list_price")).toHaveCount(0);
  await expect(cubeLine(page, made.id)).toHaveCount(0);
  expect((await model()).attributes.some((a) => a.id === copy.id)).toBe(false);
  expect((await liveCubeMappings()).some((x) => x.id === made.id)).toBe(false);
});

test("S15-09: the reverse direction maps logical → dimensional; an existing mapping is selected; the refusals write nothing", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  const before = (await liveCubeMappings()).length;

  // Dim Date.year (not fed) dragged onto Sales Order.order_date: the mapping runs order_date → year
  await dragTo(page, rowNamed(page, "Dim Date", "year"), rowNamed(page, "Sales Order", "order_date"));
  await expect.poll(() => toasts(page)).toContain("Mapped Sales Order.order_date to Dim Date.year. The types differ (Date → Integer).");
  const year = attrId("date.year");
  const made = (await liveCubeMappings()).find((x) => x.attribute_id === year)!;
  expect(made).toMatchObject({ kind: "direct", status: "draft" });
  await expect(cubePanel(page)).toHaveAttribute("data-mapping", made.id);
  await expect(cubeLine(page, made.id)).toBeVisible();

  // the same drop again: the existing one is selected
  await page.keyboard.press("Escape");
  await dragTo(page, rowNamed(page, "Customer", "segment_code"), rowNamed(page, "Dim Customer", "segment_code"));
  await expect.poll(() => toasts(page)).toContain("That mapping already exists. It is selected now.");
  await expect(cubePanel(page)).toHaveAttribute("data-mapping", cubeMappingId("cust.segment_code"));

  // Dim Product.sku onto Dim Customer.city, and Customer.email onto Sales Order.status_code: refused
  await dragTo(page, rowNamed(page, "Dim Product", "sku"), rowNamed(page, "Dim Customer", "city"));
  await expect.poll(() => toasts(page)).toContain(D_TO_D);
  await dragTo(page, rowNamed(page, "Customer", "email"), rowNamed(page, "Sales Order", "status_code"));
  await expect.poll(() => toasts(page)).toContain(L_TO_L);
  expect(await liveCubeMappings()).toHaveLength(before + 1);
  await expect(cubeLines(page)).toHaveCount(before + 1);
});

test("S15-09: the veil lights the other level's cards while a row is dragged; a column onto a dimensional row is refused", async ({ page }) => {
  await recordToasts(page);
  // a source table on the star, to the right of the facts
  await place("customer_addresses", { x: 1460, y: 40 }, STAR);
  await signInAs(page, "Łukasz");
  await openStar(page);

  // a logical row: the five facts and dimensions stay lit, and since slice 21 (X1, D-76) the table too, which now takes
  // the drop (a logical row onto a column maps them)
  await startDrag(page, rowNamed(page, "Customer", "segment_code"));
  await expect.poll(() => veil(page)).toMatchObject({ litCards: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => veil(page)).toBeNull();

  // a dimensional row: the six logical cards
  await startDrag(page, rowNamed(page, "Dim Customer", "city"));
  await expect.poll(() => veil(page)).toMatchObject({ litCards: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();

  // a column: every card but the facts and dimensions (six logical ones and the table)
  await startDrag(page, rowNamed(page, "customer_addresses", "city"));
  await expect.poll(() => veil(page)).toMatchObject({ litCards: 7 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => veil(page)).toBeNull();

  // dropped on Dim Customer.city: B-6's toast in the browser, nothing written
  const mappings = (await model()).mappings.length;
  await dragTo(page, rowNamed(page, "customer_addresses", "city"), rowNamed(page, "Dim Customer", "city"));
  await expect.poll(() => toasts(page)).toContain(B6);
  expect((await model()).mappings.length).toBe(mappings);
});

/** The star's entity id of a key (`prod`), read back through the model for clarity. */
function attrIdEntity(m: Awaited<ReturnType<typeof model>>, key: "prod"): string {
  return m.entities.find((e) => e.name === { prod: "Dim Product" }[key])!.id;
}
