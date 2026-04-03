# API 参考

Base URL: `http://localhost:4000`

所有 REST 端点前缀：`/api/v1`

## 健康检查

### GET /health

```json
// Response 200
{ "status": "ok", "service": "agent-memory-studio-api" }
```

---

## Agent 管理

### POST /api/v1/agents

创建 Agent。

```json
// Request
{
  "kind": "bot",              // "human" | "bot" | "orchestrator" | "subagent"
  "displayName": "My Bot",
  "externalId": "ext-123",    // 可选，唯一
  "capabilities": [           // 可选
    { "name": "code-review", "description": "Review code quality" }
  ],
  "metadata": {}              // 可选
}

// Response 201
{
  "id": "uuid",
  "externalId": "ext-123",
  "kind": "bot",
  "displayName": "My Bot",
  "capabilities": [...],
  "metadata": {},
  "createdAt": "2026-04-03T...",
  "updatedAt": "2026-04-03T..."
}
```

### GET /api/v1/agents

返回所有 Agent。

### GET /api/v1/agents/:id

返回单个 Agent。

### PATCH /api/v1/agents/:id

更新 Agent。可选字段：`displayName`, `kind`, `capabilities`, `metadata`。

---

## Session 管理

### POST /api/v1/sessions

创建 Session。

```json
// Request
{
  "title": "Debug Session",        // 可选
  "primaryAgentId": "agent-uuid",  // 可选
  "metadata": {}                   // 可选
}

// Response 201
{
  "id": "uuid",
  "title": "Debug Session",
  "status": "open",
  "primaryAgentId": "agent-uuid",
  "startedAt": "2026-04-03T...",
  "endedAt": null,
  "metadata": {}
}
```

### GET /api/v1/sessions

列出 Session。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| `status` | string | — | 过滤：`open` / `closed` |
| `limit` | number | 20 | 1-100 |

### GET /api/v1/sessions/:id

返回单个 Session。

### PATCH /api/v1/sessions/:id

更新 Session。可选字段：`title`, `status`, `metadata`。设置 `status: "closed"` 会自动填充 `endedAt`。

### GET /api/v1/sessions/:id/memories

返回该 Session 下的记忆列表。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| `kind` | string | — | 过滤记忆类型 |
| `status` | string | — | 过滤状态 |
| `limit` | number | 50 | 1-200 |

---

## Memory 管理

### POST /api/v1/memories

创建记忆。

```json
// Request
{
  "sessionId": "session-uuid",
  "agentId": "agent-uuid",
  "kind": "fact",                  // "summary" | "fact" | "hypothesis" | "constraint" | "goal" | "note"
  "content": "用户使用 TypeScript",
  "title": "技术栈",               // 可选
  "status": "active",             // 可选，默认 "active"
  "tags": ["tech"],               // 可选
  "structured": null,             // 可选，MemorySummaryPayload
  "parentMemoryId": null,         // 可选
  "supersedesId": null            // 可选
}

// Response 201
{
  "id": "uuid",
  "sessionId": "...",
  "agentId": "...",
  "kind": "fact",
  "status": "active",
  "title": "技术栈",
  "content": "用户使用 TypeScript",
  "tags": ["tech"],
  "structured": null,
  "parentMemoryId": null,
  "supersedesId": null,
  "createdAt": "...",
  "updatedAt": "...",
  "archivedAt": null
}
```

触发 WebSocket 事件：`memory.created`

### GET /api/v1/memories/:id

返回单个记忆。

### PATCH /api/v1/memories/:id

更新记忆。可选字段：`title`, `content`, `structured`, `tags`, `status`, `parentMemoryId`, `changeReason`。

每次更新自动在 `memory_versions` 中创建新版本快照。

触发 WebSocket 事件：`memory.updated`

### POST /api/v1/memories/:id/archive

归档记忆（设置 `status: "archived"`）。

触发 WebSocket 事件：`memory.archived`

### GET /api/v1/memories/:id/versions

返回记忆的版本历史，按版本号降序。

```json
// Response 200
[
  {
    "id": "version-uuid",
    "memoryId": "memory-uuid",
    "version": 2,
    "snapshot": { /* 完整 MemoryEntry 快照 */ },
    "authorAgentId": "agent-uuid",
    "createdAt": "...",
    "changeReason": "用户修正"
  }
]
```

