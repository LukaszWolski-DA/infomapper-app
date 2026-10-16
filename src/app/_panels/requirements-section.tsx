"use client";

// The Requirements section of the entity, attribute, mapping, source table and column panels (slice 4a, PRD items
// 28–29, prototype reqSection, D-34 panel part): the requirements linked to the element, with × to unlink, then those
// that reach it indirectly (slice 4b-1, PRD item 12: “via attribute”, “via mapping”, “via column”; no “via entity”),
// without ×. A click opens the requirement's
// panel (its card comes with slice 4b; rows are not dragged). Below, for those who may edit: “Link to a requirement…”,
// with “+ New requirement…” at the end, which creates a requirement linked to this element and opens it with its name
// selected. Read from the requirement index, never computed while rendering.

import { createRequirementAction, linkRequirementAction, unlinkRequirementAction } from "@/app/_actions/requirement";
import { useAction } from "@/app/_components/use-action";
import { marks } from "@/domain/model/labels";
import type { TraceTarget } from "@/domain/model/requirements";
import type { Requirement } from "@/domain/types";
import { Field, Fold, Hint, inputClass, List } from "./fields";
import { usePanel } from "./inspector";
import { usePanels } from "./panels-context";
import { KindIcon } from "./requirement-ui";

const NEW = "__new__";

/** The name field a requirement panel focuses after “+ New requirement…” (`usePanels().nameFocus`). */
export const requirementNameFocus = (requirementId: string) => `req:${requirementId}`;

export function RequirementsSection({ target }: { target: TraceTarget }) {
  const p = usePanel();
  const { run } = useAction();
  const { setNameFocus } = usePanels();
  const { direct, indirect } = p.rx.of(target);
  const linked = new Set(direct.map((r) => r.id));
  const available = p.rx.requirements.filter((r) => !linked.has(r.id));

  const unlink = (r: Requirement) => {
    const link = p.rx.linksOf(r.id).find((k) => marks(k, target));
    if (link) void run(() => unlinkRequirementAction(p.workspaceId, { requirementLinkId: link.id, expectedVersion: link.version }), "Unlinked.", { undoable: true });
  };
  const pick = async (value: string) => {
    if (value === NEW) {
      const result = await run(() => createRequirementAction(p.workspaceId, { link: target }));
      if (result.ok) {
        setNameFocus(requirementNameFocus(result.value.requirementId));
        p.goRequirement(result.value.requirementId);
      }
      return;
    }
    await run(() => linkRequirementAction(p.workspaceId, { requirementId: value, target }), (v) => v.message, { undoable: true });
  };

  const row = (r: Requirement, viaText: string | null) => (
    <div key={`${r.id}:${viaText ?? "direct"}`} className="flex items-center gap-1 rounded-md hover:bg-im-hover" data-testid="item-requirement" data-via={viaText ?? undefined} data-key={r.key}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left" onClick={() => p.goRequirement(r.id)} title="Click to open the requirement.">
        <span className="flex flex-none items-center gap-1 text-im-req">
          <KindIcon kind={r.kind} />
          <span className="font-mono text-[11.5px]">{r.key}</span>
        </span>
        <span className="min-w-0 flex-1 truncate">{r.name}</span>
        {viaText && <span className="whitespace-nowrap text-[11.5px] text-im-ink-3">{viaText}</span>}
      </button>
      {!viaText && p.editable && (
        <button
          type="button"
          className="mr-1 grid size-6 flex-none place-items-center rounded text-im-ink-3 hover:bg-im-surface hover:text-im-warn"
          aria-label={`Unlink ${r.key}`}
          title="Unlink"
          onClick={() => unlink(r)}
          data-testid="button-requirement-unlink"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <Fold title="Requirements" count={direct.length + indirect.length} testId="section-requirements">
      {direct.length + indirect.length ? (
        <List testId="list-requirements">
          {direct.map((r) => row(r, null))}
          {indirect.map(({ requirement, via }) => row(requirement, via))}
        </List>
      ) : (
        <Hint>Not linked to any requirement yet.</Hint>
      )}
      {p.editable && (
        <Field label="Link to a requirement" htmlFor={`f-req-${target.kind}`}>
          <select
            id={`f-req-${target.kind}`}
            value=""
            className={inputClass}
            data-testid="select-link-requirement"
            onChange={(e) => e.target.value && void pick(e.target.value)}
          >
            <option value="">Link to a requirement…</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {`${r.key}  ${r.name}`}
              </option>
            ))}
            <option value={NEW}>+ New requirement…</option>
          </select>
        </Field>
      )}
    </Fold>
  );
}
