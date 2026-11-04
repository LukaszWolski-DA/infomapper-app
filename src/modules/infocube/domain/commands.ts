// InfoCube's commands for facts and dimensions (slice 15a, B-1, C-5): a fact or a dimension is an entity of the
// dimensional level, made by InfoMapper's own command, with its role in InfoCube's row in the same change group.

import { buildWriteSet, newRowColumns, type CommandContext, type CommandResult, type Write } from "@/domain/changes";
import { createEntity, type CreateEntityState } from "@/domain/commands/entity";
import type { Uuid } from "@/domain/ids";
import { infocubeOff } from "@/domain/model/levels";
import type { WorkspaceAccess } from "@/domain/permissions";
import { DEFAULT_SCD_TYPE, type CubeEntity, type CubeRole } from "./types";

/** "New fact", "New dimension": numbered among the dimensional names when taken (prototype `createEntity`). */
const DEFAULT_NAME: Record<CubeRole, string> = { fact: "New fact", dimension: "New dimension" };

/**
 * New fact or New dimension (B-1, the Cube tab and the canvas's toolbox): InfoMapper's \`createEntity\` at the dimensional
 * level, then InfoCube's row with the role (a fact without a grain yet, a dimension of SCD type 1). Refused while
 * InfoCube is off in the workspace (C-7); the role, the rights and the rest are \`createEntity\`'s.
 */
export function createCubeEntity(
  ctx: CommandContext,
  access: WorkspaceAccess,
  state: CreateEntityState,
  role: CubeRole,
  input: unknown,
): CommandResult<{ entityId: Uuid; canvasItemId: Uuid | null; warning: string | null }> {
  const made = createEntity(ctx, access, state, input, { level: "dimensional", defaultName: DEFAULT_NAME[role] });
  if (!made.ok) return made;
  if (!access.workspace.infocube) return { ok: false, error: infocubeOff() };
  const cube: CubeEntity = {
    ...newRowColumns(ctx),
    workspace_id: access.workspace.id,
    entity_id: made.value.entityId,
    role,
    grain: null,
    scd_type: role === "dimension" ? DEFAULT_SCD_TYPE : null,
  };
  const writes: Write[] = [...made.writeSet.writes, { kind: "insert", table: "cube_entity", row: cube }];
  return { ok: true, value: made.value, writeSet: buildWriteSet(ctx, access.workspace.id, writes) };
}

/**
 * The end a relationship between two entities must start at (D-67, the prototype's turn): between a fact and a
 * dimension, the dimension (the 1..1 end); otherwise none.
 */
export function dimensionEnd(cubeEntities: readonly Pick<CubeEntity, "entity_id" | "role" | "deleted_at">[], a: Uuid, b: Uuid): Uuid | null {
  const roleOf = (id: Uuid) => cubeEntities.find((c) => c.entity_id === id && c.deleted_at === null)?.role;
  const [ra, rb] = [roleOf(a), roleOf(b)];
  if (ra === "fact" && rb === "dimension") return b;
  if (ra === "dimension" && rb === "fact") return a;
  return null;
}
