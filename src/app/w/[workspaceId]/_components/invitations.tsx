"use client";

// The People tab's invitations and reset links (slice 33, AD-40; the prototype's "Invite person", `PPL.link` and
// "Pending invitations"): the box, the link dialog (the link shown once, with Copy), New link and Revoke per pending
// invitation, and "Password reset link" per person (online only, D1). The page decides who sees what; the server checks
// every write again (AD-23).

import { useState, type FormEvent } from "react";
import { createInvitationAction, createResetLinkAction, renewInvitationAction, revokeInvitationAction } from "@/app/_actions/people";
import { useAction } from "@/app/_components/use-action";
import { ROLE_LABEL } from "@/app/_lib/roles";
import type { InvitationRole } from "@/domain/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";
import { useToast } from "@/ui/components/toast";
import { btnClass } from "./lifecycle";
import { cn } from "@/ui/lib/utils";
import { inputVariants } from "@/ui/components/input";
import { buttonVariants } from "@/ui/components/button";
import { Select } from "@/ui/components/select";

// slice 37 (step 5): the 28 px field, its padding and text kept (S33-05)
const inputClass = cn(inputVariants({ size: "sm" }), "w-auto px-2 text-[13px]");
const boxClass = "mt-4 rounded-lg bg-im-surface px-4 py-3.5 shadow-[0_0_0_1px_var(--im-line)]";
const primaryClass = cn(buttonVariants({ variant: "primary", size: "sm" }), "inline-flex items-center px-[9px] text-xs");

const ROLES: InvitationRole[] = ["admin", "modeler", "reviewer", "reader"];

/** What the link dialog shows (the prototype's `PPL.link`). */
export interface ShownLink {
  title: string;
  /** The sentence above the link, its names in bold. */
  text: React.ReactNode;
  link: string;
  /** "It works once, for 7 days." or "… 24 hours." */
  valid: string;
}

/** The link, shown only now: Copy, the hint, Done (P-g). */
export function LinkDialog({ shown, onClose }: { shown: ShownLink | null; onClose: () => void }) {
  const toast = useToast();
  if (!shown) return null;
  const copy = () => {
    void navigator.clipboard
      ?.writeText(shown.link)
      .catch(() => undefined)
      .finally(() => toast("Link copied."));
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-link">
        <DialogTitle className="text-base font-semibold">{shown.title}</DialogTitle>
        <DialogDescription asChild>
          <p data-testid="text-link-for" className="mt-3 text-[13px] text-im-ink">
            {shown.text}
          </p>
        </DialogDescription>
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-im-line bg-im-panel px-2.5 py-2">
          <code data-testid="text-link" className="min-w-0 flex-1 truncate font-mono text-[12px]">
            {shown.link}
          </code>
          <button type="button" data-testid="button-copy-link" className={primaryClass} onClick={copy}>
            Copy
          </button>
        </div>
        <p data-testid="text-link-valid" className="mt-2 text-[12px] text-im-ink-3">
          {shown.valid} Shown only now: if it gets lost, make a new link.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" data-testid="button-link-done" className={btnClass} onClick={onClose}>
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SEVEN_DAYS = "It works once, for 7 days.";

/**
 * "Invite person" (P1.2, P2.1, PT7): an e-mail and a role (Modeler first chosen), then the link dialog. `ready` false
 * (online without the secret key, D10): the fields and the button disabled, the reason under them.
 */
export function InvitePersonBox({ workspaceId, ready, notReadyText }: { workspaceId: string; ready: boolean; notReadyText: string }) {
  const { run, pending } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("modeler");
  const [error, setError] = useState<string | undefined>();
  const [shown, setShown] = useState<ShownLink | null>(null);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const r = await run(() => createInvitationAction({ workspaceId, email, role }));
    if (!r.ok) {
      if (r.fields?.email) setError(r.fields.email);
      return;
    }
    setEmail("");
    const v = r.value;
    setShown({
      title: "Invitation link",
      text: (
        <>
          Send it to <b>{v.email}</b>. They join <b>{v.workspace}</b> as {v.roleLabel}.
        </>
      ),
      link: v.link,
      valid: SEVEN_DAYS,
    });
  };

  return (
    <div className={boxClass} data-testid="box-invite-person" data-disabled={!ready || undefined}>
      <h4 className="m-0 mb-1.5 text-[13.5px] font-semibold">Invite person</h4>
      <p className="m-0 mb-2.5 text-[12.5px] text-im-ink-2">
        You get a link to copy and send yourself (e-mail, Teams). It works once, for 7 days. The person sets their own password.
      </p>
      <form onSubmit={invite} noValidate className="flex flex-wrap items-start gap-2">
        <label className="block min-w-[240px] flex-1">
          <input
            data-testid="input-invite-email"
            disabled={!ready}
            aria-label="E-mail"
            placeholder="name@company.com"
            autoComplete="off"
            className={cn(inputClass, "w-full")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <span role="alert" data-testid="message-field" className="mt-1 block text-[12px] text-im-warn">
              {error}
            </span>
          )}
        </label>
        <Select size="sm" data-testid="select-invite-role" disabled={!ready} aria-label="Role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value as InvitationRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <button type="submit" data-testid="button-create-invitation" className={primaryClass} disabled={pending || !ready} title={ready ? undefined : notReadyText}>
          Create invitation link
        </button>
        {!ready && (
          <p data-testid="text-invite-not-ready" className="m-0 w-full text-[12.5px] text-im-ink-3">
            {notReadyText}
          </p>
        )}
      </form>
      <LinkDialog shown={shown} onClose={() => setShown(null)} />
    </div>
  );
}

