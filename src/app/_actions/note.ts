"use server";

// Notes on a canvas (slice 3a): create, change the text, colour, status or width, move, pin, unpin, delete. Each runs
// one domain command on the canvas as it is stored now and returns the note as the canvas draws it; the canvas shows
// the change at once and needs no fresh page (the note panel reads the canvas). Reviewers may do all of this (Łukasz,
// step 0 answer 1); readers only read.

import type { DataStore } from "@/data";
import type { CommandContext, CommandResult } from "@/domain/changes";
import { createNote, deleteNote, moveNote, pinNote, unpinNote, updateNote, type NoteCanvasState } from "@/domain/commands/note";
import type { Uuid } from "@/domain/ids";
import type { WorkspaceAccess } from "@/domain/permissions";
import type { Note } from "@/domain/types";
import { buildNotes, type NoteData } from "@/canvas/note-data";
import { runCommand, type ActionResult } from "../_lib/run-command";

const NOT_FOUND = { ok: false as const, error: { code: "not_found" as const, message: "This workspace does not exist." } };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function canvasOf(store: DataStore, ws: Uuid, canvasId: Uuid): Promise<NoteCanvasState> {
  const [canvas, items, frames, notes] = await Promise.all([
    store.canvases.get(ws, canvasId),
    store.canvasItems.listOfCanvas(ws, canvasId),
    store.frames.listOfCanvas(ws, canvasId),
    store.notes.listOfCanvas(ws, canvasId),
  ]);
  return { canvas, items, frames, notes };
}

/** Runs a note command; `canvasIdOf` finds the canvas (from the input, or from the note it names). */
function noteCommand(
  workspaceId: unknown,
  canvasIdOf: (store: DataStore, ws: Uuid) => Promise<Uuid>,
  command: (ctx: CommandContext, access: WorkspaceAccess, state: NoteCanvasState) => CommandResult<{ note: Note }>,
): Promise<ActionResult<{ note: NoteData }>> {
  return runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    const state = await canvasOf(store, workspace.id, await canvasIdOf(store, workspace.id));
    const r = command(ctx, access, state);
    if (!r.ok) return r;
    const users = await store.users.list();
    const [note] = buildNotes([r.value.note], state.frames, (id) => users.find((u) => u.id === id)?.display_name ?? "someone");
    return { ...r, value: { note: note! } };
  });
}

const ofNote = (noteId: unknown) => async (store: DataStore, ws: Uuid) => (await store.notes.get(ws, str(noteId)))?.canvas_id ?? "";

export async function createNoteAction(
  workspaceId: string,
  canvasId: string,
  input: { text: string; x?: number; y?: number; pin?: { canvasItemId?: string; frameId?: string } },
) {
  return noteCommand(workspaceId, async () => str(canvasId), (ctx, access, state) => createNote(ctx, access, state, { ...input, canvasId }));
}

export async function updateNoteAction(workspaceId: string, input: { noteId: string; expectedVersion: number; text?: string | null; color?: string; status?: string; width?: number }) {
  return noteCommand(workspaceId, ofNote(input?.noteId), (ctx, access, state) => updateNote(ctx, access, state, input));
}

export async function moveNoteAction(workspaceId: string, input: { noteId: string; expectedVersion: number; x: number; y: number }) {
  return noteCommand(workspaceId, ofNote(input?.noteId), (ctx, access, state) => moveNote(ctx, access, state, input));
}

export async function pinNoteAction(workspaceId: string, input: { noteId: string; expectedVersion: number; pin: { canvasItemId?: string; frameId?: string } }) {
  return noteCommand(workspaceId, ofNote(input?.noteId), (ctx, access, state) => pinNote(ctx, access, state, input));
}

export async function unpinNoteAction(workspaceId: string, input: { noteId: string; expectedVersion: number }) {
  return noteCommand(workspaceId, ofNote(input?.noteId), (ctx, access, state) => unpinNote(ctx, access, state, input));
}

export async function deleteNoteAction(workspaceId: string, input: { noteId: string; expectedVersion: number }): Promise<ActionResult> {
  return runCommand(async (ctx, store, user) => {
    const workspace = typeof workspaceId === "string" ? await store.workspaces.get(workspaceId) : null;
    if (!workspace) return NOT_FOUND;
    const access = { workspace, member: await store.workspaces.getMember(workspace.id, user.id) };
    return deleteNote(ctx, access, { note: await store.notes.get(workspace.id, str(input?.noteId)) }, input);
  });
}
