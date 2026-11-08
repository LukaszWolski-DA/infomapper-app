"use server";

// Calculated attributes from the attribute panel (slice 18, item 1, D-73): calculate, add and remove inputs, the rule,
// stop calculating. Each answers the calculated attribute's new version, for the panel's save chain (slice 9).

import {
  addAttributeInputs,
  calculateAttribute,
  removeAttributeInput,
  setCalculationRule,
  stopCalculating,
  type CalculateAttributeInput,
  type RemoveAttributeInputInput,
  type SetCalculationRuleInput,
} from "@/domain/commands/derivation";
import type { WorkspaceModel } from "@/domain/types";
import { modelCommand } from "../_lib/model-command";
import { type ActionResult, type Saved } from "../_lib/run-command";

const stateOf = (model: WorkspaceModel, attributeId: unknown) => ({
  attribute: model.attributes.find((a) => a.id === attributeId) ?? null,
  attributes: model.attributes,
  attributeInputs: model.attributeInputs,
});

export async function calculateAttributeAction(workspaceId: string, input: CalculateAttributeInput): Promise<ActionResult<Saved<{ toast: string }>>> {
  return modelCommand(workspaceId, (ctx, access, model) => calculateAttribute(ctx, access, stateOf(model, input?.attributeId), input));
}

export async function addAttributeInputsAction(workspaceId: string, input: CalculateAttributeInput): Promise<ActionResult<Saved<{ toast: string }>>> {
  return modelCommand(workspaceId, (ctx, access, model) => addAttributeInputs(ctx, access, stateOf(model, input?.attributeId), input));
}

export async function removeAttributeInputAction(workspaceId: string, input: RemoveAttributeInputInput): Promise<ActionResult<Saved>> {
  return modelCommand(workspaceId, (ctx, access, model) => removeAttributeInput(ctx, access, stateOf(model, input?.attributeId), input));
}

export async function setCalculationRuleAction(workspaceId: string, input: SetCalculationRuleInput): Promise<ActionResult<Saved>> {
  return modelCommand(workspaceId, (ctx, access, model) => setCalculationRule(ctx, access, stateOf(model, input?.attributeId), input));
}

export async function stopCalculatingAction(workspaceId: string, input: { attributeId: string; expectedVersion: number }): Promise<ActionResult<Saved<{ toast: string }>>> {
  return modelCommand(workspaceId, (ctx, access, model) => stopCalculating(ctx, access, stateOf(model, input?.attributeId), input));
}
