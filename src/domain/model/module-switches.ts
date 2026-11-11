// The modules' switches on a workspace (AD-35): each a column of `workspace`, on only with the organization's licence
// (slice 15a for InfoCube, slice 25 for InfoDocumenter). What turning one off needs is the module's: InfoCube only
// without facts or dimensions (`levels.ts`), InfoDocumenter at any time (its documents are outside the model and kept).

import type { LicensedModule } from "../types";

/** A module's name in InfoMapper's texts. */
export const MODULE_NAMES: Readonly<Record<LicensedModule, string>> = { infocube: "InfoCube", infodoc: "InfoDocumenter" };

/** "{organization} has no {module} licence." (AD-35). */
export const licenceMissingMessage = (module: LicensedModule, organization: string): string => `${organization} has no ${MODULE_NAMES[module]} licence.`;

/** What turning a module on needs, read by the action only when the input changes its switch. */
export interface ModuleLicenceState {
  licensed: boolean;
  organizationName: string;
}
