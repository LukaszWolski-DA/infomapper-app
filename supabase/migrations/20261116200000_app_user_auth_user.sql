-- Slice 29: a person's Supabase Auth account (docs/prd/slice-29-database-skeleton.md; acceptance doc, F7, L3).
-- `app_user.id` stays the application's own (AD-11); the Auth user signed in as the person is `auth_user_id`, set by the
-- accounts script (scripts/pg-accounts.ts) and, from slice B, by invitations. No foreign key into Supabase's `auth`
-- schema (data-model-v2.md §3), so the table works with any identity provider. Null without an account.

alter table app_user add column auth_user_id uuid;
create unique index app_user_auth_user_uq on app_user (auth_user_id);
