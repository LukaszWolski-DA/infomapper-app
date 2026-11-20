"use client";

// "Change password…" (slice 33, PT4, Q7, D4; the prototype's `PPL.pw`): online only, in the person's menu. The current
// password, the new one twice; a wrong current password changes nothing. One error line above the buttons (D9).

import { useState, type FormEvent } from "react";
import { changePasswordAction } from "@/app/_actions/people";
import { useAction } from "@/app/_components/use-action";
import { PASSWORD_HINT } from "@/app/_lib/password-texts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/dialog";

const input = "h-[30px] w-full rounded-md border border-im-line bg-im-surface px-2 text-[13px]";
const button = "rounded-md border border-im-line bg-im-surface px-3 py-1.5 text-[13px] hover:bg-im-hover disabled:opacity-50";
const primary = "rounded-md bg-im-logical px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50";

export function ChangePasswordDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const { run, pending } = useAction();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    // the refusal is the dialog's line, not a toast; the success is the prototype's toast
    const r = await run(() => changePasswordAction({ current, password, passwordAgain: again }), (v) => v.toast, { quiet: true });
    if (r.ok) onClose();
    else setMessage(r.message);
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className="mt-3 text-[13px]">
      <label htmlFor={id} className="mb-1 block text-im-ink-2">
        {label}
      </label>
      <input id={id} data-testid={`input-${id}`} type="password" autoComplete={autoComplete} className={input} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 border-im-line bg-im-surface text-[13px] text-im-ink" data-testid="dialog-change-password">
        <DialogTitle className="text-base font-semibold">Change password</DialogTitle>
        <DialogDescription asChild>
          <p className="mt-3 text-[13px] text-im-ink">For {email}.</p>
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          {field("current-password", "Current password", current, setCurrent, "current-password")}
          {field("new-password", "New password", password, setPassword, "new-password")}
          {field("new-password-again", "New password again", again, setAgain, "new-password")}
          <p className="mt-1.5 text-[12px] text-im-ink-3">{PASSWORD_HINT}</p>
          {message && (
            <p role="alert" data-testid="message-change-password" className="mb-0 mt-2.5 text-[12.5px] text-im-warn">
              {message}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" data-testid="button-cancel-change-password" className={button} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" data-testid="button-change-own-password" className={primary} disabled={pending}>
              Change password
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
