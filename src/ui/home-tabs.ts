// The workspace home's tabs and a module's tab among them (slice 25, step 1's F10; AD-33's addition as proposed): the
// home's own tabs are fixed, a module's tabs come after Overview, as the prototype's Documentation tab does. A module's
// tab is shown only while it says so (InfoDocumenter's while it is on); `?tab=` naming a tab that is not shown opens
// Overview.

import type { ReactNode } from "react";

/** The home's own tabs, in order (slice 23: Metadata conventions between People and Settings). */
export const CORE_HOME_TABS = ["overview", "people", "conventions", "settings"] as const;
export type CoreHomeTab = (typeof CORE_HOME_TABS)[number];

/** A module's tab on the workspace home: its id in `?tab=` and its test id (`tab-{id}`), its label, and its body. */
export interface ModuleHomeTab {
  readonly id: string;
  readonly label: string;
  /** Rendered only while the tab is chosen. */
  readonly body: () => Promise<ReactNode> | ReactNode;
}

/** The tabs' ids in order: Overview, the modules' tabs, then the home's others. */
export function homeTabOrder(moduleTabs: readonly Pick<ModuleHomeTab, "id">[]): string[] {
  const [first, ...rest] = CORE_HOME_TABS;
  return [first, ...moduleTabs.map((t) => t.id), ...rest];
}

/** The tab `?tab=` chooses among those shown; anything else is Overview. */
export function chosenHomeTab(param: unknown, moduleTabs: readonly Pick<ModuleHomeTab, "id">[]): string {
  return typeof param === "string" && homeTabOrder(moduleTabs).includes(param) ? param : "overview";
}
