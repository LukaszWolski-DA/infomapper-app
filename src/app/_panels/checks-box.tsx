"use client";

// "Model checks" at the top of an element's panel (slice 20, PRD item 6, Z7, Z8; prototype `chkSection`): right after
// the panel's kind line, only when the object has lines; a box with an orange edge when one is High, the "!", the title
// and the count; one item per line, "{group}. {name}: {detail}" (an attribute's own line shows only the detail), High
// first; an item naming another object selects it. A fact's hints are not repeated: the box ends with "{n} hints in the
// Fact section below." and shows for them alone. Read only: readers and reviewers see the same. The words are built when
// the panel opens. The entity, attribute and relationship panels render it, and so does a module's panel (InfoCube's
// dimensional mapping) through InfoMapper's app part.

import { useContext, useMemo } from "react";
import { CanvasUiCtx } from "@/canvas/context";
import { CHECK_TEXTS, lineOf, type CheckRef } from "@/domain/model/checks";
import { useChecks } from "../_components/modules";
import { usePanel } from "./inspector";

export function ChecksBox({ of }: { of: CheckRef }) {
  const index = useChecks();
  const p = usePanel();
  const ui = useContext(CanvasUiCtx);
  const key = of.t === "ext" ? `${of.kind}:${of.id}` : `${of.t}:${of.id}`;
  const lines = useMemo(() => (index ? index.panel(of).map((x) => ({ x, line: lineOf(x.item) })) : []), [index, key]); // eslint-disable-line react-hooks/exhaustive-deps -- `of` by its key
  const hints = index && of.t === "entity" ? index.hintsOf(of.id) : 0;
  if (!lines.length && !hints) return null;
  const high = lines.some(({ x }) => x.group.high);
  const same = (r: CheckRef) => r.t === of.t && r.id === of.id && (r.t !== "ext" || (of.t === "ext" && r.kind === of.kind));
  /** Another object: its card or row here, else its panel (the panels' go-to links, slice 4a). */
  const go = (r: CheckRef) => {
    if (r.t === "entity") return p.goEntity(r.id);
    if (r.t === "attribute") return p.goAttribute(r.id);
    ui.select(r.t === "relationship" ? { t: "rel", id: r.id } : { t: "ext", kind: r.kind, id: r.id });
  };
  return (
    <div className={`mb-3 mt-2 rounded-lg border border-im-line bg-im-surface px-2.5 py-2 ${high ? "border-l-[3px] border-l-im-warn" : ""}`} data-testid="box-model-checks" data-high={high || undefined}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px]">
        <span className={`w-2.5 -skew-x-12 text-center text-sm font-bold italic leading-none ${high ? "text-im-warn" : "text-im-ink-3"}`} aria-hidden>
          !
        </span>
        <b className="font-semibold">{CHECK_TEXTS.title}</b>
        <span className="text-im-ink-3">{lines.length + hints}</span>
      </div>
      <div className="flex flex-col gap-1">
        {lines.map(({ x, line }) => {
          const self = same(line.go);
          const own = of.t === "attribute" && line.go.t === "attribute" && line.go.id === of.id;
          const text = own ? line.detail : `${line.name}: ${line.detail}`;
          const cls = `block w-full rounded px-2 py-1 text-left text-xs ${x.group.high ? "bg-im-warn-soft" : "bg-im-hover"}`;
          return self ? (
            <div key={`${x.group.id}:${line.name}`} className={cls} data-testid="item-model-check" data-group={x.group.id}>
              <b className="font-semibold">{x.group.title}.</b> {text}
            </div>
          ) : (
            <button key={`${x.group.id}:${line.name}`} type="button" className={`${cls} hover:underline`} onClick={() => go(line.go)} data-testid="item-model-check" data-group={x.group.id}>
              <b className="font-semibold">{x.group.title}.</b> {text}
            </button>
          );
        })}
        {hints > 0 && (
          <span className="block w-full rounded bg-im-hover px-2 py-1 text-xs" data-testid="item-model-check-hints">
            {CHECK_TEXTS.hints(hints)}
          </span>
        )}
      </div>
    </div>
  );
}
