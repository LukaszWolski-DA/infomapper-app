import type { Metadata } from "next";
import { connection } from "next/server";
import { GoneText, LinkCard, ResetForm } from "@/app/_components/link-page";
import { hashOfToken } from "@/app/_lib/link-tokens";
import { resetStateFor } from "@/app/_lib/people-links";
import { getDataStore, isPostgresMode } from "@/data";
import { STORE_SCHEMA } from "@/compose/tables";
import { RESET_GONE, RESET_GONE_ASK, resetPage } from "@/domain/commands/invitations";

export const metadata: Metadata = { title: "Set a new password · InfoMapper" };

/**
 * A password reset link (slice 33, PT5): public, outside the app shell (the proxy lets `/reset/…` through). Online only:
 * locally no reset link is ever made, so the page shows the refused message.
 */
export default async function ResetPage({ params }: PageProps<"/reset/[token]">) {
  await connection();
  const { token } = await params;
  const tokenHash = hashOfToken(token);
  const page = tokenHash && isPostgresMode() ? resetPage(await resetStateFor(getDataStore(STORE_SCHEMA), tokenHash), tokenHash, new Date().toISOString()) : { kind: "gone" as const };
  return (
    <main data-testid="page-reset" className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-semibold">InfoMapper</h1>
      <LinkCard title="Set a new password">
        {page.kind === "gone" ? <GoneText message={RESET_GONE} ask={RESET_GONE_ASK} /> : <ResetForm token={token} email={page.email} ask={RESET_GONE_ASK} />}
      </LinkCard>
    </main>
  );
}
