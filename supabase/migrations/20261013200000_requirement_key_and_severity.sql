-- Slice 4a (Łukasz, step 0 answer 1): a requirement's key is unique per workspace among live requirements and in any
-- case (REQ-104 and req-104 are the same key); a deleted requirement no longer holds its key. A severity is allowed
-- for every kind, so changing a data quality rule into another kind keeps it; the application decides when to show it.

drop index requirement_key_uq;
create unique index requirement_key_uq on requirement (workspace_id, lower(key)) where deleted_at is null;

alter table requirement drop constraint requirement_severity_ck;
alter table requirement add constraint requirement_severity_ck check (severity is null or severity in ('warn', 'block'));
