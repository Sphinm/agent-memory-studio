const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const API_PREFIX = `${API_BASE}/api/v1`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () =>
    fetch(`${API_BASE}/health`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ status: string }>)
      .catch(() => ({ status: "unavailable" })),

  agents: {
    list: () => request<AgentProfile[]>("/agents"),
    create: (data: CreateAgentInput) =>
      request<AgentProfile>("/agents", { method: "POST", body: JSON.stringify(data) }),
  },

  sessions: {
    list: (params?: { status?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      return request<Session[]>(`/sessions${query ? `?${query}` : ""}`);
    },
    create: (data: CreateSessionInput) =>
      request<Session>("/sessions", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => request<Session>(`/sessions/${id}`),
    getMemories: (id: string, params?: { kind?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.kind) qs.set("kind", params.kind);
      if (params?.status) qs.set("status", params.status);
      const query = qs.toString();
      return request<MemoryEntry[]>(`/sessions/${id}/memories${query ? `?${query}` : ""}`);
    },
  },

  memories: {
    get: (id: string) => request<MemoryEntry>(`/memories/${id}`),
    create: (data: CreateMemoryInput) =>
      request<MemoryEntry>("/memories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateMemoryInput) =>
      request<MemoryEntry>(`/memories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    archive: (id: string) =>
      request<MemoryEntry>(`/memories/${id}/archive`, { method: "POST" }),
    versions: (id: string) => request<MemoryVersion[]>(`/memories/${id}/versions`),
  },

  search: (q: string, sessionId?: string) => {
    const qs = new URLSearchParams({ q });
    if (sessionId) qs.set("sessionId", sessionId);
    return request<MemoryEntry[]>(`/search?${qs}`);
  },
};

interface AgentProfile {
  id: string;
  kind: string;
  displayName: string;
  capabilities: { name: string; description?: string }[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface Session {
  id: string;
  title?: string | null;
  status: string;
  primaryAgentId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  metadata: Record<string, unknown>;
}
interface MemoryEntry {
  id: string;
  sessionId: string;
  agentId: string;
  kind: string;
  status: string;
  parentMemoryId?: string | null;
  title?: string | null;
  content: string;
  structured?: unknown;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
interface MemoryVersion {
  id: string;
  memoryId: string;
  version: number;
  snapshot: MemoryEntry;
  createdAt: string;
  changeReason?: string | null;
}
type CreateAgentInput = { kind: string; displayName: string; capabilities?: { name: string }[]; metadata?: Record<string, unknown> };
type CreateSessionInput = { title?: string; primaryAgentId?: string; metadata?: Record<string, unknown> };
type CreateMemoryInput = { sessionId: string; agentId: string; kind: string; content: string; title?: string; tags?: string[]; structured?: unknown };
type UpdateMemoryInput = { content?: string; title?: string; tags?: string[]; status?: string; changeReason?: string };
