-- Slice 15b: a role name for each end of a relationship (docs/prd/slice-15-infocube.md, RQ-3; role-playing spec RP-A;
-- D-68). What the entity at that end is in this relationship ("Ship date", "billing"): any relationship, any level,
-- trimmed by the domain, null when not named. InfoMapper's own columns; InfoCube reads the role at a dimension's end.
-- DDL only: no database holds data yet (AD-31); the local data file's format 13 adds them as null.

alter table relationship add column from_role text;
alter table relationship add column to_role text;
