// The workspace home's tabs with a module's (slice 25, F10): a module's tabs after Overview; `?tab=` naming a tab that
// is not shown, or nothing, opens Overview.

import { describe, expect, it } from "vitest";
import { chosenHomeTab, homeTabOrder } from "./home-tabs";

describe("the workspace home's tabs", () => {
  it("puts a module's tabs after Overview, before the home's other tabs", () => {
    expect(homeTabOrder([])).toEqual(["overview", "people", "conventions", "settings"]);
    expect(homeTabOrder([{ id: "docs" }])).toEqual(["overview", "docs", "people", "conventions", "settings"]);
  });

  it("chooses a shown tab, and Overview for anything else", () => {
    expect(chosenHomeTab("docs", [{ id: "docs" }])).toBe("docs");
    expect(chosenHomeTab("docs", [])).toBe("overview");
    expect(chosenHomeTab("settings", [])).toBe("settings");
    expect(chosenHomeTab(undefined, [])).toBe("overview");
    expect(chosenHomeTab(["people"], [])).toBe("overview");
  });
});
