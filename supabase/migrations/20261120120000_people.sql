-- Slice 33: invitations by link and password reset links (docs/prd/slice-33-people.md; acceptance doc, F4, F5, F7).
-- `invitation` exists since the initial schema (its token's hash unique); it gets the rule "one pending invitation per
-- workspace and e-mail" (an expired one still counts: it is renewed, D6). `password_reset` is new: a one-time link to
-- set a new password, made on a workspace's People tab (its change events go into that workspace's log). Both store
-- only the SHA-256 of a link's token. People tables: outside undo, no version, no soft delete (a link is accepted, used
-- or revoked). Row Level Security on, no policy (AD-05's note).

create unique index invitation_pending_uq on invitation (workspace_id, email) where accepted_at is null and revoked_at is null;

create table password_reset (
  id            uuid primary key,
  workspace_id  uuid not null references workspace (id),
  app_user_id   uuid not null references app_user (id),
  token_hash    text not null,
  created_by    uuid not null references app_user (id),
  created_at    timestamptz not null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  revoked_at    timestamptz
);
create unique index password_reset_token_uq on password_reset (token_hash);
create index password_reset_user_ix on password_reset (app_user_id);
create index password_reset_workspace_ix on password_reset (workspace_id);

alter table password_reset enable row level security;
