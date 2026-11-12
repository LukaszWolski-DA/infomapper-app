/** The workspace home's Metadata conventions tab (slice 23). */
export const CONVENTIONS_TAB = "conventions";
export const workspaceHref = (workspaceId: string, tab?: string) =>
  `/w/${workspaceId}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
export const projectHref = (workspaceId: string, projectId: string) => `/w/${workspaceId}/p/${projectId}`;
export const canvasHref = (workspaceId: string, projectId: string, canvasId: string) =>
  `/w/${workspaceId}/p/${projectId}/c/${canvasId}`;
/** A document's form, and its page with `view` (slice 25, F27). */
export const documentHref = (workspaceId: string, documentId: string, view?: boolean) => `/w/${workspaceId}/d/${documentId}${view ? "/view" : ""}`;
/** The workspace home's Documentation tab (slice 25). */
export const DOCUMENTATION_TAB = "docs";
