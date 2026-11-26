"use client";

// The People tab's controls (slice 8, items 11–13): the role select and Remove per member, and the "Organization access" box. The page decides who sees what (F12, F17); the server checks every write
// again and refuses with the domain's message, shown as a toast (AD-23).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { changeOrganizationPasswordAction, previewOrganizationPasswordAction } from "@/app/_actions/organization";
import { changeRoleAction, previewRemovePersonAction, removePersonAction } from "@/app/_actions/people";
import { useAction } from "@/app/_components/use-action";
import { ROLE_LABEL } from "@/app/_lib/roles";
import type { RemovePersonPreview } from "@/domain/commands/people";
import type { WorkspaceRole } from "@/domain/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { btnClass } from "./lifecycle";
import { cn } from "@/ui/lib/utils";
import { inputVariants } from "@/ui/components/input";
import { Select } from "@/ui/components/select";

// slice 37 (step 5): the 28 px field, its padding and text kept (S33-05)
const inputClass = cn(inputVariants({ size: "sm" }), "w-auto px-2 text-[13px]");
const boxClass = "mt-4 rounded-lg bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]";
const dangerClass = btnClass + " text-im-warn";

const ADDABLE: WorkspaceRole[] = ["admin", "modeler", "reviewer", "reader"];

function FieldMessage({ text }: { text?: string }) {
  return text ? (
    <span role="alert" data-testid="message-field" className="mt-1 block text-[12px] text-im-warn">
      {text}
    </span>
  ) : null;
}

/** The role select per member (item 11). Owner is offered to owners only (F12); a refusal leaves the shown role. */
export function RoleSelect({ workspaceId, userId, name, role, ownerOffered }: { workspaceId: string; userId: string; name: string; role: WorkspaceRole; ownerOffered: boolean }) {
  const { run, pending } = useAction();
  const roles: WorkspaceRole[] = ownerOffered ? ["owner", ...ADDABLE] : ADDABLE;
  return (
    <Select
      size="sm"
      data-testid="select-person-role"
      aria-label={`Role of ${name}`}
      className={inputClass}
      value={role}
      disabled={pending}
      onChange={(e) => void run(() => changeRoleAction({ workspaceId, userId, role: e.target.value }), (v) => v.toast)}
    >
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </Select>
  );
}

/** Remove per member (item 12): the confirmation's lines from the server, then Remove or Cancel. */
export function RemovePersonButton({ workspaceId, userId, name }: { workspaceId: string; userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="button-remove-person" className={btnClass} onClick={() => setOpen(true)}>
        Remove
      </button>
      {open && <RemovePersonDialog workspaceId={workspaceId} userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function RemovePersonDialog({ workspaceId, userId, name, onClose }: { workspaceId: string; userId: string; name: string; onClose: () => void }) {
  const toast = useToast();
  const { run, pending } = useAction();
  const [preview, setPreview] = useState<RemovePersonPreview | null>(null);
  // read once per person; the parent may re-render with a new onClose meanwhile
  const refusal = useRef({ toast, onClose });
  useEffect(() => {
    refusal.current = { toast, onClose };
  });

  useEffect(() => {
    let live = true;
    void previewRemovePersonAction({ workspaceId, userId }).then((r) => {
      if (!live) return;
      if (r.ok) setPreview(r.value);
      else {
        refusal.current.toast(r.message, "refusal");
        refusal.current.onClose();
      }
    });
    return () => {
      live = false;
    };
  }, [workspaceId, userId]);

  const remove = async () => {
    const r = await run(() => removePersonAction({ workspaceId, userId }), (v) => v.toast);
    if (r.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-remove-person">
        <DialogTitle className="text-base font-semibold">Remove {name}?</DialogTitle>
        <DialogDescription asChild>
          <div data-testid="text-remove-confirmation" className="mt-2 text-[13px] text-im-ink-2">
            {preview ? (
              preview.confirmation.map((line) => (
                <p key={line} className="m-0">
                  {line}
                </p>
              ))
            ) : (
              <p className="m-0 text-im-ink-3">…</p>
            )}
          </div>
        </DialogDescription>
        <DialogFooter className="mt-5">
          <button type="button" data-testid="button-cancel-remove-person" className={btnClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" data-testid="button-confirm-remove-person" className={dangerClass} disabled={!preview || pending} onClick={() => void remove()}>
            Remove
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Organization access" (item 13), for the organization's owners and admins, not in an archived workspace (F17): the
 * link with Copy, and changing the password (twice, then the summary). `version` is the password row's, never its hash.
 */
export function OrganizationAccessBox({ workspaceId, link, version }: { workspaceId: string; link: string; version: number | null }) {
  const toast = useToast();
  const { run, pending } = useAction();
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const copy = () => void navigator.clipboard?.writeText(link).then(() => toast("Link copied."));

  const review = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    const r = await run(() => previewOrganizationPasswordAction({ password, passwordAgain }), undefined, { read: true });
    if (r.ok) setConfirming(true);
    else if (r.fields) setErrors(r.fields);
  };

  const change = async () => {
    const r = await run(() => changeOrganizationPasswordAction({ workspaceId, password, passwordAgain, expectedVersion: version }), (v) => v.toast);
    setConfirming(false);
    if (r.ok) {
      setPassword("");
      setPasswordAgain("");
    } else if (r.fields) setErrors(r.fields);
  };

  return (
    <div className={boxClass} data-testid="box-organization-access">
      <h4 className="m-0 mb-2 text-[13.5px] font-semibold">Organization access</h4>
      <div className="flex flex-wrap items-center gap-2">
        <code data-testid="text-organization-link" className="min-w-0 flex-1 truncate rounded-md bg-im-canvas px-2 py-1 text-[12px]">
          {link}
        </code>
        <button type="button" data-testid="button-copy-link" className={btnClass} onClick={copy}>
          Copy
        </button>
      </div>
      <h4 className="m-0 mb-2 mt-3.5 text-[13px] font-semibold text-im-ink-2">Change the password</h4>
      {!confirming ? (
        <form onSubmit={review} noValidate className="flex flex-wrap items-start gap-2">
          <label className="block min-w-[180px] flex-1">
            <input
              data-testid="input-new-password"
              type="password"
              aria-label="New password"
              placeholder="New password"
              autoComplete="new-password"
              className={cn(inputClass, "w-full")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldMessage text={errors.password} />
          </label>
          <label className="block min-w-[180px] flex-1">
            <input
              data-testid="input-new-password-again"
              type="password"
              aria-label="New password again"
              placeholder="New password again"
              autoComplete="new-password"
              className={cn(inputClass, "w-full")}
              value={passwordAgain}
              onChange={(e) => setPasswordAgain(e.target.value)}
            />
            <FieldMessage text={errors.passwordAgain} />
          </label>
          <button type="submit" data-testid="button-password-continue" className={btnClass} disabled={pending}>
            Continue
          </button>
        </form>
      ) : (
        <>
          <p data-testid="text-password-summary" className="m-0 text-[13px]">
            People who are signed in stay signed in; the next sign-in needs the new password.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" data-testid="button-password-back" className={btnClass} disabled={pending} onClick={() => setConfirming(false)}>
              Back
            </button>
            <button type="button" data-testid="button-change-password" className={btnClass} disabled={pending} onClick={() => void change()}>
              Change the password
            </button>
          </div>
        </>
      )}
    </div>
  );
}
