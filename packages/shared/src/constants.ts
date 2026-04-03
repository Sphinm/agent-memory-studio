export const API_VERSION = "v1" as const;
export const API_PREFIX = `/api/${API_VERSION}` as const;

export const WS_EVENTS = {
  MEMORY_CREATED: "memory.created",
  MEMORY_UPDATED: "memory.updated",
  MEMORY_ARCHIVED: "memory.archived",
  MEMORY_DELETED: "memory.deleted",
  SESSION_UPDATED: "session.updated",
  TOOL_STARTED: "tool.started",
  TOOL_FINISHED: "tool.finished",
} as const;

export const DEFAULTS = {
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  API_PORT: 4000,
  WEB_PORT: 3000,
} as const;
