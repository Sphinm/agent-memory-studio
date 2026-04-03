import { eq, desc, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type {
  MemoryEntry,
  MemoryVersion,
  MemoryEntryCreate,
  MemoryEntryUpdate,
} from "@agent-memory-studio/shared";
import { AppError } from "@agent-memory-studio/shared";
import type { SqliteDb } from "../adapters/sqlite/connection.js";
import { memories, memoryVersions } from "../adapters/sqlite/schema.js";

export class MemoryService {
  constructor(private db: SqliteDb) {}

  async create(input: MemoryEntryCreate): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const id = uuid();
    const entry: MemoryEntry = {
      id,
      sessionId: input.sessionId,
      agentId: input.agentId,
      kind: input.kind,
      status: input.status ?? "active",
      parentMemoryId: input.parentMemoryId ?? null,
      supersedesId: input.supersedesId ?? null,
      title: input.title ?? null,
      content: input.content,
      structured: input.structured ?? null,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    this.db
      .insert(memories)
      .values({
        ...entry,
        structuredJson: entry.structured ? JSON.stringify(entry.structured) : null,
        tagsJson: JSON.stringify(entry.tags),
      })
      .run();

    const versionId = uuid();
    this.db
      .insert(memoryVersions)
      .values({
        id: versionId,
        memoryId: id,
        version: 1,
        snapshotJson: JSON.stringify(entry),
        authorAgentId: input.agentId,
        createdAt: now,
        changeReason: "created",
      })
      .run();

    return entry;
  }

  async getById(id: string): Promise<MemoryEntry> {
    const rows = this.db.select().from(memories).where(eq(memories.id, id)).all();
    if (rows.length === 0) throw AppError.notFound("Memory", id);
    return this.rowToEntry(rows[0]!);
  }

  async update(
    id: string,
    input: MemoryEntryUpdate & { changeReason?: string; agentId?: string },
  ): Promise<MemoryEntry> {
    const existing = await this.getById(id);
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = { updatedAt: now };
    if (input.title !== undefined) patch.title = input.title;
    if (input.content !== undefined) patch.content = input.content;
    if (input.structured !== undefined)
      patch.structuredJson = input.structured ? JSON.stringify(input.structured) : null;
    if (input.tags !== undefined) patch.tagsJson = JSON.stringify(input.tags);
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "archived") patch.archivedAt = now;
    }
    if (input.parentMemoryId !== undefined) patch.parentMemoryId = input.parentMemoryId;

    this.db.update(memories).set(patch).where(eq(memories.id, id)).run();

    const updated = await this.getById(id);
    const latestVersion = this.getLatestVersion(id);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    this.db
      .insert(memoryVersions)
      .values({
        id: uuid(),
        memoryId: id,
        version: nextVersion,
        snapshotJson: JSON.stringify(updated),
        authorAgentId: input.agentId ?? existing.agentId,
        createdAt: now,
        changeReason: input.changeReason ?? null,
      })
      .run();

    return updated;
  }

  async archive(id: string): Promise<MemoryEntry> {
    return this.update(id, { status: "archived", changeReason: "archived" });
  }

  async listBySession(
    sessionId: string,
    opts?: { kind?: string; status?: string; limit?: number },
  ): Promise<MemoryEntry[]> {
    const conditions = [eq(memories.sessionId, sessionId)];
    if (opts?.kind) conditions.push(eq(memories.kind, opts.kind));
    if (opts?.status) conditions.push(eq(memories.status, opts.status));

    const rows = this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(opts?.limit ?? 50)
      .all();

    return rows.map((r) => this.rowToEntry(r));
  }

  async search(query: string, opts?: { sessionId?: string; limit?: number }): Promise<MemoryEntry[]> {
    const pattern = `%${query}%`;
    const conditions = [
      sql`(${memories.content} LIKE ${pattern} OR ${memories.title} LIKE ${pattern})`,
    ];
    if (opts?.sessionId) conditions.push(eq(memories.sessionId, opts.sessionId));

    const rows = this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(opts?.limit ?? 50)
      .all();

    return rows.map((r) => this.rowToEntry(r));
  }

  async getVersions(memoryId: string): Promise<MemoryVersion[]> {
    const rows = this.db
      .select()
      .from(memoryVersions)
      .where(eq(memoryVersions.memoryId, memoryId))
      .orderBy(desc(memoryVersions.version))
      .all();
    return rows.map((r) => ({
      id: r.id,
      memoryId: r.memoryId,
      version: r.version,
      snapshot: JSON.parse(r.snapshotJson),
      authorAgentId: r.authorAgentId,
      createdAt: r.createdAt,
      changeReason: r.changeReason,
    }));
  }

  private getLatestVersion(memoryId: string) {
    const rows = this.db
      .select()
      .from(memoryVersions)
      .where(eq(memoryVersions.memoryId, memoryId))
      .orderBy(desc(memoryVersions.version))
      .limit(1)
      .all();
    return rows[0] ?? null;
  }

  private rowToEntry(row: typeof memories.$inferSelect): MemoryEntry {
    return {
      id: row.id,
      sessionId: row.sessionId,
      agentId: row.agentId,
      kind: row.kind as MemoryEntry["kind"],
      status: row.status as MemoryEntry["status"],
      parentMemoryId: row.parentMemoryId,
      supersedesId: row.supersedesId,
      title: row.title,
      content: row.content,
      structured: row.structuredJson ? JSON.parse(row.structuredJson) : null,
      tags: JSON.parse(row.tagsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      archivedAt: row.archivedAt,
    };
  }
}
