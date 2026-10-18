// S4B2-01 (slice 4b-2, PRD items 1–4, D-41): the requirement card. Its header (kind's icon, key, kind's name), name,
// status pill, “{m} of {n} covered” and the bar's three parts match the domain for REQ-101 (an entity item), REQ-104
// (seeded; one covered, three not mapped) and REQ-105 (one mapped but not approved); the tooltip is the description's
// first 300 characters; below 40 % the header and a plain block of the same height.

import { buildRequirementIndex } from "../../src/domain/model/requirement-index";
import { coverageBar, KIND_NAMES, STATUS_NAMES } from "../../src/domain/model/requirements";
import { expect, test } from "./fixtures";
import { canvasUrl, loadModel, loadRequirementLinks, loadRequirements, openCanvas, placeReqCards, reqCard, reqNode, signInAs } from "./helpers";

/** The whole of “Customer & orders” with the cards placed below, at 45 % (above the 40 % threshold). */
const VIEW = { x: 10, y: 10, zoom: 0.42 };

test("S4B2-01: the card's header, name, status, coverage and bar match the domain for REQ-101, REQ-104 and REQ-105; the tooltip; below 40 % header and block", async ({ page }) => {
  // test data: REQ-101's and REQ-105's cards beside the seeded REQ-104
  await placeReqCards([
    { key: "REQ-101", x: 1536, y: 40 },
    { key: "REQ-105", x: 1536, y: 240 },
  ]);
  const [requirements, links, model] = await Promise.all([loadRequirements(), loadRequirementLinks(), loadModel()]);
  const index = buildRequirementIndex(requirements, links, model);

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), VIEW);

  const bars: Record<string, ReturnType<typeof coverageBar>> = {};
  for (const key of ["REQ-101", "REQ-104", "REQ-105"]) {
    const r = requirements.find((x) => x.key === key)!;
    const c = index.coverage(r.id);
    const bar = coverageBar(c);
    bars[key] = bar;
    const card = reqCard(page, key);
    await expect(card, key).toBeVisible();
    await expect(card.locator(".rh .k")).toHaveText(key);
    await expect(card.locator(".rh .kind")).toHaveText(KIND_NAMES[r.kind]);
    await expect(card.locator(`.rh .ric.${r.kind}`)).toHaveCount(1);
    await expect(card.getByTestId("card-name")).toHaveText(r.name);
    await expect(card.getByTestId("pill-status")).toHaveText(STATUS_NAMES[r.status]);
    await expect(card.getByTestId("text-requirement-coverage")).toHaveText(c.total ? `${bar.covered} of ${c.total} covered` : "nothing traced yet");
    const tri = card.getByTestId("bar-requirement");
    await expect(tri).toHaveAttribute("data-covered", String(bar.covered));
    await expect(tri).toHaveAttribute("data-mapped", String(bar.mapped));
    await expect(tri).toHaveAttribute("data-not-mapped", String(bar.notMapped));
    await expect(tri).toHaveAttribute("title", `${bar.covered} covered, ${bar.mapped} mapped but not approved, ${bar.notMapped} not mapped`);
    // the tooltip: the description's first 300 characters as plain text
    await expect(card).toHaveAttribute("title", (r.description_text ?? "").slice(0, 300));
    // 230 px wide; the name fits above the bar (the card's height comes from its name's lines)
    const fits = await card.evaluate((el) => {
      const name = el.querySelector(".rn")!.getBoundingClientRect(), tri = el.querySelector(".tri")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el.querySelector(".rn")!);
      return { textBottom: range.getBoundingClientRect().bottom, nameBottom: name.bottom, triTop: tri.top, width: (el as HTMLElement).offsetWidth };
    });
    expect(fits.width).toBe(230);
    expect(fits.textBottom).toBeLessThanOrEqual(fits.triTop + 0.5);
  }
  // the seed's figures (D-31 over items): REQ-101 its entity covered; REQ-104 one of four, three not mapped; REQ-105
  // three of four, birth_date's mapping in review
  expect(bars).toEqual({
    "REQ-101": { covered: 1, mapped: 0, notMapped: 0 },
    "REQ-104": { covered: 1, mapped: 0, notMapped: 3 },
    "REQ-105": { covered: 3, mapped: 1, notMapped: 0 },
  });

  // below 40 %: the header and a plain block of the same height, no name, bar or footer (AD-24 rule 1)
  const before = await reqNode(page, "REQ-105").evaluate((el) => (el as HTMLElement).offsetHeight);
  await openCanvas(page, canvasUrl(), { ...VIEW, zoom: 0.3 });
  const card = reqCard(page, "REQ-105");
  await expect(card.getByTestId("card-block")).toBeVisible();
  await expect(card.locator(".rh .k")).toHaveText("REQ-105");
  await expect(card.getByTestId("card-name")).toHaveCount(0);
  await expect(card.getByTestId("bar-requirement")).toHaveCount(0);
  await expect(card.getByTestId("pill-status")).toHaveCount(0);
  expect(await reqNode(page, "REQ-105").evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(before);
});
