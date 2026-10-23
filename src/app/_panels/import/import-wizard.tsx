"use client";

// The import wizard (slice 7a, PRD items 20–28; prototype `openWizard`, `renderWizard`, `doImport`): a modal dialog
// “Import sources into {target}” with three steps (Source, Scope, Review changes) that can be clicked when reachable.
// Everything is read and planned in the browser with the domain's code; “Import into” sends the text and the choices
// to the upload route (`/w/{workspace}/import`), where the server reads and plans again and writes only what the review
// showed (P8). A refusal because the system changed refreshes the page's data; the review then shows the current state,
// keeps the scope and the rename choices that still apply, and says so. Esc and Cancel close it without writing.

import { useRouter } from "next/navigation";
import { useContext, useMemo, useState } from "react";
import type { ActionResult } from "@/app/_lib/run-command";
import { CanvasUiCtx } from "@/canvas/context";
import { importStateOf, STALE_REVIEW_FIELD, type ImportOutcome } from "@/domain/commands/import";
import { planFingerprint } from "@/domain/import/compare";
import { readDdl } from "@/domain/import/ddl";
import { buildPlan } from "@/domain/import/plan";
import { readStandard } from "@/domain/import/standard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { buttonClass, primaryClass } from "../fields";
import { ReviewStep } from "./review-step";
import { ScopeStep } from "./scope-step";
import { SourceStep } from "./source-step";
import { canGo, footNote, impactIndex, targetName, targetOf, type ImportData, type Step, type WizardState } from "./wizard-model";

const STEPS: [Step, string][] = [
  [1, "Source"],
  [2, "Scope"],
  [3, "Review changes"],
];

const emptyDdl: WizardState["ddl"] = { text: "", name: "", database: "", schema: "", translation: null };

