"use client";

// The Labels field in the right panel's element panels (slice 3a): `LabelsField` fed from the panel context.

import type { LabelTarget } from "@/domain/model/labels";
import { usePanel } from "./inspector";
import { LabelsField } from "./labels-field";

export function ItemLabels({ target }: { target: LabelTarget }) {
  const p = usePanel();
  return <LabelsField workspaceId={p.workspaceId} target={target} labels={p.labels} links={p.labelLinks} editable={p.editable} onOpen={p.goLabel} />;
}