---

## 搜索

### GET /api/v1/search

全文搜索记忆（LIKE 匹配 `content` 和 `title`）。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索关键词 |
| `sessionId` | string | 否 | 限定 Session |
| `limit` | number | 否 | 默认 50 |

```json
// Response 200
[ /* MemoryEntry[] */ ]
```

---

## 聊天

### GET /api/v1/chat/models

返回可用模型列表。

```json
// Response 200
{
  "models": [
    { "id": "gpt-4o", "name": "GPT-4o", "provider": "openai" },
    { "id": "deepseek-chat", "name": "DeepSeek Chat", "provider": "deepseek" }
  ],
  "defaultModel": "gpt-4o"
}
```

通过 `LLM_MODELS` 环境变量自定义，格式：`model_id:Display Name:provider, ...`

### GET /api/v1/chat/:sessionId/messages

返回完整聊天历史（包括已压缩的消息）。

### POST /api/v1/chat/:sessionId/send

发送消息并获取 AI 回复。

```json
// Request
{
  "message": "你好，帮我看看这段代码",
  "model": "gpt-4o"        // 可选，覆盖默认模型
}

// Response 200
{
  "id": "msg-uuid",
  "sessionId": "...",
  "role": "assistant",
  "content": "你好！请把代码发给我...",
  "createdAt": "...",
  "model": "gpt-4o"
}
```

触发 WebSocket 事件：`chat.message`（用户消息 + 助手回复各一次）

**内部流程**：
1. 存储用户消息
2. 查询压缩摘要 + 未压缩消息 + active memories
3. Token 预算滑动窗口构建 prompt
4. 调用 LLM
5. 存储并返回助手回复
6. 异步检查并执行压缩

**错误响应**：

| 状态码 | error | 场景 |
|--------|-------|------|
| 400 | `VALIDATION` | 消息为空 |
| 500 | `CONFIG` | API key 未配置 |
| 502 | `LLM_ERROR` | LLM 调用失败 |

### POST /api/v1/chat/transcribe

语音转文字（Whisper API）。

```
Content-Type: multipart/form-data
字段: audio (文件)
```

```json
// Response 200
{ "text": "转写的文字内容" }
```

**错误响应**：

| 状态码 | error | 场景 |
|--------|-------|------|
| 400 | `VALIDATION` | 缺少音频文件 |
| 500 | `CONFIG` | API key 未配置 |
| 502 | `TRANSCRIPTION_ERROR` | Whisper 调用失败 |

---

## WebSocket

### 连接

```
ws://localhost:4000/ws?sessionId=xxx
```

连接时如果提供 `sessionId`，自动订阅该 Session 的事件。

### 消息格式

**服务端 → 客户端**

```json
// 连接确认
{ "type": "connected" }

// 事件广播
{
  "event": "chat.message",
  "sessionId": "xxx",
  "data": { /* 事件数据 */ },
  "ts": "2026-04-03T12:00:00.000Z"
}
```

**客户端 → 服务端**

```json
// 订阅
{ "type": "subscribe", "sessionId": "xxx" }

// 取消订阅
{ "type": "unsubscribe", "sessionId": "xxx" }
```

### 事件列表

| 事件 | data 类型 | 触发端点 |
|------|----------|---------|
| `memory.created` | `MemoryEntry` | POST /memories |
| `memory.updated` | `MemoryEntry` | PATCH /memories/:id |
| `memory.archived` | `MemoryEntry` | POST /memories/:id/archive |
| `chat.message` | `ChatMessage` | POST /chat/:sid/send |
| `compaction.done` | `{ messageCount, memoriesExtracted }` | 异步压缩完成 |

---

## 错误格式

所有错误响应统一格式：

```json
{
  "error": "ERROR_CODE",
  "message": "人类可读的错误描述"
}
```

| HTTP 状态码 | 对应 ErrorCode | 场景 |
|------------|---------------|------|
| 400 | `VALIDATION` | 请求参数验证失败 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突 |
| 500 | `STORAGE` / `INTERNAL` | 服务端内部错误 |
| 502 | `LLM_ERROR` | LLM 调用失败 |
