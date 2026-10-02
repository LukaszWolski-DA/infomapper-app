import type { ReactNode } from "react";
import type { ShellData } from "../_lib/shell";
import { Breadcrumbs } from "./breadcrumbs";
import { TopBar } from "./top-bar";

export function AppShell({ shell, children }: { shell: ShellData; children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-im-panel text-im-ink">
      <TopBar shell={shell} />
      <Breadcrumbs shell={shell} />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
