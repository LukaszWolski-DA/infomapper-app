"use client";

// Workspace settings as in the prototype: each field saves when it changes (no Save button).
// Every save goes through the workspace's save chain (slice 9) with the newest version known; a stale version is refused
// with the domain's message (AD-12), and the refusal brings the fresh page. Slice 13 (D-66): a text field keeps its
// draft across fresh pages and after a refusal (an empty name goes back with "Enter a name.", D-59); the language and
// the two modes show the newest stored value after a refusal. Settings are not undo steps; slice 21's concept colours
// are (they change the model's concepts, D-76), and since slice 23 they are edited in the Metadata conventions tab: the
// settings' "Model conventions" box only points there (F12, a deliberate difference: no chips). A draft refused for a
// permission or the archive stays readable: its field is read-only instead of disabled, so its text can be copied.
// Slice 7c (item 17, answers F16, F17): the methodology text names the source table panels; switching Data Vault 2.0
// mode off says how many uses of Data Vault classifications stay stored.

import { DATA_VAULT_MODE_TEXT, dataVaultOffMessage } from "@/domain/model/classifications";
import Link from "next/link";
import type { ReactNode } from "react";
import { CONVENTIONS_TAB, workspaceHref } from "@/app/_lib/paths";
import { DOC_LANGUAGE_OPTIONS } from "@/ui/doc-languages";
import type { DocLanguage } from "@/domain/types";
import { setConceptColorAction } from "@/app/_actions/model";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { CONCEPT_PALETTE } from "@/domain/model/concept-colors";
import { useAction } from "@/app/_components/use-action";
import { DraftLine, useChoice, useDraft } from "@/app/_panels/fields";
import { NAME_REQUIRED } from "@/domain/validation";
import { useToast } from "@/ui/components/toast";

export interface SettingsValues {
  workspaceId: string;
  version: number;
  name: string;
  clientName: string;
  description: string;
  docLanguage: DocLanguage;
  dv2Mode: boolean;
  fourEyes: boolean;
}

const LANGUAGES = DOC_LANGUAGE_OPTIONS;

/** Settings' "Model conventions" box (slice 23, F12): the sentence, then the button that opens the tab. */
export const MODEL_CONVENTIONS_TEXT = "Classifications, concept colours and naming conventions are edited in";

type Patch = Partial<Omit<SettingsValues, "workspaceId" | "version">>;

const SAVED_MESSAGE = (patch: Patch, dataVaultUses: number): string => {
  if (patch.dv2Mode !== undefined) return patch.dv2Mode ? "Data Vault 2.0 mode is on." : dataVaultOffMessage(dataVaultUses);
  if (patch.fourEyes !== undefined) return patch.fourEyes ? "Four-eyes approval is on." : "Four-eyes approval is off.";
  return "Settings saved.";
};

const fieldClass =
  "min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 disabled:opacity-60 disabled:cursor-default";

/**
 * `dataVaultUses`: the workspace's uses of Data Vault classifications (answer F16), for the mode-off message. `modules`:
 * the modules' boxes after Data Vault 2.0 mode (slice 15a, O2), from the composition root.
 */
/** A concept as the "Concept colours" box shows it (slice 21, D-76): its row's version, for the save chain. */
export interface ConceptColorRow {
  id: string;
  version: number;
  name: string;
  color: string;
}

