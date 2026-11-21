// fix/blank-page-after-sign-in (docs/prd/fix-blank-page-after-sign-in.md): how a form moves on after an action that
// changed the session (the three sign-in forms, Join and "Sign in and join", Set password). A full page load, never the
// router: Next.js counts an action that sets a cookie as a revalidation and resolves it before its own refresh of the
// page, so a `router.push` right after it discarded that refresh and queued another, and online the landing (`/`, which
// redirects) was asked for twice; once the page stayed blank. A new document starts from the new session's cookies with
// nothing of the old page's router. The two forms that create an organization keep `router.push` and their toast (D1).

/** Leaves the page for `href` by a full page load. */
export function afterSessionChange(href: string): void {
  window.location.assign(href);
}
