"use client";

// The invitation and reset pages' forms (slice 33, PT3, PT5; the prototype's `PPL.join` and `PPL.reset`): outside the
// app shell, in the sign-in page's card. One error line above the buttons (D9); the hint under a new password.

import { afterSessionChange } from "@/ui/after-session-change";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { joinAction, setPasswordAction } from "@/app/_actions/links";
import type { ActionResult } from "@/app/_lib/run-command";
import { PASSWORD_HINT } from "@/app/_lib/password-texts";
import type { InvitationPage } from "@/domain/commands/invitations";
import { cn } from "@/ui/lib/utils";
import { inputVariants } from "@/ui/components/input";
import { buttonVariants } from "@/ui/components/button";

// slice 37 (step 8): the shared field and button (32 px), each keeping its padding
const input = cn(inputVariants(), "px-2");
const primary = cn(buttonVariants({ variant: "primary" }), "px-3");

/** The card the two pages share. */
export function LinkCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-testid="panel-link" className="w-full max-w-md rounded-lg border border-im-line bg-im-surface p-5">
      <h2 data-testid="title-link" className="text-[15px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: (id: string) => ReactNode }) {
  return (
    <div className="mt-3 text-[13px]">
      <label htmlFor={id} className="mb-1 block text-im-ink-2">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" data-testid="message-link" className="mb-0 mt-2.5 text-[12.5px] text-im-warn">
      {text}
    </p>
  ) : null;
}

function useLinkAction() {
  const [pending, startTransition] = useTransition();
  // the full page load after a success (fix/blank-page-after-sign-in): the button stays disabled until the next page
  const [leaving, setLeaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const run = (action: () => Promise<ActionResult<{ href: string }>>, goneCode = "not_found") =>
    startTransition(async () => {
      setMessage(null);
      let r: ActionResult<{ href: string }>;
      try {
        r = await action();
      } catch {
        r = { ok: false, code: "unexpected", message: "Something went wrong. Nothing was changed." };
      }
      if (r.ok) {
        setLeaving(true);
        return afterSessionChange(r.value.href);
      }
      // a link that no longer works (or a workspace archived meanwhile) turns the page into its message
      if (r.code === goneCode || r.code === "archived") return setGone(r.message);
      setMessage(r.message);
    });
  return { run, pending: pending || leaving, message, gone };
}

/** The one refused page: the message and what to do, no button (P-l). */
export function GoneText({ message, ask }: { message: string; ask: string | null }) {
  return (
    <div data-testid="text-link-gone">
      <p className="mt-3 text-[13px]">{message}</p>
      {ask && <p className="mt-2 text-[13px]">{ask}</p>}
    </div>
  );
}

type JoinPage = Extract<InvitationPage, { email: string }>;

/**
 * Join (PT3): `new` (name, password twice online; name only locally, D3), `account` (a person without an Auth account
 * sets their password, D5), `existing` (the account's password online; nothing locally).
 */
export function JoinForm({ token, page, online, ask }: { token: string; page: JoinPage; online: boolean; ask: string }) {
  const { run, pending, message, gone } = useLinkAction();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  if (gone) return <GoneText message={gone} ask={gone.includes("archived") ? null : ask} />;

  const setsPassword = online && page.kind !== "existing";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => joinAction({ token, ...(page.kind === "new" ? { name } : {}), ...(online ? { password, passwordAgain: again } : {}) }));
  };
  const label = page.kind === "existing" && online ? "Sign in and join" : "Join";
  return (
    <form onSubmit={submit} noValidate data-testid="form-join" data-kind={page.kind}>
      <p data-testid="text-invited" className="mt-3 text-[13px]">
        {page.inviter} invited you to <b>{page.workspace}</b> in <b>{page.organization}</b> as <b>{page.roleLabel}</b>.
      </p>
      {page.kind === "existing" && online && <p className="mt-2 text-[13px]">You already have an account: sign in to add this workspace to yours.</p>}
      {page.kind === "account" && <p className="mt-2 text-[13px]">Set a password for your account to join.</p>}
      <Field id="join-email" label="E-mail">
        {(id) => <input id={id} data-testid="input-join-email" type="email" className={input} value={page.email} disabled readOnly />}
      </Field>
      {page.kind === "new" && (
        <Field id="join-name" label="Your name">
          {(id) => <input id={id} data-testid="input-join-name" type="text" autoComplete="name" className={input} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      )}
      {online && (
        <Field id="join-password" label="Password">
          {(id) => (
            <input
              id={id}
              data-testid="input-join-password"
              type="password"
              autoComplete={setsPassword ? "new-password" : "current-password"}
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      )}
      {setsPassword && (
        <Field id="join-password-again" label="Password again">
          {(id) => <input id={id} data-testid="input-join-password-again" type="password" autoComplete="new-password" className={input} value={again} onChange={(e) => setAgain(e.target.value)} />}
        </Field>
      )}
      {setsPassword && <p className="mt-1.5 text-[12px] text-im-ink-3">{PASSWORD_HINT}</p>}
      <ErrorLine text={message} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="submit" data-testid="button-join" className={primary} disabled={pending}>
          {label}
        </button>
      </div>
    </form>
  );
}

/** "Set a new password" (PT5): the new password twice; then signed in. */
export function ResetForm({ token, email, ask }: { token: string; email: string; ask: string }) {
  const { run, pending, message, gone } = useLinkAction();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  if (gone) return <GoneText message={gone} ask={ask} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => setPasswordAction({ token, password, passwordAgain: again }));
  };
  return (
    <form onSubmit={submit} noValidate data-testid="form-reset">
      <p data-testid="text-reset-for" className="mt-3 text-[13px]">
        For {email}. This link works once, for 24 hours.
      </p>
      <Field id="reset-password" label="New password">
        {(id) => <input id={id} data-testid="input-reset-password" type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Field id="reset-password-again" label="New password again">
        {(id) => <input id={id} data-testid="input-reset-password-again" type="password" autoComplete="new-password" className={input} value={again} onChange={(e) => setAgain(e.target.value)} />}
      </Field>
      <p className="mt-1.5 text-[12px] text-im-ink-3">{PASSWORD_HINT}</p>
      <ErrorLine text={message} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="submit" data-testid="button-set-password" className={primary} disabled={pending}>
          Set password
        </button>
      </div>
    </form>
  );
}

