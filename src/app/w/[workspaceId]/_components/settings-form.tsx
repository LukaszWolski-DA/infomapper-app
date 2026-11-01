"use client";

// Workspace settings as in the prototype: each field saves when it changes (no Save button).
// Every save goes through the workspace's save chain (slice 9) with the newest version known; a stale version is refused
// with the domain's message (AD-12), and the refusal brings the fresh page. Slice 13 (D-66): a text field keeps its
// draft across fresh pages and after a refusal (an empty name goes back with "Enter a name.", D-59); the language and
// the two modes show the newest stored value after a refusal. Settings are not undo steps.
// Slice 7c (item 17, answers F16, F17): the methodology text names the source table panels; switching Data Vault 2.0
// mode off says how many uses of Data Vault classifications stay stored.

import { DATA_VAULT_MODE_TEXT, dataVaultOffMessage } from "@/domain/model/classifications";
import type { DocLanguage } from "@/domain/types";
import { updateWorkspaceSettingsAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { useChoice, useDraft } from "@/app/_panels/fields";
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

const LANGUAGES: [DocLanguage, string][] = [
  ["en", "English"],
  ["pl", "Polski"],
  ["de", "Deutsch"],
];

type Patch = Partial<Omit<SettingsValues, "workspaceId" | "version">>;

const SAVED_MESSAGE = (patch: Patch, dataVaultUses: number): string => {
  if (patch.dv2Mode !== undefined) return patch.dv2Mode ? "Data Vault 2.0 mode is on." : dataVaultOffMessage(dataVaultUses);
  if (patch.fourEyes !== undefined) return patch.fourEyes ? "Four-eyes approval is on." : "Four-eyes approval is off.";
  return "Settings saved.";
};

const fieldClass =
  "min-h-8 w-full rounded-md border border-im-line bg-im-surface px-2 py-1.5 disabled:opacity-60 disabled:cursor-default";

/** `dataVaultUses`: the workspace's uses of Data Vault classifications (answer F16), for the mode-off message. */
export function SettingsForm({ initial, editable, dataVaultUses = 0 }: { initial: SettingsValues; editable: boolean; dataVaultUses?: number }) {
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
  const { bind: nameBind, defaultValue: nameInitial, commit: nameCommit } = useDraft<HTMLInputElement>(initial.name, (v) => save({ name: v }), { ...trim, required: true, onEmpty: () => toast(NAME_REQUIRED, "refusal") });
  const { bind: clientBind, defaultValue: clientInitial, commit: clientCommit } = useDraft<HTMLInputElement>(initial.clientName, (v) => save({ clientName: v }), trim);
  const { bind: descriptionBind, defaultValue: descriptionInitial, commit: descriptionCommit } = useDraft<HTMLTextAreaElement>(initial.description, (v) => save({ description: v }), trim);
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
            disabled={dis}
            onBlur={nameCommit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </Field>
        <Field label="Client">
          <input
            ref={clientBind}
            type="text"
            data-testid="input-workspace-client"
            className={fieldClass}
            defaultValue={clientInitial}
            disabled={dis}
            onBlur={clientCommit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </Field>
        <Field label="Description">
          <textarea
            ref={descriptionBind}
            rows={3}
            data-testid="input-workspace-description"
            className={fieldClass + " min-h-[60px] resize-y"}
            defaultValue={descriptionInitial}
            disabled={dis}
            onBlur={descriptionCommit}
          />
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
