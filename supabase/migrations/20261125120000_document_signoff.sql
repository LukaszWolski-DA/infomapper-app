-- Slice 36 (D-88 as proposed): documents from a baseline. The sign-off package is a fourth preset, so the preset's
-- CHECK is widened. `source_kind` and `baseline_id` already allow a baseline (`document_definition_source_ck`, the key
-- `baseline_id references baseline (id)`, slice 25); a baseline of the same workspace, live at the write, is the domain's
-- rule (the key accepts a soft-deleted baseline, which a document keeps pointing to: B3.5).

alter table document_definition drop constraint document_definition_preset_ck;
alter table document_definition
  add constraint document_definition_preset_ck check (preset in ('dictionary', 's2t', 'signoff', 'blank'));
