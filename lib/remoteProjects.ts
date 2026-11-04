import type { StoredProject } from "@/types/workspace";

export const portalMode = process.env.NEXT_PUBLIC_SNEDO_PORTAL_MODE === "1";
const root = "/aikataulu/api";

export type RemoteContext = { companyId: string; companyName: string; userId: string; userName: string; role: "read" | "edit" | "admin" };
export type RemoteLock = { userId: string; userName: string; expiresAt: string } | null;
export type RemoteListing = { id: string; revision: number; projectNumber: string; projectName: string; scheduleName: string; updatedAt: string; updatedBy: string; lock: RemoteLock };
export type RemoteProject = { id: string; revision: number; data: StoredProject; updatedAt: string; updatedBy: string; lock: RemoteLock };

export class RemoteError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${root}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new RemoteError(result.error || "Palvelin ei vastannut.", response.status);
  return result as T;
}

export const remoteProjects = {
  context: () => request<RemoteContext>("/context"),
  list: () => request<{ projects: RemoteListing[] }>("/projects"),
  get: (id: string) => request<RemoteProject>(`/projects/${encodeURIComponent(id)}`),
  create: (data: StoredProject) => request<RemoteProject>("/projects", { method: "POST", body: JSON.stringify(data) }),
  save: (id: string, expectedRevision: number, data: StoredProject) => request<RemoteProject>(`/projects/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ expectedRevision, data }) }),
  lock: (id: string, takeover = false) => request<{ lock: RemoteLock }>(`/projects/${encodeURIComponent(id)}/lock`, { method: "POST", body: JSON.stringify({ takeover }) }),
  unlock: (id: string) => request<{ lock: null }>(`/projects/${encodeURIComponent(id)}/lock`, { method: "DELETE" }),
};
