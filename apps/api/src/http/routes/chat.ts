import { Router } from "express";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import OpenAI, { toFile } from "openai";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multer = require("multer") as any;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});
import type {
  ChatService,
  MemoryService,
  SessionService,
  CompactionService
} from "@agent-memory-studio/memory-core";
import type { WsHub } from "../../ws/hub.js";

const SYSTEM_PROMPT = `You are a helpful AI assistant running inside Agent Memory Studio.
You have access to the current session's working memory — facts, goals, constraints, and summaries that have been recorded.
Use this context to give informed, relevant answers.

When the user shares important information (decisions, facts, constraints, goals), note it in your response so the system can record it as a memory.

Keep your responses concise and helpful. Answer in the same language the user uses.`;

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
}

function parseModels(): ModelConfig[] {
  const raw = process.env.LLM_MODELS;
  if (!raw) {
    return [
      { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
      { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet",
        provider: "anthropic"
      }
    ];
  }
  // format: "model_id:Display Name:provider, ..."
  return raw.split(",").map((s) => {
    const parts = s.trim().split(":");
    return {
      id: parts[0]!.trim(),
      name: parts[1]?.trim() || parts[0]!.trim(),
      provider: parts[2]?.trim() || "openai"
    };
  });
}

function buildContextBlock(
  memories: { kind: string; content: string; title?: string | null }[]
): string {
  if (memories.length === 0) return "";
  const lines = memories.map(
    (m) => `- [${m.kind}] ${m.title ? m.title + ": " : ""}${m.content}`
  );
  return `\n\n<session_memory>\n${lines.join("\n")}\n</session_memory>`;
}

function createClient(): OpenAI {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY;
  const baseURL =
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1";

  if (!apiKey || /^sk-1234/.test(apiKey)) {
    throw new ConfigError(
      "No LLM API key configured. Set one of: LLM_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY"
    );
  }

  return new OpenAI({ apiKey, baseURL });
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function chatRoutes(
  chatService: ChatService,
  memoryService: MemoryService,
  sessionService: SessionService,
  compactionService: CompactionService,
  wsHub: WsHub
): Router {
  const router = Router();
  const models = parseModels();

  router.get("/models", (_req, res) => {
    const defaultModel =
      process.env.LLM_DEFAULT_MODEL || models[0]?.id || "gpt-4o";
    res.json({ models, defaultModel });
  });

  router.get("/:sessionId/messages", async (req, res, next) => {
    try {
      const messages = await chatService.getHistory(req.params.sessionId!);
      res.json(messages);
    } catch (e) {
      next(e);
    }
  });

  router.post("/:sessionId/send", async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      const { message, model: requestedModel } = req.body as {
        message: string;
        model?: string;
      };

      if (!message?.trim()) {
        res
          .status(400)
          .json({ error: "VALIDATION", message: "message is required" });
        return;
      }

      let client: OpenAI;
      try {
        client = createClient();
      } catch (e) {
        if (e instanceof ConfigError) {
          res.status(500).json({ error: "CONFIG", message: e.message });
          return;
        }
        throw e;
      }

      const modelId =
        requestedModel ||
        process.env.LLM_DEFAULT_MODEL ||
        models[0]?.id ||
        "gpt-4o";

      await sessionService.getById(sessionId!);

      const userMsg = await chatService.addMessage(
        sessionId!,
        "user",
        message.trim()
      );
      wsHub.broadcast(sessionId!, "chat.message", userMsg);

      const [compactionSummary, allUncompacted, memories] = await Promise.all([
        compactionService.getLatestSummary(sessionId!),
        chatService.getRecentUncompacted(sessionId!, 200),
        memoryService.listBySession(sessionId!, { status: "active", limit: 20 })
      ]);

      const contextBlock = buildContextBlock(memories);
      const summaryBlock = compactionSummary
        ? `\n\n<conversation_summary>\n${compactionSummary}\n</conversation_summary>`
        : "";
      const systemPrompt = SYSTEM_PROMPT + summaryBlock + contextBlock;

      // Token-budgeted sliding window: fill from newest to oldest
      const chatOnly = allUncompacted.filter(
        (m) => m.role === "user" || m.role === "assistant"
      );
      const windowInput = chatOnly.map((m) => ({
        id: (m as unknown as { id: string }).id ?? "",
        role: m.role,
        content: m.content,
        createdAt: m.createdAt
      }));
      const window = compactionService.buildWindow(
        windowInput,
        compactionService.messageBudget
      );

      const llmMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...window.messagesToSend.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }))
      ];

      let assistantContent: string;
      try {
        const response = await client.chat.completions.create({
          model: modelId,
          max_tokens: 2048,
          messages: llmMessages
        });

        assistantContent =
          response.choices[0]?.message?.content ?? "(no response)";
      } catch (llmErr: unknown) {
        const msg =
          llmErr instanceof Error ? llmErr.message : "Unknown LLM error";
        console.error(`LLM error (model=${modelId}):`, msg);
        res.status(502).json({
          error: "LLM_ERROR",
          message: `LLM error (${modelId}): ${msg}`
        });
        return;
      }

      const assistantMsg = await chatService.addMessage(
        sessionId!,
        "assistant",
        assistantContent
      );
      wsHub.broadcast(sessionId!, "chat.message", assistantMsg);

      res.json({ ...assistantMsg, model: modelId });

      // Async compaction: compress messages that fell outside the window
      if (compactionService.shouldCompact(window.messagesToCompact.length)) {
        setImmediate(async () => {
          try {
            const compactModel = process.env.COMPACT_MODEL || modelId;
            const result = await compactionService.compact(
              sessionId!,
              client as never,
              compactModel,
              window.messagesToCompact
            );

            const session = await sessionService.getById(sessionId!);
            const agentId = session.primaryAgentId ?? "system";
            for (const mem of result.extractedMemories) {
              try {
                await memoryService.create({
                  sessionId: sessionId!,
                  agentId,
                  kind: mem.kind,
                  status: "active",
                  title: mem.title ?? null,
                  content: mem.content,
                  tags: ["auto-extracted"],
                  structured: null,
                  parentMemoryId: null,
                  supersedesId: null
                });
              } catch (memErr) {
                console.error("Failed to persist extracted memory:", memErr);
              }
            }

            console.log(
              `Compacted session ${sessionId}: ${result.summary.messageCount} messages → summary + ${result.extractedMemories.length} memories`
            );
            wsHub.broadcast(sessionId!, "compaction.done", {
              messageCount: result.summary.messageCount,
              memoriesExtracted: result.extractedMemories.length
            });
          } catch (err) {
            console.error("Compaction failed:", err);
          }
        });
      }
    } catch (e) {
      next(e);
    }
  });

  router.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
      const file = (
        req as unknown as { file?: { buffer: Buffer; mimetype: string } }
      ).file;
      if (!file) {
        res
          .status(400)
          .json({ error: "VALIDATION", message: "audio file is required" });
        return;
      }

      let client: OpenAI;
      try {
        client = createClient();
      } catch (e) {
        if (e instanceof ConfigError) {
          res.status(500).json({ error: "CONFIG", message: e.message });
          return;
        }
        throw e;
      }

      const whisperModel = process.env.WHISPER_MODEL || "whisper-1";
      const audioFile = await toFile(
        Readable.from(file.buffer),
        "recording.webm",
        {
          type: file.mimetype
        }
      );

      const transcription = await client.audio.transcriptions.create({
        model: whisperModel,
        file: audioFile
      });

      res.json({ text: transcription.text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed";
      console.error("Whisper error:", msg);
      res.status(502).json({ error: "TRANSCRIPTION_ERROR", message: msg });
    }
  });

  return router;
}
