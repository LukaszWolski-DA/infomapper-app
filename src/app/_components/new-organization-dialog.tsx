"use client";

// "New organization…" in the organization menu (slice 8, item 9): the organization's name, the password twice and the
// first workspace's name; then the summary with Create and Back. The new organization opens unlocked.

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { createOrganizationFromMenuAction, previewNewOrganizationAction, type NewOrganizationFormInput } from "../_actions/organization";
import type { ActionResult } from "../_lib/run-command";

const input = "h-[30px] w-full rounded-md border border-im-line bg-im-surface px-2 text-[13px]";
const button = "rounded-md border border-im-line bg-im-surface px-3 py-1.5 text-[13px] hover:bg-im-hover disabled:opacity-50";

const FIELDS: { key: keyof NewOrganizationFormInput; label: string; type?: string }[] = [
  { key: "organizationName", label: "Organization name" },
  { key: "password", label: "Password", type: "password" },
  { key: "passwordAgain", label: "Password again", type: "password" },
  { key: "workspaceName", label: "First workspace name" },
];

export function NewOrganizationDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<NewOrganizationFormInput>({ organizationName: "", password: "", passwordAgain: "", workspaceName: "First workspace" });
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const run = <T,>(action: () => Promise<ActionResult<T>>) =>
    new Promise<ActionResult<T>>((resolve) =>
      startTransition(async () => {
        try {
          resolve(await action());
        } catch {
          resolve({ ok: false, code: "unexpected", message: "Something went wrong. Nothing was saved." });
        }
      }),
    );

  const refused = (r: { message: string; fields?: Record<string, string> }) => {
    setErrors(r.fields ?? {});
    setMessage(r.fields && Object.keys(r.fields).some((k) => k in form) ? null : r.message);
  };

  const review = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    const r = await run(() => previewNewOrganizationAction(form));
    if (!r.ok) return refused(r);
    setSummary(r.value.summary);
  };

  const create = async () => {
    const r = await run(() => createOrganizationFromMenuAction(form));
    if (!r.ok) {
      setSummary(null);
      return refused(r);
    }
    toast(r.value.toast);
    onClose();
    router.push(r.value.href);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-new-organization">
        <DialogTitle className="text-base font-semibold">New organization</DialogTitle>
        <DialogDescription className="mb-3 text-im-ink-2">You become its owner; people sign in to it with its link and password.</DialogDescription>
        {summary === null ? (
          <form onSubmit={review} className="space-y-3" noValidate>
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-im-ink-2">{f.label}</span>
                <input
                  data-testid={`input-new-organization-${f.key}`}
                  type={f.type ?? "text"}
                  autoComplete={f.type === "password" ? "new-password" : "off"}
                  className={input}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
                {errors[f.key] && (
                  <span role="alert" data-testid="message-field" className="mt-1 block text-im-warn">
                    {errors[f.key]}
                  </span>
                )}
              </label>
            ))}
            {message && (
              <p role="alert" data-testid="message-start" className="text-im-warn">
                {message}
              </p>
            )}
            <DialogFooter className="mt-5">
              <button type="button" className={button} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" data-testid="button-new-organization-continue" className={button} disabled={pending}>
                Continue
              </button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <p data-testid="text-create-summary" className="leading-relaxed">
              {summary}
            </p>
            <DialogFooter className="mt-5">
              <button type="button" data-testid="button-create-back" className={button} onClick={() => setSummary(null)} disabled={pending}>
                Back
              </button>
              <button type="button" data-testid="button-create" className={button} onClick={() => void create()} disabled={pending}>
                Create
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