export function ImportWizard({
  workspaceId,
  data,
  systemId,
  onClose,
  onImported,
}: {
  workspaceId: string;
  data: ImportData;
  /** “Re-import {system}…”: the system pre-selected (item 20). */
  systemId?: string | null;
  onClose: () => void;
  /** After a successful import: the system it went into (the Sources tab shows it). */
  onImported?: (outcome: ImportOutcome) => void;
}) {
  const ui = useContext(CanvasUiCtx);
  const toast = useToast();
  const router = useRouter();
  const model = data.model;
  const firstSystem = [...model.sourceSystems].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null;
  const [s, setState] = useState<WizardState>(() => ({
    step: 1,
    mode: systemId || firstSystem ? "existing" : "new",
    systemId: systemId ?? firstSystem,
    newName: "",
    channel: "file",
    vendor: "sqlserver",
    text: "",
    sourceLabel: "",
    read: null,
    ddl: emptyDdl,
    scope: new Set(),
    compare: "schemas",
    renames: new Map(),
    filter: "all",
    stale: null,
  }));
  const set = (patch: Partial<WizardState>) => setState((x) => ({ ...x, ...patch }));
  const [sending, setSending] = useState(false);

  const state = useMemo(() => importStateOf(model), [model]);
  const target = targetOf(s);
  const plan = useMemo(() => {
    if (!s.read || s.read.errors.length || !target) return null;
    return buildPlan(state.model, s.read, target, { scope: s.scope, compare: s.compare, renames: s.renames });
    // the target's identity, not the object, decides
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, s.read, s.mode, s.systemId, s.newName, s.scope, s.compare, s.renames]);
  const index = useMemo(() => impactIndex(data), [data]);
  const name = targetName(s, model);

  /** A file or a paste read as the standard (items 14, 15); all its tables in scope. */
  const takeText = (text: string, label: string) => {
    const read = readStandard(text, label);
    set({ text, sourceLabel: label, read, scope: new Set(read.tables.map((t) => t.key)), renames: new Map(), stale: null });
  };
  /** A DDL script translated and read (items 16–18). */
  const readScript = (ddl: WizardState["ddl"]) => {
    const { translation, read } = readDdl(ddl.text, { database: ddl.database, schema: ddl.schema, fileName: ddl.name });
    set({ ddl: { ...ddl, translation }, text: ddl.text, sourceLabel: ddl.name, read, scope: new Set(read.tables.map((t) => t.key)), renames: new Map(), stale: null });
  };
  const clear = () => set({ text: "", sourceLabel: "", read: null, ddl: { ...s.ddl, translation: null }, scope: new Set(), renames: new Map(), stale: null });

  async function importNow() {
    if (!plan || !target || sending) return;
    setSending(true);
    let result: ActionResult<ImportOutcome>;
    try {
      const response = await fetch(`/w/${workspaceId}/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          channel: s.channel,
          sourceLabel: s.sourceLabel,
          text: s.text,
          ...(s.channel === "ddl" ? { ddl: { database: s.ddl.database, schema: s.ddl.schema } } : {}),
          scope: [...s.scope],
          compare: s.compare,
          renames: [...s.renames],
          fingerprint: planFingerprint(plan),
        }),
      });
      result = (await response.json()) as ActionResult<ImportOutcome>;
    } catch {
      result = { ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." };
    }
    setSending(false);
    if (!result.ok) {
      if (result.fields?.[STALE_REVIEW_FIELD]) {
        // P8: the review shows the system as it is now; the plan keeps the choices that still apply
        set({ stale: result.message, step: 3 });
        router.refresh();
      } else toast(result.message, "refusal");
      return;
    }
    const outcome = result.value;
    const undo = ui.undo();
    toast(`Imported into ${outcome.systemName}: ${outcome.summary}`, "info", undo ? { label: "Undo", run: undo.undo } : undefined);
    router.refresh();
    onImported?.(outcome);
    onClose();
  }

  const go = (step: Step) => canGo(step, s, model, plan) && set({ step });
  const body =
    s.step === 1 ? (
      <SourceStep s={s} set={set} model={model} lastImports={data.lastImports} takeText={takeText} readScript={readScript} clear={clear} />
    ) : s.step === 2 ? (
      <ScopeStep s={s} set={set} model={model} plan={plan} systemName={name} />
    ) : plan ? (
      <ReviewStep s={s} set={set} plan={plan} data={data} index={index} systemName={name} />
    ) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="grid h-[min(760px,calc(100vh-32px))] w-[min(980px,calc(100vw-32px))] max-w-none grid-rows-[auto_1fr_auto] gap-0 border-im-line bg-im-surface p-0 text-[13px] text-im-ink sm:max-w-none"
        data-testid="dialog-import"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-im-line px-[18px] pb-3 pt-3.5 pr-12">
          <DialogTitle className="min-w-[200px] flex-1 text-[15px] font-semibold" data-testid="import-title">
            Import sources into {name || "…"}
          </DialogTitle>
          <DialogDescription className="sr-only">Three steps: source, scope, review changes. Nothing is written until you import.</DialogDescription>
          <ol className="flex gap-1">
            {STEPS.map(([n, label]) => {
              const current = s.step === n;
              const done = s.step > n;
              return (
                <li key={n}>
                  <button
                    type="button"
                    aria-current={current ? "step" : undefined}
                    disabled={!canGo(n, s, model, plan)}
                    onClick={() => go(n)}
                    className={`inline-flex h-7 items-center gap-[7px] rounded-[14px] pl-1.5 pr-2.5 disabled:cursor-default disabled:opacity-55 ${current ? "bg-im-logical-soft text-im-logical" : done ? "text-im-ink-2" : "text-im-ink-3"}`}
                    data-testid={`wizard-step-${n}`}
                  >
                    <span className={`inline-grid size-[18px] place-items-center rounded-full border text-[11px] ${done ? "border-im-ink-2 bg-im-ink-2 text-im-surface" : "border-current"}`}>{n}</span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="min-h-0 overflow-auto px-5 pb-6 pt-[18px]" data-testid="wizard-body">
          {body}
        </div>
        <div className="flex items-center gap-2 border-t border-im-line bg-im-panel px-[18px] py-3">
          <span className="min-w-0 flex-1 text-xs text-im-ink-3" data-testid="wizard-note">
            {footNote(s, model)}
          </span>
          {s.step > 1 ? (
            <button type="button" className={buttonClass} onClick={() => set({ step: (s.step - 1) as Step })} data-testid="button-wizard-back">
              Back
            </button>
          ) : (
            <button type="button" className={buttonClass} onClick={onClose} data-testid="button-wizard-cancel">
              Cancel
            </button>
          )}
          {s.step < 3 ? (
            <button type="button" className={primaryClass} disabled={!canGo((s.step + 1) as Step, s, model, plan)} onClick={() => go((s.step + 1) as Step)} data-testid="button-wizard-next">
              Next
            </button>
          ) : (
            <button type="button" className={primaryClass} disabled={!canGo(3, s, model, plan) || !plan || sending} onClick={() => void importNow()} data-testid="button-wizard-import">
              Import into {name}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
