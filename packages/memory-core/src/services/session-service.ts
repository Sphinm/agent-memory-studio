import { eq, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Session } from "@agent-memory-studio/shared";
import { AppError } from "@agent-memory-studio/shared";
import type { SqliteDb } from "../adapters/sqlite/connection.js";
import { sessions } from "../adapters/sqlite/schema.js";

export class SessionService {
  constructor(private db: SqliteDb) {}

  async create(input: {
    title?: string | null;
    primaryAgentId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Session> {
    const now = new Date().toISOString();
    const id = uuid();
    const row = {
      id,
      title: input.title ?? null,
      status: "open" as const,
      primaryAgentId: input.primaryAgentId ?? null,
      startedAt: now,
      endedAt: null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    };
    this.db.insert(sessions).values(row).run();
    return this.rowToSession(row);
  }

  async getById(id: string): Promise<Session> {
    const rows = this.db.select().from(sessions).where(eq(sessions.id, id)).all();
    if (rows.length === 0) throw AppError.notFound("Session", id);
    return this.rowToSession(rows[0]!);
  }

  async list(opts?: {
    status?: string;
    limit?: number;
  }): Promise<Session[]> {
    let q = this.db.select().from(sessions);
    if (opts?.status) {
      q = q.where(eq(sessions.status, opts.status)) as typeof q;
    }
    const rows = q.orderBy(desc(sessions.startedAt)).limit(opts?.limit ?? 20).all();
    return rows.map((r) => this.rowToSession(r));
  }

  async update(
    id: string,
    input: Partial<{ title: string | null; status: string; metadata: Record<string, unknown> }>,
  ): Promise<Session> {
    await this.getById(id);
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "closed") patch.endedAt = new Date().toISOString();
    }
    if (input.metadata !== undefined)
      patch.metadataJson = JSON.stringify(input.metadata);

    this.db.update(sessions).set(patch).where(eq(sessions.id, id)).run();
    return this.getById(id);
  }

  private rowToSession(row: typeof sessions.$inferSelect): Session {
    return {
      id: row.id,
      title: row.title,
      status: row.status as Session["status"],
      primaryAgentId: row.primaryAgentId,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      metadata: JSON.parse(row.metadataJson),
    };
  }
}
