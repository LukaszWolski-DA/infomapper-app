"use client";

// The start page's two paths (slice 8, D-58, items 1–3, 6–8): signing in step by step (e-mail, the organizations it
// has a workspace in, the password), an organization's link (e-mail and password in one step), and creating an
// organization (the form, its summary, Create or Back). Every check and refusal is the server's.

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useToast } from "@/ui/components/toast";
import { organizationsForEmailAction, signInWithPasswordAction, type SignInOrganization } from "../_actions/session";
import { createOrganizationAction, previewCreateOrganizationAction, type CreateOrganizationFormInput } from "../_actions/organization";
import type { ActionResult } from "../_lib/run-command";

const input = "h-[30px] w-full rounded-md border border-im-line bg-im-surface px-2 text-[13px]";
const button = "rounded-md border border-im-line bg-im-surface px-3 py-1.5 text-[13px] hover:bg-im-hover disabled:opacity-50";
const primary = "rounded-md bg-im-logical px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50";

/** "1 workspace" / "{n} workspaces", or "guest" for an organization the person is a guest in (F21). */
export const workspacesHint = (o: SignInOrganization) => (o.guest ? "guest" : `${o.workspaceCount} workspace${o.workspaceCount === 1 ? "" : "s"}`);

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-[13px]">
      <span className="mb-1 block text-im-ink-2">{label}</span>
      {children}
      {error && (
        <span role="alert" data-testid="message-field" className="mt-1 block text-im-warn">
          {error}
        </span>
      )}
    </label>
  );
}

function Message({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" data-testid="message-start" className="text-[13px] text-im-warn">
      {text}
    </p>
  ) : null;
}

/** Runs an action and keeps its refusal for the form; anything thrown is shown as the app's generic refusal. */
function useStartAction() {
  const [pending, startTransition] = useTransition();
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
  return { run, pending };
}

