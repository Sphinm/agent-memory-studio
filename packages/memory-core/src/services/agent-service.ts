import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { AgentProfile } from "@agent-memory-studio/shared";
import { AppError } from "@agent-memory-studio/shared";
import type { SqliteDb } from "../adapters/sqlite/connection.js";
import { agents } from "../adapters/sqlite/schema.js";

export class AgentService {
  constructor(private db: SqliteDb) {}

  async create(input: {
    externalId?: string | null;
    kind: AgentProfile["kind"];
    displayName: string;
    capabilities?: AgentProfile["capabilities"];
    metadata?: Record<string, unknown>;
  }): Promise<AgentProfile> {
    const now = new Date().toISOString();
    const id = uuid();
    const row = {
      id,
      externalId: input.externalId ?? null,
      kind: input.kind,
      displayName: input.displayName,
      capabilitiesJson: JSON.stringify(input.capabilities ?? []),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(agents).values(row).run();
    return this.rowToProfile(row);
  }

  async getById(id: string): Promise<AgentProfile> {
    const rows = this.db.select().from(agents).where(eq(agents.id, id)).all();
    if (rows.length === 0) throw AppError.notFound("Agent", id);
    return this.rowToProfile(rows[0]!);
  }

  async list(): Promise<AgentProfile[]> {
    const rows = this.db.select().from(agents).all();
    return rows.map((r) => this.rowToProfile(r));
  }

  async update(
    id: string,
    input: Partial<{
      displayName: string;
      kind: AgentProfile["kind"];
      capabilities: AgentProfile["capabilities"];
      metadata: Record<string, unknown>;
    }>,
  ): Promise<AgentProfile> {
    await this.getById(id);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.capabilities !== undefined)
      patch.capabilitiesJson = JSON.stringify(input.capabilities);
    if (input.metadata !== undefined)
      patch.metadataJson = JSON.stringify(input.metadata);

    this.db.update(agents).set(patch).where(eq(agents.id, id)).run();
    return this.getById(id);
  }

  private rowToProfile(row: typeof agents.$inferSelect): AgentProfile {
    return {
      id: row.id,
      externalId: row.externalId,
      kind: row.kind as AgentProfile["kind"],
      displayName: row.displayName,
      capabilities: JSON.parse(row.capabilitiesJson),
      metadata: JSON.parse(row.metadataJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
