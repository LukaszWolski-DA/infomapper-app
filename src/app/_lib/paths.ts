export const workspaceHref = (workspaceId: string, tab?: string) =>
  `/w/${workspaceId}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
export const projectHref = (workspaceId: string, projectId: string) => `/w/${workspaceId}/p/${projectId}`;
export const canvasHref = (workspaceId: string, projectId: string, canvasId: string) =>
  `/w/${workspaceId}/p/${projectId}/c/${canvasId}`;
