// S38-05 (slice 38, step 6): names win in list rows. In the entity's "Attributes and their sources" (an editor's
// reorder row and a reviewer's read-only row), the attribute's name stays whole up to 65 % of the row and the physical
// names shorten with an ellipsis, their full text in their title; a row with a short detail stays as it is.

import { openEntityFromTree } from "../slice-04a/helpers";
import { expect, test, type Page } from "./fixtures";
import { canvasUrl, openCanvas, setPanels, signInAs } from "./helpers";

const SOURCES = "customers.email_addr, web_users.email";

/** In the row of `name`: whether its name is cut, and its physical names' shown width, cut and title. */
const rowOf = (page: Page, name: string) =>
  page.getByTestId("list-entity-attributes").evaluate((list, n) => {
    const row = [...list.querySelectorAll<HTMLElement>('[data-testid="attribute-order-item"], button')].find((r) => [...r.querySelectorAll("span")].some((s) => s.textContent === n))!;
    const spans = [...row.querySelectorAll<HTMLElement>(":scope > span")].filter((s) => s.getAttribute("aria-hidden") !== "true");
    const [nameSpan, physical] = [spans[0]!, spans[spans.length - 1]!];
    const w = row.getBoundingClientRect().width;
    return {
      nameCut: nameSpan.scrollWidth > nameSpan.clientWidth,
      nameShare: nameSpan.getBoundingClientRect().width / w,
      physicalCut: physical.scrollWidth > physical.clientWidth,
      physicalTitle: physical.getAttribute("title"),
      overflow: physical.getBoundingClientRect().right > row.getBoundingClientRect().right + 0.5,
    };
  }, name);

for (const [who, form] of [["Łukasz", "the editor's reorder row"], ["Piotr Wiśniewski", "the reviewer's read-only row"]] as const) {
  test(`S38-05: ${form}: the name stays whole, the physical names shorten with their full text in the title`, async ({ page }) => {
    await signInAs(page, who);
    // the details panel at its narrowest, so the sources do not fit
    await setPanels(page, 264, 280);
    await openCanvas(page, canvasUrl());
    await openEntityFromTree(page, "Customer");
    const r = await rowOf(page, "email");
    expect(r.nameCut, "the name whole").toBe(false);
    expect(r.nameShare).toBeLessThanOrEqual(0.65 + 0.01);
    expect(r.physicalCut, "the sources cut").toBe(true);
    expect(r.physicalTitle).toBe(SOURCES);
    expect(r.overflow, "nothing runs out of the row").toBe(false);
  });
}
