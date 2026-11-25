// S35-01 (slice 35, criterion 1; B1.1 to B1.3, B2.5, B2.6): the workspace home's "Baselines (n)" after Documentation and
// before People. An Owner or a Modeler takes a baseline with a name (required, at most 120 characters) and an optional
// note (at most 1,000); it appears first with its name, date and time to the minute, its taker, its note and its counts,
// and the tab's number goes up. A name another baseline has in any letter case is refused and nothing is made. Every
// member sees the list (a Reviewer, a Reader who is a guest); they do not see the form; in an archived workspace nobody does.
import { test, expect } from "./fixtures";
import { withoutScript } from "../slice-32/helpers";
import { archive, baselinesUrl, createInBox, DEMO_BASELINE, expectToast, minute, openBaselines, rowNamed, rows, signInAs, storedBaseline, storedBaselines, tabLabel } from "./helpers";

test.use({ seed: "full" });

test("S35-01: the tab, taking a baseline, the refused names, every member's list, the archive", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await expect(page.locator('[role="tablist"] [role="tab"]')).toHaveText(["Overview", /^Documentation \(\d+\)$/, "Baselines (1)", /^People \(\d+\)$/, "Metadata conventions", "Settings"]);
  await expect(page.getByTestId("text-baselines-intro")).toHaveText(
    "A baseline freezes the model (entities, attributes, sources, mappings, relationships, requirements) with a name, e.g. for a sign-off. Compare it with today, or produce documentation exactly as it was.",
  );
  // the demo's baseline: its time in the browser's time zone, its taker, its note and its stored counts
  const demo = (await storedBaseline(DEMO_BASELINE.name))!;
  await expect(rowNamed(page, DEMO_BASELINE.name).getByTestId("baseline-meta")).toHaveText(
    `${minute(DEMO_BASELINE.at)} by Łukasz · ${DEMO_BASELINE.note} · ${demo.entity_count} entities, ${demo.mapping_count} mappings, ${demo.requirement_count} requirements`,
  );
  await expect(page.getByTestId("input-baseline-name")).toHaveAttribute("maxlength", "120");
  await expect(page.getByTestId("input-baseline-note")).toHaveAttribute("maxlength", "1000");
  await expect(page.getByTestId("input-baseline-name")).toHaveAttribute("placeholder", "Name, e.g. Stage 2 sign-off");

  // an empty name, then a name taken in another letter case: refused, nothing made
  await page.getByTestId("button-create-baseline").click();
  await expectToast(page, "Give the baseline a name.");
  await createInBox(page, "STAGE 1 SIGN-OFF");
  await expectToast(page, "A baseline named STAGE 1 SIGN-OFF already exists in this workspace.");
  expect(await storedBaselines()).toHaveLength(1);

  // taken: first in the list, to the minute, by Łukasz, the note, the counts; the tab says 2
  const before = Date.now();
  await createInBox(page, "Stage 2 sign-off", "Agreed with the data owner.");
  await expectToast(page, "Created the baseline Stage 2 sign-off.");
  await expect(tabLabel(page)).toHaveText("Baselines (2)");
  await expect(rows(page).first().getByTestId("baseline-name")).toHaveText("Stage 2 sign-off");
  const made = (await storedBaseline("Stage 2 sign-off"))!;
  expect(new Date(made.created_at).getTime()).toBeGreaterThanOrEqual(before - 60_000);
  await expect(rows(page).first().getByTestId("baseline-meta")).toHaveText(
    `${minute(made.created_at)} by Łukasz · Agreed with the data owner. · ${made.entity_count} entities, ${made.mapping_count} mappings, ${made.requirement_count} requirements`,
  );
  await expect(page.getByTestId("input-baseline-name")).toHaveValue("");

  // a Modeler takes one too
  await signInAs(page, "Anna Nowak");
  await openBaselines(page);
  await createInBox(page, "Anna's check");
  await expectToast(page, "Created the baseline Anna's check.");
  await expect(rows(page).first().getByTestId("baseline-meta")).toContainText(" by Anna Nowak · ");

  // a Reviewer and a Reader (a guest) see the list, without the form
  for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
    await signInAs(page, name);
    await openBaselines(page);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByTestId("box-new-baseline")).toHaveCount(0);
  }

  // archived: nobody sees the form, the Owner neither
  await archive();
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByTestId("box-new-baseline")).toHaveCount(0);
});

// Step 3's acceptance: the server's HTML shows no time in any zone; the time's place keeps its width, so nothing moves when
// the browser's time replaces it (the page with JavaScript off is what the server's HTML alone paints).
test("S35-01: before the browser's time is known, nothing in the time's place, at the same width", async ({ page, browser, context }) => {
  await signInAs(page, "Łukasz");
  await openBaselines(page);
  const time = rowNamed(page, DEMO_BASELINE.name).getByTestId("baseline-time");
  await expect(time).toHaveText(minute(DEMO_BASELINE.at));
  const live = (await time.boundingBox())!;
  const utc = new Date(DEMO_BASELINE.at).toISOString().slice(0, 16).replace("T", " ");

  const html = await (await page.request.get(baselinesUrl())).text();
  expect(html).not.toContain(utc);
  expect(html).not.toContain(minute(DEMO_BASELINE.at));
  expect(html).toContain('data-testid="baseline-time-pending"');

  const bare = await withoutScript(browser, context, "light");
  try {
    await bare.page.setViewportSize({ width: 1440, height: 900 });
    await bare.page.goto(baselinesUrl());
    const pending = rowNamed(bare.page, DEMO_BASELINE.name).getByTestId("baseline-time-pending");
    await expect(pending).toBeHidden();
    const width = await pending.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(width - live.width)).toBeLessThan(0.5);
    const by = rowNamed(bare.page, DEMO_BASELINE.name).getByTestId("baseline-meta");
    await expect(by).toContainText(" by Łukasz · ");
  } finally {
    await bare.context.close();
  }
});
