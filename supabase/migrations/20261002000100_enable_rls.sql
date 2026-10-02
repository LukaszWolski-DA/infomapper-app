-- InfoMapper · Row Level Security on, no policies (deny by default)
-- Supabase exposes the public schema through its API. With RLS on and no policies, the anon and authenticated
-- keys can neither read nor write any table. The application server uses the service role, which bypasses RLS,
-- and enforces permissions in the domain layer (AD-05, AD-23). Read policies for live updates come later (A-07).

alter table app_user enable row level security;
alter table organization enable row level security;
alter table organization_member enable row level security;
alter table workspace enable row level security;
alter table workspace_member enable row level security;
alter table invitation enable row level security;
alter table concept enable row level security;
alter table entity enable row level security;
alter table attribute enable row level security;
alter table relationship enable row level security;
alter table source_system enable row level security;
alter table source_table enable row level security;
alter table source_column enable row level security;
alter table mapping enable row level security;
alter table mapping_input enable row level security;
alter table requirement enable row level security;
alter table requirement_link enable row level security;
alter table label enable row level security;
alter table label_link enable row level security;
alter table project enable row level security;
alter table canvas enable row level security;
alter table project_canvas enable row level security;
alter table project_pinned_label enable row level security;
alter table frame enable row level security;
alter table canvas_item enable row level security;
alter table note enable row level security;
alter table change_event enable row level security;
alter table baseline enable row level security;
