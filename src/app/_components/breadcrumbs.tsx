// Breadcrumbs under the top bar (D-38, prototype navigation bar): Organization › Workspace › … , each part a link.
// Navigation history (back/forward) and the view-state bar are out of scope in slice 0 (D-38, D-39).

import Link from "next/link";
import { Fragment } from "react";
import type { ShellData } from "../_lib/shell";
import { canvasHref, projectHref, workspaceHref } from "../_lib/paths";

export function Breadcrumbs({ shell }: { shell: ShellData }) {
  const { workspace, project, canvas, page } = shell;
  const firstInOrg = shell.organizations.find((o) => o.id === shell.organization.id)?.firstWorkspaceId ?? workspace.id;

  const parts: { label: string; href: string }[] = [
    { label: shell.organization.name, href: workspaceHref(firstInOrg) },
    { label: workspace.name, href: workspaceHref(workspace.id) },
  ];
  if (page === "workspace") parts.push({ label: "Workspace home", href: workspaceHref(workspace.id) });
  if (page !== "workspace" && project) {
    parts.push({ label: project.name, href: projectHref(workspace.id, project.id) });
    if (page === "project") parts.push({ label: "Home", href: projectHref(workspace.id, project.id) });
    if (page === "canvas" && canvas) parts.push({ label: canvas.name, href: canvasHref(workspace.id, project.id, canvas.id) });
  }

  return (
    <nav
      aria-label="Breadcrumbs"
      data-testid="nav-breadcrumbs"
      className="flex h-8 min-w-0 flex-none items-center gap-1.5 overflow-hidden border-b border-im-line bg-im-canvas px-2 text-xs"
    >
      <ol className="flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap text-im-ink-3">
        {parts.map((part, i) => {
          const current = i === parts.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="flex-none">
                  ›
                </li>
              )}
              <li className={current ? "flex-none" : "min-w-10 flex-[0_1_auto] overflow-hidden"}>
                <Link
                  href={part.href}
                  title={part.label}
                  data-testid="breadcrumb"
                  aria-current={current ? "page" : undefined}
                  className={
                    "block max-w-[220px] truncate rounded px-[5px] py-0.5 hover:bg-im-surface hover:text-im-ink " +
                    (current ? "font-medium text-im-ink" : "text-im-ink-2")
                  }
                >
                  {part.label}
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
