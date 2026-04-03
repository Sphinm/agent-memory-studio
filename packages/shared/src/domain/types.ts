export type UUID = string;
export type ISODateString = string;

export type MemoryStatus = "draft" | "active" | "archived" | "deleted";
export type MemoryKind = "summary" | "fact" | "hypothesis" | "constraint" | "goal" | "note";
export type SessionStatus = "open" | "closed";
export type AgentKind = "human" | "bot" | "orchestrator" | "subagent";
export type ToolCallStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface AgentCapability {
  name: string;
  description?: string;
}

export interface AgentProfile {
  id: UUID;
  externalId?: string | null;
  kind: AgentKind;
  displayName: string;
  capabilities: AgentCapability[];
  metadata: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Session {
  id: UUID;
  title?: string | null;
  status: SessionStatus;
  primaryAgentId?: UUID | null;
  startedAt: ISODateString;
  endedAt?: ISODateString | null;
  metadata: Record<string, unknown>;
}

export interface MemorySummaryPayload {
  goal: string;
  confirmedSlots: Record<string, string | number | boolean>;
  pendingSlots: string[];
  actionsDone: string[];
  constraints: string[];
}

export interface MemoryEntry {
  id: UUID;
  sessionId: UUID;
  agentId: UUID;
  kind: MemoryKind;
  status: MemoryStatus;
  parentMemoryId?: UUID | null;
  supersedesId?: UUID | null;
  title?: string | null;
  content: string;
  structured?: MemorySummaryPayload | null;
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  archivedAt?: ISODateString | null;
}

export interface MemoryVersion {
  id: UUID;
  memoryId: UUID;
  version: number;
  snapshot: MemoryEntry;
  authorAgentId?: UUID | null;
  createdAt: ISODateString;
  changeReason?: string | null;
}

export interface ToolInvocation {
  id: UUID;
  sessionId: UUID;
  agentId: UUID;
  toolName: string;
  toolVersion?: string | null;
  status: ToolCallStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | string | null;
  error?: { code: string; message: string } | null;
  relatedMemoryIds: UUID[];
  startedAt: ISODateString;
  finishedAt?: ISODateString | null;
}

export type MemoryEntryCreate = Omit<MemoryEntry, "id" | "createdAt" | "updatedAt" | "archivedAt"> & {
  status?: MemoryStatus;
};

export type MemoryEntryUpdate = Partial<
  Pick<MemoryEntry, "title" | "content" | "structured" | "tags" | "status" | "parentMemoryId">
>;
