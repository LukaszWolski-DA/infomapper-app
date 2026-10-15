"use client";

// An error while showing a page (slice 4p, item 8): a message in its place, “Try again” re-fetches and re-renders the
// page (Next.js `retry`). The error itself is not shown or logged here.

import Link from "next/link";
import { ErrorMessage, primaryButton, quietLink } from "./_components/error-message";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorMessage testId="page-error" heading="Something went wrong." text="This page could not be shown.">
      <button type="button" className={primaryButton} onClick={() => retry()} data-testid="button-try-again">
        Try again
      </button>
      <Link href="/" className={quietLink}>
        Go to the start page
      </Link>
    </ErrorMessage>
  );
}
