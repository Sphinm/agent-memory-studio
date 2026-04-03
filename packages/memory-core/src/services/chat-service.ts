import { eq, and, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { SqliteDb } from "../adapters/sqlite/connection.js";
import { chatMessages } from "../adapters/sqlite/schema.js";

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export class ChatService {
  constructor(private db: SqliteDb) {}

  async addMessage(sessionId: string, role: ChatMessage["role"], content: string): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: uuid(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    this.db.insert(chatMessages).values({ ...msg, compacted: 0 }).run();
    return msg;
  }

  async getHistory(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    const rows = this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role as ChatMessage["role"],
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  /** Returns only messages not yet compressed by compaction */
  async getRecentUncompacted(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    const rows = this.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.compacted, 0),
        ),
      )
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role as ChatMessage["role"],
      content: r.content,
      createdAt: r.createdAt,
    }));
  }
}
