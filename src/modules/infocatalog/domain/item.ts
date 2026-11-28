// An item's drawer as the browser receives it (slice 39, S39-04, S39-05): its header, its details, where it is shown
// and what "Open in InfoMapper" does. Plain data, built on the server (`catalogItemView` in the composition root). Its
// address is the catalog's with `item={kind}:{workspaceId}:{id}` (C7).

import type { CatalogCanvas } from "@/domain/catalog/canvases";
import type { CatalogDocument } from "@/domain/catalog/contribution";
import type { CatalogDetails } from "@/domain/catalog/details";
import { isUuid, type Uuid } from "@/domain/ids";

export interface ItemRef {
  readonly kind: string;
  readonly workspaceId: Uuid;
  readonly id: Uuid;
}

export const itemRefText = (r: ItemRef): string => `${r.kind}:${r.workspaceId}:${r.id}`;

/** An item's reference from the address, or null when it is not one. */
export function parseItemRef(text: string | null | undefined): ItemRef | null {
  const parts = (text ?? "").split(":");
  if (parts.length !== 3) return null;
  const [kind, workspaceId, id] = parts as [string, string, string];
  return /^[a-z_]{1,40}$/.test(kind) && isUuid(workspaceId) && isUuid(id) ? { kind, workspaceId, id } : null;
}

export interface CatalogItemView {
  readonly ref: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly id: Uuid;
  readonly workspaceId: Uuid;
  readonly name: string;
  readonly path: string;
  readonly workspace: { readonly name: string; readonly archived: boolean; readonly hasRole: boolean };
  readonly marks: readonly { text: string; tone: "pii" | "plain" }[];
  readonly details: CatalogDetails;
  /** The canvases that show it, the best first (Context, and "Open in InfoMapper"'s target). */
  readonly canvases: readonly CatalogCanvas[];
  /** The documents that include it, as the reader sees them in InfoMapper (C4). */
  readonly documents: readonly CatalogDocument[];
  /** The workspace's owners by name: who a reader without a role asks for access (S39-05). */
  readonly owners: readonly string[];
  /** A workspace home's tab that shows it instead of a canvas (classifications and stereotypes). */
  readonly homeTab: string | null;
}

/** "You have no role in {workspace}. Ask its owner for access: {owners}." */
export const noRoleText = (workspace: string, owners: readonly string[]): string =>
  `You have no role in ${workspace}. Ask its owner for access${owners.length ? `: ${owners.join(", ")}` : ""}.`;

/** The workspace home's `?gone=` when "Open in InfoMapper" finds the item on no canvas (with `item={kind}:{id}`). */
export const OFF_CANVAS = "off-canvas";

/** "{name} is not on any canvas." */
export const offCanvasText = (name: string): string => `${name} is not on any canvas.`;