export function SettingsForm({
  initial,
  editable,
  dataVaultUses = 0,
  modules,
}: {
  initial: SettingsValues;
  editable: boolean;
  dataVaultUses?: number;
  modules?: ReactNode;
}) {
  const { saveRow } = useAction();
  const toast = useToast();

  // after this workspace's earlier saves, with the newest version known (slice 9): the page's or the last answer's
  const save = (patch: Patch) =>
    saveRow(
      { id: initial.workspaceId, version: initial.version },
      (v) => updateWorkspaceSettingsAction({ workspaceId: initial.workspaceId, expectedVersion: v, ...patch }),
      SAVED_MESSAGE(patch, dataVaultUses),
    );
  const trim = { prepare: (t: string) => t.trim() };
  const { bind: nameBind, defaultValue: nameInitial, commit: nameCommit, keyDown: nameKeyDown, mark: nameMark, takeStored: nameTake, keepMine: nameKeep } = useDraft<HTMLInputElement>(initial.name, (v) => save({ name: v }), { ...trim, required: true, onEmpty: () => toast(NAME_REQUIRED, "refusal") });
  const { bind: clientBind, defaultValue: clientInitial, commit: clientCommit, keyDown: clientKeyDown, mark: clientMark, takeStored: clientTake, keepMine: clientKeep } = useDraft<HTMLInputElement>(initial.clientName, (v) => save({ clientName: v }), trim);
  const { bind: descriptionBind, defaultValue: descriptionInitial, commit: descriptionCommit, keyDown: descriptionKeyDown, mark: descriptionMark, takeStored: descriptionTake, keepMine: descriptionKeep } = useDraft<HTMLTextAreaElement>(initial.description, (v) => save({ description: v }), trim);
  const language = useChoice(initial.docLanguage, (docLanguage) => save({ docLanguage }));
  const dv2 = useChoice(initial.dv2Mode, (dv2Mode) => save({ dv2Mode }));
  const fourEyes = useChoice(initial.fourEyes, (on) => save({ fourEyes: on }));

  const dis = !editable;
  return (
    <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5" data-testid="form-workspace-settings">
      <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]">
        <h4 className="m-0 mb-1 text-[13.5px] font-semibold">General</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">Shown on the workspace and in generated documents.</p>
        <Field label="Name">
          <input
            ref={nameBind}
            type="text"
            data-testid="input-workspace-name"
            className={fieldClass}
            defaultValue={nameInitial}
            disabled={dis && nameMark?.kind !== "copy"}
            readOnly={dis}
            onBlur={nameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              nameKeyDown(e);
            }}
          />
          <DraftLine mark={nameMark} onUse={nameTake} onKeep={nameKeep} />
        </Field>
        <Field label="Client">
          <input
            ref={clientBind}
            type="text"
            data-testid="input-workspace-client"
            className={fieldClass}
            defaultValue={clientInitial}
            disabled={dis && clientMark?.kind !== "copy"}
            readOnly={dis}
            onBlur={clientCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              clientKeyDown(e);
            }}
          />
          <DraftLine mark={clientMark} onUse={clientTake} onKeep={clientKeep} />
        </Field>
        <Field label="Description">
          <textarea
            ref={descriptionBind}
            rows={3}
            data-testid="input-workspace-description"
            className={fieldClass + " min-h-[60px] resize-y"}
            defaultValue={descriptionInitial}
            disabled={dis && descriptionMark?.kind !== "copy"}
            readOnly={dis}
            onBlur={descriptionCommit}
            onKeyDown={descriptionKeyDown}
          />
          <DraftLine mark={descriptionMark} onUse={descriptionTake} onKeep={descriptionKeep} />
        </Field>
        <Field label="Documentation language">
          <select
            data-testid="select-workspace-language"
            className={fieldClass}
            value={language.value}
            disabled={dis}
            onChange={(e) => language.choose(e.currentTarget.value as DocLanguage)}
          >
            {LANGUAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]">
        <h4 className="m-0 mb-1 text-[13.5px] font-semibold">Methodology</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2" data-testid="text-methodology">
          {DATA_VAULT_MODE_TEXT}
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" data-testid="checkbox-dv2" checked={dv2.value} disabled={dis} onChange={(e) => dv2.choose(e.currentTarget.checked)} /> Data Vault 2.0 mode
        </label>
        {modules}
        <h4 className="m-0 mb-1 mt-4 text-[13.5px] font-semibold">Process</h4>
        <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">
          Four-eyes: the author of a change to a mapping or requirement cannot approve it. Every approval is logged
          either way (AD-06).
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" data-testid="checkbox-four-eyes" checked={fourEyes.value} disabled={dis} onChange={(e) => fourEyes.choose(e.currentTarget.checked)} />{" "}
          Four-eyes approval
        </label>
      </div>

      <div className="rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]" data-testid="box-model-conventions">
        <h4 className="m-0 mb-1 text-[13.5px] font-semibold">Model conventions</h4>
        <p className="m-0 text-[12.5px] text-im-ink-2">
          {MODEL_CONVENTIONS_TEXT}{" "}
          <Link
            href={workspaceHref(initial.workspaceId, CONVENTIONS_TAB)}
            replace
            className="inline-flex h-[26px] items-center rounded-md border border-im-line bg-im-surface px-[9px] text-xs text-im-ink hover:bg-im-hover"
            data-testid="button-open-conventions"
          >
            Metadata conventions
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * "Concept colours" (slice 21, D-76; prototype `data-ccol`): one line per concept with the palette's swatches, violet
 * never offered (D-41). A click is one undo step on the workspace's history, saved on the concept's chain with the
 * newest version known (D-59); a choice keeps no draft (D-66). Those who may edit the model change them, as a
 * concept's rename; everyone else, and an archived workspace, sees them disabled. Since slice 23 a box of the Metadata
 * conventions tab (item 12), with the prototype's longer sentence.
 */
export function ConceptColours({ workspaceId, concepts, editable }: { workspaceId: string; concepts: readonly ConceptColorRow[]; editable: boolean }) {
  return (
    <section className="mt-3.5 rounded-[10px] bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]" data-testid="box-concept-colours">
      <h3 className="m-0 mb-1 text-[15px] font-semibold">Concept colours</h3>
      <p className="m-0 mb-2.5 max-w-[90ch] text-[12.5px] text-im-ink-3">{CONCEPT_COLOURS_TEXT}</p>
      {concepts.length ? (
        concepts.map((c) => <ConceptColourLine key={c.id} workspaceId={workspaceId} concept={c} editable={editable} />)
      ) : (
        <p className="m-0 text-[12.5px] text-im-ink-3">No concepts yet.</p>
      )}
    </section>
  );
}

export const CONCEPT_COLOURS_TEXT =
  "Each concept's colour on canvases and in documents. Violet is reserved for requirements, so it is not offered here; a new concept takes the first colour no concept uses.";

function ConceptColourLine({ workspaceId, concept, editable }: { workspaceId: string; concept: ConceptColorRow; editable: boolean }) {
  const { saveRow } = useAction();
  const stored = concept.color.toUpperCase();
  const colour = useChoice(stored, (color: string) =>
    saveRow(
      { id: concept.id, version: concept.version },
      (v) => setConceptColorAction(workspaceId, { conceptId: concept.id, expectedVersion: v, color }),
      `Changed the colour of ${concept.name}.`,
      { undoable: true },
    ),
  );
  return (
    <div className="mb-2 flex items-center gap-2.5" data-testid="concept-colour" data-concept={concept.name}>
      <span className="w-[130px] truncate" title={concept.name}>
        {concept.name}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {CONCEPT_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={colour.value === c}
            aria-label={`Colour ${c}`}
            data-colour={c}
            disabled={!editable}
            onClick={() => colour.choose(c)}
            className="size-[22px] rounded-[5px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)] disabled:cursor-default disabled:opacity-60 aria-pressed:shadow-[0_0_0_2px_var(--im-surface),0_0_0_4px_var(--im-logical)]"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-[11.5px] text-im-ink-3">{label}</span>
      {children}
    </label>
  );
}
