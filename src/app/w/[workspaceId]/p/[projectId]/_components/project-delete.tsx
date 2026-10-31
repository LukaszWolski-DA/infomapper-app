"use client";

// "Delete this project" at the end of the project home (slice 12a, D-65; prototype `renderHome`, `data-hdel`): two
// clicks, no dialog. The text under the button is the preview, computed by the page from what it already shows (the
// canvases and the projects each one is in, P4): which canvases go with the project and which stay in their other
// projects. The only project cannot be deleted. Shown only to people who may delete it, in a workspace that is not
// archived (F19). The delete runs on the project row's save chain (`saveRow`, `deletes`, F23); its page, drawn again,
// leads to the workspace home, where the toast offers Undo (item 14).

import { deleteProjectAction } from "@/app/_actions/workspace";
import { useAction } from "@/app/_components/use-action";
import { ConfirmDelete, dangerClass } from "@/app/_panels/fields";

export const ONLY_PROJECT_TEXT = "This is the only project.";
export const DELETE_PROJECT_TEXT = "The model is untouched. Canvases shared with other projects stay there; canvases only in this project are deleted with it.";

/** The toast after the delete (item 14): how many canvases went with it, from the server's answer. */
export const deletedProjectToast = (name: string, canvases: number): string =>
  `Deleted the project ${name}${canvases ? ` and ${canvases} canvas${canvases === 1 ? "" : "es"} that only it used` : ""}. The model is untouched.`;

export function ProjectDelete({
  workspaceId,
  project,
  only,
  deleted,
  staying,
}: {
  workspaceId: string;
  project: { id: string; name: string; version: number };
  /** The workspace's only live project. */
  only: boolean;
  /** The names of the canvases only this project uses, in tab order. */
  deleted: readonly string[];
  /** The names of the canvases that stay in their other projects. */
  staying: readonly string[];
}) {
  const { saveRow } = useAction();
  const remove = () =>
    void saveRow(
      project,
      (v) => deleteProjectAction({ workspaceId, projectId: project.id, expectedVersion: v }),
      (r) => deletedProjectToast(r.name, r.deletedCanvases),
      { undoable: true, deletes: true },
    );

  return (
    <div className="mt-10 border-t border-im-line pt-4" data-testid="section-project-delete">
      {only ? (
        <button type="button" className={dangerClass} disabled data-testid="button-delete-project">
          Delete this project
        </button>
      ) : (
        <ConfirmDelete label="Delete this project" armedText="Click again to delete the project" onConfirm={remove} testId="button-delete-project" />
      )}
      <p className="mt-1.5 text-xs text-im-ink-3" data-testid="text-project-delete">
        {only ? (
          ONLY_PROJECT_TEXT
        ) : (
          <>
            {DELETE_PROJECT_TEXT}
            {deleted.length > 0 && <span data-testid="text-project-delete-with"> Deleted with it: {deleted.join(", ")}.</span>}
            {staying.length > 0 && <span data-testid="text-project-delete-staying"> Staying in other projects: {staying.join(", ")}.</span>}
          </>
        )}
      </p>
    </div>
  );
}