/** New link and Revoke on a pending invitation (P2.2, P-h, P-i). */
export function InvitationButtons({ workspaceId, invitationId, email, roleLabel, ready }: { workspaceId: string; invitationId: string; email: string; roleLabel: string; ready: boolean }) {
  const { run, pending } = useAction();
  const [shown, setShown] = useState<ShownLink | null>(null);
  const renew = async () => {
    const r = await run(() => renewInvitationAction({ workspaceId, invitationId }));
    if (!r.ok) return;
    setShown({
      title: "New invitation link",
      text: (
        <>
          For <b>{email}</b>, as {roleLabel}. The earlier link no longer works.
        </>
      ),
      link: r.value.link,
      valid: SEVEN_DAYS,
    });
  };
  return (
    <>
      <button type="button" data-testid="button-new-link" className={btnClass} disabled={pending || !ready} onClick={() => void renew()}>
        New link
      </button>
      <button
        type="button"
        data-testid="button-revoke-invitation"
        className={btnClass + " ml-1.5"}
        disabled={pending}
        onClick={() => void run(() => revokeInvitationAction({ workspaceId, invitationId }), (v) => v.toast)}
      >
        Revoke
      </button>
      <LinkDialog shown={shown} onClose={() => setShown(null)} />
    </>
  );
}

/** "Password reset link" by a person (P2.3, D1; online only), then the link dialog with 24 hours. */
export function ResetLinkButton({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const { run, pending } = useAction();
  const [shown, setShown] = useState<ShownLink | null>(null);
  const make = async () => {
    const r = await run(() => createResetLinkAction({ workspaceId, userId }));
    if (!r.ok) return;
    setShown({
      title: "Password reset link",
      text: (
        <>
          For <b>{r.value.name}</b>. They set a new password with it and are signed in.
        </>
      ),
      link: r.value.link,
      valid: "It works once, for 24 hours.",
    });
  };
  return (
    <>
      <button type="button" data-testid="button-reset-link" className={btnClass + " mr-1.5"} disabled={pending} onClick={() => void make()}>
        Password reset link
      </button>
      <LinkDialog shown={shown} onClose={() => setShown(null)} />
    </>
  );
}
