import http from "node:http";
import cors from "cors";
import express from "express";
import { createConnection, AgentService, SessionService, MemoryService, ChatService, CompactionService } from "@agent-memory-studio/memory-core";
import { API_PREFIX, DEFAULTS } from "@agent-memory-studio/shared";
import { healthRoutes } from "./http/routes/health.js";
import { agentRoutes } from "./http/routes/agents.js";
import { sessionRoutes } from "./http/routes/sessions.js";
import { memoryRoutes } from "./http/routes/memories.js";
import { searchRoutes } from "./http/routes/search.js";
import { chatRoutes } from "./http/routes/chat.js";
import { errorHandler } from "./http/middleware/error-handler.js";
import { WsHub } from "./ws/hub.js";

const port = Number(process.env.PORT ?? DEFAULTS.API_PORT);
const dbPath = process.env.DB_PATH ?? "data/studio.db";

const db = createConnection(dbPath);
const agentService = new AgentService(db);
const sessionService = new SessionService(db);
const memoryService = new MemoryService(db);
const chatService = new ChatService(db);
const compactionService = new CompactionService(db, {
  tokenBudget: Number(process.env.CONTEXT_TOKEN_BUDGET ?? 6000),
  reservedTokens: Number(process.env.CONTEXT_RESERVED_TOKENS ?? 2000),
  minCompactMessages: Number(process.env.COMPACT_MIN_MESSAGES ?? 4),
});
const wsHub = new WsHub();

const app = express();
app.use(cors());
app.use(express.json());

app.use(healthRoutes());
app.use(`${API_PREFIX}/agents`, agentRoutes(agentService));
app.use(`${API_PREFIX}/sessions`, sessionRoutes(sessionService, memoryService));
app.use(`${API_PREFIX}/memories`, memoryRoutes(memoryService, wsHub));
app.use(`${API_PREFIX}/search`, searchRoutes(memoryService));
app.use(`${API_PREFIX}/chat`, chatRoutes(chatService, memoryService, sessionService, compactionService, wsHub));
app.use(errorHandler);

const server = http.createServer(app);
wsHub.attach(server);

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`WebSocket available at ws://localhost:${port}/ws`);
});
