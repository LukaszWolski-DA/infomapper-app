"use client";

// The right panel when nothing is selected (prototype insOverview, the parts of slice 1a): what is on this canvas,
// mapping coverage per entity, and the mappings with a type problem to look at. Slice 2a: the canvas's look
// (background and grid) for those who may change it.

import { LookControls, useCanvasLook } from "@/canvas/look";
import { Fold, Hint, Kind, Li, LongList, TypeDot } from "./fields";
import { usePanel } from "./inspector";
import { inputsLabel, typeCheckOf } from "./model-index";
import { coverage } from "./stats";

export function OverviewPanel({ entityIds, tableCount, canvasName, canvasCount }: { entityIds: string[]; tableCount: number; canvasName: string; canvasCount: number }) {
  const p = usePanel();
  const look = useCanvasLook();
  const cov = coverage(p.ix, entityIds);
  const problems = p.ix.model.mappings.filter((m) => !typeCheckOf(p.ix, m).ok);
  const ents = cov.length;
  return (
    <div data-testid="inspector-overview">
      <Kind>Nothing selected</Kind>
      <h2 className="text-base font-semibold">Model workspace</h2>
      <Hint>
        {ents} entit{ents === 1 ? "y" : "ies"} and {tableCount} source table{tableCount === 1 ? "" : "s"} on <b>{canvasName}</b>. The
        model is shared by {canvasCount} canvas{canvasCount === 1 ? "" : "es"}. Select anything to see and edit its details here.
      </Hint>
      {ents > 0 && (
        <Fold title="Mapping coverage" count={ents}>
          <LongList
            items={cov}
            testId="list-coverage"
            text={(c) => c.entity.name}
            render={({ entity, attributes, mapped }) => (
              <Li key={entity.id} onClick={() => p.goEntity(entity.id)} meta={`${mapped} of ${attributes}`}>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{entity.name}</span>
                  <span className="h-[5px] w-[60px] flex-none overflow-hidden rounded-[3px] bg-im-line">
                    <i className="block h-full bg-im-map" style={{ width: `${attributes ? (mapped / attributes) * 100 : 0}%` }} />
                  </span>
                </span>
              </Li>
            )}
          />
        </Fold>
      )}
      {problems.length > 0 && (
        <Fold title="Needs attention" count={problems.length}>
          <LongList
            items={problems}
            testId="list-needs-attention"
            text={(m) => inputsLabel(p.ix, m.id)}
            render={(m) => (
              <Li key={m.id} onClick={() => p.goMapping(m.id)} meta="type">
                <span className="flex items-center gap-2">
                  <TypeDot ok={false} />
                  <span className="truncate font-mono text-xs">{inputsLabel(p.ix, m.id)}</span>
                </span>
              </Li>
            )}
          />
        </Fold>
      )}
      {look?.editable && (
        <Fold title="Canvas look" testId="section-canvas-look">
          <LookControls part="background" look={look.look} onChange={look.setLook} />
          <div className="mt-2">
            <LookControls part="grid" look={look.look} onChange={look.setLook} />
          </div>
        </Fold>
      )}
    </div>
  );
}
