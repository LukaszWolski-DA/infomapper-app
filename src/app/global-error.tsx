"use client";

// An error in the root layout itself (slice 4p, item 8). It replaces the whole document, so it brings its own <html>,
// <body> and styles (Next.js global-error). The error itself is not shown or logged here.

import "./globals.css";
import { ErrorMessage, primaryButton } from "./_components/error-message";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-im-panel font-sans text-[13px] text-im-ink">
        <title>InfoMapper</title>
        <ErrorMessage testId="page-global-error" heading="Something went wrong." text="InfoMapper could not start this page.">
          <button type="button" className={primaryButton} onClick={() => retry()}>
            Reload
          </button>
        </ErrorMessage>
      </body>
    </html>
  );
}
