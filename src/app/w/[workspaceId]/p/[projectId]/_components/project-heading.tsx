"use client";

// The project's name and description on its home (slice 9, D-59), as the prototype's .ph-name and .ph-desc: fields for
// owners, admins and modelers in a workspace that is not archived, text for everyone else. The name saves on Enter or
// on leaving it, the description on leaving it (Enter adds a line); both through `saveRow`, so the name and at once the
// description are both stored. An empty name goes back with D-59's toast. The description grows with its text through
// CSS (`field-sizing: content`, Chromium); where that is missing (Firefox, WebKit) its `rows` follow the text's lines,
// counted from the text in the render and in the input event. Nothing reads a height (item 12; CLAUDE.md, slice 6a).

import { useEffect, useState } from "react";
import { updateProjectAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { DraftLine, fieldKey, useDraft } from "@/app/_panels/fields";
import { PROJECT_NAME_REQUIRED } from "@/domain/commands/project";
import { useToast } from "@/ui/components/toast";
import { rowSaves } from "@/ui/row-saves";

/** The description's lines, for `rows` where `field-sizing` is missing (wrapped lines are not counted). */
const lines = (text: string) => text.split("\n").length;

const fieldClass = "w-full rounded border-0 bg-transparent py-0.5 outline-none hover:bg-im-surface hover:shadow-[0_0_0_1px_var(--im-line)] focus:bg-im-surface focus:shadow-[0_0_0_1px_var(--im-line)]";

export function ProjectHeading({
  workspaceId,
  project,
  editable,
}: {
  workspaceId: string;
  project: { id: string; name: string; description: string | null; version: number };
  editable: boolean;
}) {
  // a page that could edit and no longer can (an archive, a role) keeps its fields until its saves are settled, so a
  // refused draft stays readable (slice 13, item 9); a page that never could shows text
  const [wasEditable] = useState(editable);
  if (!editable && !wasEditable) return <HeadingText project={project} />;
  return <EditableHeading workspaceId={workspaceId} project={project} readOnly={!editable} />;
}

/** The name and description as text (reviewers and readers, D-59). */
function HeadingText({ project }: { project: { name: string; description: string | null } }) {
  return (
    <>
      <h1 className="m-0 py-0.5 text-2xl font-semibold leading-tight" data-testid="text-project-name">
        {project.name}
      </h1>
      {project.description && (
        <p className="m-0 whitespace-pre-line py-0.5 text-im-ink-2" data-testid="text-project-description">
          {project.description}
        </p>
      )}
    </>
  );
}

/** The fields (slice 13, D-66): each keeps its draft across the page's fresh values and after a refusal. */
function EditableHeading({
  workspaceId,
  project,
  readOnly,
}: {
  workspaceId: string;
  project: { id: string; name: string; description: string | null; version: number };
  readOnly: boolean;
}) {
  const { saveRow } = useAction();
  const toast = useToast();
  const save = (patch: { name?: string; description?: string }) =>
    saveRow(project, (v) => updateProjectAction({ workspaceId, projectId: project.id, expectedVersion: v, ...patch }));
  const { bind: nameBind, defaultValue: nameInitial, commit: nameCommit, keyDown: nameKeyDown, mark: nameMark, takeStored: nameTake, keepMine: nameKeep } = useDraft<HTMLInputElement>(project.name, (v) => save({ name: v }), {
    prepare: (t) => t.trim(),
    required: true,
    onEmpty: () => toast(PROJECT_NAME_REQUIRED, "refusal"),
    readOnly,
  });
  // trimmed as the server stores it; the lines inside stay
  const { bind: descriptionBind, defaultValue: descriptionInitial, commit: descriptionCommit, keyDown: descriptionKeyDown, mark: descriptionMark, takeStored: descriptionTake, keepMine: descriptionKeep } = useDraft<HTMLTextAreaElement>(project.description ?? "", (v) => save({ description: v }), { prepare: (t) => t.trim(), readOnly });
  // read-only now: once the saves on their way are settled, the fields without a refused draft become text again
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (!readOnly) return;
    let live = true;
    void rowSaves.settled().then(() => setTimeout(() => live && setQuiet(true), 0));
    return () => {
      live = false;
    };
  }, [readOnly]);
  if (readOnly && quiet && !nameMark && !descriptionMark) return <HeadingText project={project} />;

  return (
    <>
      <h1 className="m-0">
        <input
          key={fieldKey(project.id, "name")}
          ref={nameBind}
          type="text"
          readOnly={readOnly}
          defaultValue={nameInitial}
          aria-label="Project name"
          autoComplete="off"
          data-testid="field-project-name"
          className={`${fieldClass} text-2xl font-semibold leading-tight text-im-ink`}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            nameKeyDown(e);
          }}
          onBlur={nameCommit}
        />
      </h1>
      <DraftLine mark={nameMark} onUse={nameTake} onKeep={nameKeep} />
      <textarea
        key={fieldKey(project.id, "description")}
        ref={descriptionBind}
        readOnly={readOnly}
        rows={lines(project.description ?? "")}
        defaultValue={descriptionInitial}
        placeholder="What is this project about?"
        aria-label="Project description"
        data-testid="field-project-description"
        // the stored version the page shows: tests wait for a save's fresh page with it (slice 13)
        data-version={project.version}
        className={`${fieldClass} min-h-6 resize-none text-im-ink-2 [field-sizing:content]`}
        onInput={(e) => (e.currentTarget.rows = lines(e.currentTarget.value))}
        onBlur={descriptionCommit}
        onKeyDown={descriptionKeyDown}
      />
      <DraftLine mark={descriptionMark} onUse={descriptionTake} onKeep={descriptionKeep} />
    </>
  );
}
