import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type SqliteDb = ReturnType<typeof drizzle<typeof schema>>;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE,
  kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  primary_agent_id TEXT REFERENCES agents(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  parent_memory_id TEXT REFERENCES memories(id),
  supersedes_id TEXT REFERENCES memories(id),
  title TEXT,
  content TEXT NOT NULL,
  structured_json TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_versions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id),
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  author_agent_id TEXT REFERENCES agents(id),
  created_at TEXT NOT NULL,
  change_reason TEXT,
  UNIQUE(memory_id, version)
);

CREATE TABLE IF NOT EXISTS tool_invocations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  tool_name TEXT NOT NULL,
  tool_version TEXT,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_json TEXT,
  related_memory_ids_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  compacted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compaction_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  summary TEXT NOT NULL,
  compressed_before TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compaction_session ON compaction_summaries(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_memories_parent ON memories(parent_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_versions_mid ON memory_versions(memory_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_tool_invocations_session ON tool_invocations(session_id, started_at);
`;

const MIGRATE_SQL = `
-- Add compacted column to chat_messages if missing (idempotent)
ALTER TABLE chat_messages ADD COLUMN compacted INTEGER NOT NULL DEFAULT 0;
`;

export function createConnection(dbPath: string = ":memory:"): SqliteDb {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(INIT_SQL);

  for (const stmt of MIGRATE_SQL.split(";")) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    try { sqlite.exec(trimmed); } catch { /* column already exists */ }
  }

  return drizzle(sqlite, { schema });
}
