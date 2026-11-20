import type { Metadata } from "next";
import { connection } from "next/server";
import { GoneText, JoinForm, LinkCard } from "@/app/_components/link-page";
import { hashOfToken } from "@/app/_lib/link-tokens";
import { acceptStateFor } from "@/app/_lib/people-links";
import { getDataStore, isPostgresMode } from "@/data";
import { STORE_SCHEMA } from "@/compose/tables";
import { INVITATION_GONE, INVITATION_GONE_ASK, invitationPage } from "@/domain/commands/invitations";

export const metadata: Metadata = { title: "Invitation · InfoMapper" };

/**
 * An invitation link (slice 33, PT3): public, outside the app shell (the proxy lets `/invite/…` through without a
 * session). The page a link shows comes from the domain (`invitationPage`): Join, the archived workspace's message, or
 * the one message for an unknown, altered, expired, used or revoked link.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  await connection();
  const { token } = await params;
  const tokenHash = hashOfToken(token);
  const online = isPostgresMode();
  const page = tokenHash ? invitationPage(await acceptStateFor(getDataStore(STORE_SCHEMA), tokenHash), tokenHash, new Date().toISOString(), online) : { kind: "gone" as const };
  return (
    <main data-testid="page-invite" className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-semibold">InfoMapper</h1>
      {page.kind === "gone" ? (
        <LinkCard title="Invitation">
          <GoneText message={INVITATION_GONE} ask={INVITATION_GONE_ASK} />
        </LinkCard>
      ) : page.kind === "archived" ? (
        <LinkCard title="Invitation">
          <GoneText message={`${page.workspace} is archived, so nobody can join it now. Nothing was changed.`} ask={null} />
        </LinkCard>
      ) : (
        <LinkCard title={`Join ${page.organization}`}>
          <JoinForm token={token} page={page} online={online} ask={INVITATION_GONE_ASK} />
        </LinkCard>
      )}
    </main>
  );
}
