import { eq, and, asc, desc, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { SqliteDb } from "../adapters/sqlite/connection.js";
import { chatMessages, compactionSummaries } from "../adapters/sqlite/schema.js";

export interface CompactionSummary {
  id: string;
  sessionId: string;
  summary: string;
  compressedBefore: string;
  messageCount: number;
  createdAt: string;
}

export interface ExtractedMemory {
  kind: "fact" | "goal" | "constraint" | "summary" | "note";
  content: string;
  title?: string;
}

export interface CompactionResult {
  summary: CompactionSummary;
  extractedMemories: ExtractedMemory[];
}

export interface LlmCompletionParams {
  model: string;
  max_tokens: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  response_format?: { type: "json_object" | "text" };
}

export interface LlmClient {
  chat: {
    completions: {
      create(params: LlmCompletionParams): Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
}

const COMPACTION_PROMPT = `You are a conversation compressor for an AI memory system.

You will receive a block of conversation messages. Your job is to:

1. Write a concise summary (2-4 paragraphs) preserving all important information: decisions made, problems discussed, solutions found, code details, architecture choices, and user preferences.

2. Extract discrete memories — facts, goals, and constraints that are worth persisting long-term.

Rules for the summary:
- Preserve technical details: file paths, function names, library names, error messages
- Preserve decisions and their reasoning
- Preserve user preferences and stated requirements
- Omit greetings, filler, and redundant back-and-forth
- Write in the same language the conversation uses

Rules for extracted memories:
- kind must be one of: fact, goal, constraint, note
- Each memory should be a single atomic piece of information
- Do NOT extract trivial or transient information (e.g. "user said hello")
- Deduplicate: if a fact was corrected later, only keep the final version

Respond with a JSON object (no markdown fencing):
{
  "summary": "...",
  "memories": [
    { "kind": "fact", "content": "...", "title": "..." },
    { "kind": "goal", "content": "...", "title": "..." }
  ]
}`;

/** Estimate token count from a string (chars / 3.5, works for mixed CJK/Latin) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export interface ContextBudgetResult {
  messagesToSend: Array<{ role: string; content: string }>;
  messagesToCompact: Array<{ id: string; role: string; content: string; createdAt: string }>;
  usedTokens: number;
}

export class CompactionService {
  private tokenBudget: number;
  private reservedTokens: number;
  private minCompactMessages: number;

  constructor(
    private db: SqliteDb,
    opts?: { tokenBudget?: number; reservedTokens?: number; minCompactMessages?: number },
  ) {
    this.tokenBudget = opts?.tokenBudget ?? 6000;
    this.reservedTokens = opts?.reservedTokens ?? 2000;
    this.minCompactMessages = opts?.minCompactMessages ?? 4;
  }

  /**
   * Build a token-budgeted sliding window from uncompacted messages.
   * Fills from newest to oldest until the budget is exhausted.
   * Returns which messages fit (for prompt) and which overflow (for compaction).
   */
  buildWindow(
    messages: Array<{ id: string; role: string; content: string; createdAt: string }>,
    budgetTokens: number,
  ): ContextBudgetResult {
    let remaining = budgetTokens;
    const messagesToSend: Array<{ role: string; content: string }> = [];
    let cutoff = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const cost = estimateTokens(messages[i]!.content) + 10;
      if (remaining - cost < 0 && messagesToSend.length > 0) {
        cutoff = i + 1;
        break;
      }
      remaining -= cost;
      messagesToSend.unshift({ role: messages[i]!.role, content: messages[i]!.content });
    }

    return {
      messagesToSend,
      messagesToCompact: messages.slice(0, cutoff),
      usedTokens: budgetTokens - remaining,
    };
  }

  /**
   * Check whether there are enough overflow messages worth compacting.
   */
  shouldCompact(overflowCount: number): boolean {
    return overflowCount >= this.minCompactMessages;
  }

  /** Token budget available for conversation messages (total minus reserved for system/summary/memories) */
  get messageBudget(): number {
    return this.tokenBudget - this.reservedTokens;
  }

  async compact(
    sessionId: string,
    llmClient: LlmClient,
    model: string,
    overflowMessages?: Array<{ id: string; role: string; content: string; createdAt: string }>,
  ): Promise<CompactionResult> {
    const toCompress = overflowMessages ?? this.db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.compacted, 0),
        ),
      )
      .orderBy(asc(chatMessages.createdAt))
      .all();

    if (toCompress.length < this.minCompactMessages) {
      throw new Error("Not enough messages to compact");
    }

    const conversationText = toCompress
      .map((m) => `[${m.role}] ${m.content}`)
      .join("\n\n");

    const response = await llmClient.chat.completions.create({
      model,
      max_tokens: 2048,
      messages: [
        { role: "system", content: COMPACTION_PROMPT },
        { role: "user", content: conversationText },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; memories?: ExtractedMemory[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw, memories: [] };
    }

    const summaryText = parsed.summary ?? raw;
    const extractedMemories = (parsed.memories ?? []).filter(
      (m) => m.kind && m.content,
    );

    const cutoffTime = toCompress[toCompress.length - 1]!.createdAt;
    const now = new Date().toISOString();

    const summaryRecord: CompactionSummary = {
      id: uuid(),
      sessionId,
      summary: summaryText,
      compressedBefore: cutoffTime,
      messageCount: toCompress.length,
      createdAt: now,
    };

    this.db.insert(compactionSummaries).values(summaryRecord).run();

    const compressedIds = toCompress.map((m) => m.id);
    for (const id of compressedIds) {
      this.db
        .update(chatMessages)
        .set({ compacted: 1 })
        .where(eq(chatMessages.id, id))
        .run();
    }

    return { summary: summaryRecord, extractedMemories };
  }

  async getLatestSummary(sessionId: string): Promise<string | null> {
    const row = this.db
      .select()
      .from(compactionSummaries)
      .where(eq(compactionSummaries.sessionId, sessionId))
      .orderBy(desc(compactionSummaries.createdAt))
      .limit(1)
      .get();
    return row?.summary ?? null;
  }

  async getAllSummaries(sessionId: string): Promise<CompactionSummary[]> {
    return this.db
      .select()
      .from(compactionSummaries)
      .where(eq(compactionSummaries.sessionId, sessionId))
      .orderBy(asc(compactionSummaries.createdAt))
      .all();
  }
}
