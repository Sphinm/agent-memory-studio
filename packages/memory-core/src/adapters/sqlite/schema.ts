import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  externalId: text("external_id").unique(),
  kind: text("kind").notNull(),
  displayName: text("display_name").notNull(),
  capabilitiesJson: text("capabilities_json").notNull().default("[]"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title"),
  status: text("status").notNull().default("open"),
  primaryAgentId: text("primary_agent_id").references(() => agents.id),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  metadataJson: text("metadata_json").notNull().default("{}"),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("active"),
  parentMemoryId: text("parent_memory_id").references((): ReturnType<typeof text> => memories.id),
  supersedesId: text("supersedes_id").references((): ReturnType<typeof text> => memories.id),
  title: text("title"),
  content: text("content").notNull(),
  structuredJson: text("structured_json"),
  tagsJson: text("tags_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

export const memoryVersions = sqliteTable("memory_versions", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull().references(() => memories.id),
  version: integer("version").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  authorAgentId: text("author_agent_id").references(() => agents.id),
  createdAt: text("created_at").notNull(),
  changeReason: text("change_reason"),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  compacted: integer("compacted").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const compactionSummaries = sqliteTable("compaction_summaries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  summary: text("summary").notNull(),
  compressedBefore: text("compressed_before").notNull(),
  messageCount: integer("message_count").notNull(),
  createdAt: text("created_at").notNull(),
});

export const toolInvocations = sqliteTable("tool_invocations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  toolName: text("tool_name").notNull(),
  toolVersion: text("tool_version"),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json"),
  errorJson: text("error_json"),
  relatedMemoryIdsJson: text("related_memory_ids_json").notNull().default("[]"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});
