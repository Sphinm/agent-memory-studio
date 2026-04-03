import type { ErrorRequestHandler } from "express";
import { AppError } from "@agent-memory-studio/shared";

const STATUS_MAP: Record<string, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STORAGE: 500,
  INTERNAL: 500,
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const status = STATUS_MAP[err.code] ?? 500;
    res.status(status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error("Unhandled error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: "INTERNAL", message });
};