/** "Sign in": e-mail, then the person's organizations (skipped when there is one), then that organization's password. */
export function SignInSteps({ next }: { next: string | null }) {
  const router = useRouter();
  const { run, pending } = useStartAction();
  const [email, setEmail] = useState("");
  const [organizations, setOrganizations] = useState<SignInOrganization[] | null>(null);
  const [chosen, setChosen] = useState<SignInOrganization | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const findOrganizations = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const r = await run(() => organizationsForEmailAction(email));
    if (!r.ok) return setMessage(r.message);
    setOrganizations(r.value);
    setChosen(r.value.length === 1 ? r.value[0]! : null);
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setMessage(null);
    const r = await run(() => signInWithPasswordAction({ email, organizationId: chosen.id, password, next }));
    if (!r.ok) return setMessage(r.message);
    router.push(r.value.href);
  };

  const back = () => {
    setMessage(null);
    setPassword("");
    if (chosen && organizations && organizations.length > 1) setChosen(null);
    else {
      setChosen(null);
      setOrganizations(null);
    }
  };

  return (
    <section data-testid="panel-sign-in" className="flex-1 rounded-md border border-im-line bg-im-surface p-4">
      <h2 className="mb-3 text-[15px] font-semibold">Sign in</h2>
      {!organizations && (
        <form onSubmit={findOrganizations} className="space-y-3" noValidate>
          <Field label="E-mail">
            <input data-testid="input-sign-in-email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Message text={message} />
          <button type="submit" data-testid="button-sign-in-continue" className={primary} disabled={pending}>
            Continue
          </button>
        </form>
      )}
      {organizations && !chosen && (
        <div className="space-y-2">
          <p className="text-[13px] text-im-ink-2">{email}</p>
          <ul data-testid="list-sign-in-organizations" className="divide-y divide-im-line rounded-md border border-im-line">
            {organizations.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  data-testid="button-sign-in-organization"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-im-hover"
                  onClick={() => setChosen(o)}
                >
                  <span className="font-medium">{o.name}</span>
                  <kbd className="text-[11px] font-normal text-im-ink-3">{workspacesHint(o)}</kbd>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={button} onClick={back}>
            Back
          </button>
        </div>
      )}
      {chosen && (
        <form onSubmit={signIn} className="space-y-3" noValidate>
          <p className="text-[13px] text-im-ink-2">
            {email} · <b data-testid="text-sign-in-organization" className="font-semibold text-im-ink">{chosen.name}</b>
          </p>
          <Field label={`Password of ${chosen.name}`}>
            <input data-testid="input-sign-in-password" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Message text={message} />
          <div className="flex gap-2">
            <button type="button" className={button} onClick={back}>
              Back
            </button>
            <button type="submit" data-testid="button-sign-in" className={primary} disabled={pending}>
              Sign in
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * An organization's link (item 3), and the form a locked organization's page sends to (item 4): the organization's
 * name, the e-mail address and the password in one step.
 */
export function OrganizationLinkForm({ organization, email: initialEmail, next }: { organization: { id: string; name: string }; email: string; next: string | null }) {
  const router = useRouter();
  const { run, pending } = useStartAction();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const r = await run(() => signInWithPasswordAction({ email, organizationId: organization.id, password, next }));
    if (!r.ok) return setMessage(r.message);
    router.push(r.value.href);
  };

  return (
    <section data-testid="panel-organization-link" className="w-full rounded-md border border-im-line bg-im-surface p-4">
      <h2 className="mb-3 text-[15px] font-semibold">
        Sign in to <span data-testid="text-link-organization">{organization.name}</span>
      </h2>
      <form onSubmit={signIn} className="space-y-3" noValidate>
        <Field label="E-mail">
          <input data-testid="input-sign-in-email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={`Password of ${organization.name}`}>
          <input data-testid="input-sign-in-password" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Message text={message} />
        <button type="submit" data-testid="button-sign-in" className={primary} disabled={pending}>
          Sign in
        </button>
      </form>
    </section>
  );
}

const EMPTY_FORM: CreateOrganizationFormInput = {
  organizationName: "",
  name: "",
  email: "",
  workspaceName: "First workspace",
  password: "",
  passwordAgain: "",
};

const CREATE_FIELDS: { key: keyof CreateOrganizationFormInput; label: string; type?: string; autoComplete?: string }[] = [
  { key: "organizationName", label: "Organization name", autoComplete: "organization" },
  { key: "name", label: "Your name", autoComplete: "name" },
  { key: "email", label: "Your e-mail", type: "email", autoComplete: "email" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { key: "passwordAgain", label: "Password again", type: "password", autoComplete: "new-password" },
  { key: "workspaceName", label: "First workspace name" },
];

/** "Create an organization" (items 6–8): the form, then the summary with Create and Back; Back keeps what was typed. */
export function CreateOrganizationForm() {
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useStartAction();
  const [form, setForm] = useState(EMPTY_FORM);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const refused = (r: { message: string; fields?: Record<string, string> }) => {
    setErrors(r.fields ?? {});
    setMessage(r.fields && Object.keys(r.fields).some((k) => k in form) ? null : r.message);
  };

  const review = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    const r = await run(() => previewCreateOrganizationAction(form));
    if (!r.ok) return refused(r);
    setSummary(r.value.summary);
  };

  const create = async () => {
    const r = await run(() => createOrganizationAction(form));
    if (!r.ok) {
      setSummary(null);
      return refused(r);
    }
    toast(r.value.toast);
    router.push(r.value.href);
  };

  return (
    <section data-testid="panel-create-organization" className="flex-1 rounded-md border border-im-line bg-im-surface p-4">
      <h2 className="mb-3 text-[15px] font-semibold">Create an organization</h2>
      {summary === null ? (
        <form onSubmit={review} className="space-y-3" noValidate>
          {CREATE_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} error={errors[f.key]}>
              <input
                data-testid={`input-create-${f.key}`}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete ?? "off"}
                className={input}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </Field>
          ))}
          <Message text={message} />
          <button type="submit" data-testid="button-create-continue" className={primary} disabled={pending}>
            Continue
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p data-testid="text-create-summary" className="text-[13px] leading-relaxed">
            {summary}
          </p>
          <div className="flex gap-2">
            <button type="button" data-testid="button-create-back" className={button} onClick={() => setSummary(null)} disabled={pending}>
              Back
            </button>
            <button type="button" data-testid="button-create" className={primary} onClick={() => void create()} disabled={pending}>
              Create
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
