// The modules' model checks (slice 20, the extension point; acceptance doc, "The extension point and the index"): each
// module's groups for InfoMapper's `modelChecks`, which never names a module. Pure and without the data layer, so a
// canvas page builds them from its own module rows (`ModuleView.data`); the home reads the rows with `moduleHomeData`
// (`view.ts`), in the one read it makes for coverage too. While a module is off it adds nothing.

import type { CheckInput, ModuleChecks } from "@/domain/model/checks";
import type { ModuleView } from "@/ui/modules";
import { cubeChecks, NO_CHECK_ROWS, type CubeCheckRows } from "@/modules/infocube/domain/checks";

/** InfoCube's checks from its rows, or none while it is off in the workspace. */
export function cubeModuleChecks(on: boolean, rows: CubeCheckRows | null | undefined, input: CheckInput): ModuleChecks[] {
  return on ? [cubeChecks(rows ?? NO_CHECK_ROWS, input)] : [];
}

/** A canvas page's module checks, from the page's module rows: InfoCube's while its Cube tab is there (it is on). */
export function pageModuleChecks(view: ModuleView, input: CheckInput): ModuleChecks[] {
  return cubeModuleChecks(
    view.tabs.some((t) => t.id === "cube"),
    view.data.infocube as CubeCheckRows | undefined,
    input,
  );
}
