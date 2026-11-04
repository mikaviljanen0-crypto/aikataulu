import type { StoredProject } from "@/types/workspace";

export const portalMode = process.env.NEXT_PUBLIC_SNEDO_PORTAL_MODE === "1";
const root = "/aikataulu/api";
let portalSession: Promise<{ csrf: string }> | null = null;
let tabId = "";
function session() {
  if (!portalSession) portalSession = fetch("/portal-api/me", { credentials: "same-origin", cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Kirjaudu ensin TJT:n pääsivulla.");
      const value = await response.json();
      if (typeof value.csrf !== "string") throw new Error("Istunnon vahvistus puuttuu.");
      return value as { csrf: string };
    }).catch(error => { portalSession = null; throw error; });
  return portalSession;
}

export type RemoteContext = { companyId: string; companyName: string; userId: string; userName: string; role: "read" | "edit" | "admin" };
export type RemoteLock = { userId: string; userName: string; expiresAt: string } | null;
export type RemoteListing = { id: string; revision: number; projectNumber: string; projectName: string; scheduleName: string; updatedAt: string; updatedBy: string; lock: RemoteLock };
export type RemoteProject = { id: string; revision: number; data: StoredProject; updatedAt: string; updatedBy: string; lock: RemoteLock };

export class RemoteError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const company = new URLSearchParams(window.location.search).get("company");
  if (!company || !["tjt", "tjt_katto", "previmek"].includes(company)) throw new Error("Valitse yritys TJT:n pääsivulla.");
  const { csrf } = await session();
  if (!tabId) tabId = crypto.randomUUID();
  const response = await fetch(`${root}${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(init?.headers ?? {}), "content-type": "application/json", "x-tjt-company": company, "x-tjt-csrf": csrf, "x-tjt-tab": tabId },
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

