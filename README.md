# Agent Memory Studio

AI Agent 的运行时记忆引擎 — 为对话式 AI 提供会话压缩、短期/长期记忆管理和结构化记忆提取。

## 架构概览

```
agent-memory-studio/
├── apps/
│   ├── api/          # Express + WebSocket 后端
│   └── web/          # Next.js 前端
└── packages/
    ├── shared/       # 领域类型、Zod schema、常量
    └── memory-core/  # SQLite 持久化 + 业务逻辑
```

### 核心能力

- **会话管理** — 创建/管理多个 Agent Session，每个 session 拥有独立的记忆空间
- **Token 预算式滑动窗口** — 按 token 预算从新到旧填充消息，超出窗口的自动异步压缩
- **自动记忆提取** — 压缩时 LLM 一次性输出摘要 + 结构化记忆（fact / goal / constraint / note）
- **长期记忆** — 提取的记忆持久化到 `memories` 表，跨对话轮次可检索
- **多模型支持** — 通过 OpenAI SDK + LiteLLM 代理接入 GPT-4o / DeepSeek / Claude 等
- **实时语音输入** — Web Speech API 实时转写 + Whisper API 回退
- **WebSocket 实时推送** — 消息、记忆更新、压缩事件实时广播

## 技术栈

| 层级   | 技术                                    |
| ------ | --------------------------------------- |
| 前端   | Next.js 15, React 19, TypeScript        |
| 后端   | Express, WebSocket (`ws`), OpenAI SDK   |
| 数据层 | SQLite (`better-sqlite3`) + Drizzle ORM |
| 验证   | Zod                                     |
| 包管理 | pnpm workspaces                         |

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
# 编辑 apps/api/.env，填入 LLM_API_KEY 和 LLM_BASE_URL

# 3. 启动开发服务器
pnpm dev
```

启动后：

- 前端: http://localhost:3000
- API: http://localhost:4000
- WebSocket: ws://localhost:4000/ws

## 环境变量

在 `apps/api/.env` 中配置：

```bash
# 基础配置
PORT=4000
DB_PATH=data/studio.db

# LLM 配置（必填）
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_DEFAULT_MODEL=gpt-4o

# 上下文窗口与压缩
CONTEXT_TOKEN_BUDGET=6000       # 总 token 预算
CONTEXT_RESERVED_TOKENS=2000     # system prompt / 摘要 / memories 保留
COMPACT_MIN_MESSAGES=4           # 最少溢出消息数触发压缩
COMPACT_MODEL=gpt-4o-mini        # 压缩用模型（推荐用便宜的）

# 自定义模型列表（可选）
# LLM_MODELS=gpt-4o:GPT-4o:openai,deepseek-chat:DeepSeek:deepseek
```

## 记忆系统设计

```
用户发送消息
     │
     ▼
构建 Prompt（token 预算式滑动窗口）
  ┌─ system prompt
  ├─ <conversation_summary> 压缩摘要
  ├─ <session_memory> 长期记忆
  └─ 最近 N 条消息（在预算内从新到旧填充）
     │
     ▼
LLM 生成回复 → 返回用户
     │
     ▼
异步检查：窗口外溢出消息 ≥ 4 条？
  ├─ 否 → 结束
  └─ 是 → 调用 LLM 压缩
       ├─ 生成摘要 → compaction_summaries 表
       ├─ 提取记忆 → memories 表 (tag: auto-extracted)
       └─ 标记旧消息 compacted=1
```

### 数据模型

| 表                     | 用途                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `agents`               | Agent 身份信息                                              |
| `sessions`             | 会话（open / closed）                                       |
| `chat_messages`        | 原始聊天记录（含 `compacted` 标记）                         |
| `compaction_summaries` | 压缩摘要                                                    |
| `memories`             | 结构化长期记忆（fact / goal / constraint / note / summary） |
| `memory_versions`      | 记忆版本追踪                                                |
| `tool_invocations`     | 工具调用记录                                                |

## API 端点

| 方法 | 路径                               | 说明         |
| ---- | ---------------------------------- | ------------ |
| GET  | `/api/v1/chat/models`              | 可用模型列表 |
| GET  | `/api/v1/chat/:sessionId/messages` | 获取聊天历史 |
| POST | `/api/v1/chat/:sessionId/send`     | 发送消息     |
| POST | `/api/v1/chat/transcribe`          | 语音转文字   |
| CRUD | `/api/v1/agents`                   | Agent 管理   |
| CRUD | `/api/v1/sessions`                 | Session 管理 |
| CRUD | `/api/v1/memories`                 | Memory 管理  |
| GET  | `/api/v1/search?q=...`             | 记忆搜索     |

## 开发

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 仅启动后端
pnpm --filter @agent-memory-studio/api dev

# 仅启动前端
pnpm --filter @agent-memory-studio/web dev
```
