import Link from "next/link";
import { ErrorMessage, quietLink } from "./_components/error-message";

// An unknown route, or a workspace, project or canvas that does not exist or is not the person's (slice 4p, item 8).

export default function NotFound() {
  return (
    <ErrorMessage testId="page-not-found" heading="This page does not exist." text="The link may be out of date, or what it pointed to was deleted.">
      <Link href="/" className={quietLink} data-testid="link-start-page">
        Go to the start page
      </Link>
    </ErrorMessage>
  );
}
