import type { ReactNode } from "react";

// The message shown in place of something that failed (slice 4p, item 8): the error pages and the canvas's boundary.
// The error itself is never shown or logged here (no personal data or rich text in messages or logs).

export function ErrorMessage({ testId, heading, text, children }: { testId: string; heading: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6" data-testid={testId}>
      <div className="max-w-[440px] rounded-lg bg-im-surface p-6 shadow-[0_0_0_1px_var(--im-line),0_8px_24px_-12px_var(--im-shadow)]">
        <h1 className="m-0 text-lg font-semibold text-im-ink">{heading}</h1>
        <p className="mt-2 text-im-ink-2">{text}</p>
        {children && <div className="mt-4 flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export const primaryButton = "h-8 rounded-md bg-im-logical px-3 text-[12.5px] font-medium text-white hover:opacity-90";
export const quietLink = "text-[12.5px] text-im-logical underline-offset-2 hover:underline";
