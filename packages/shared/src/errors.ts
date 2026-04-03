export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STORAGE"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static validation(message: string, details?: unknown) {
    return new AppError("VALIDATION", message, details);
  }

  static notFound(entity: string, id: string) {
    return new AppError("NOT_FOUND", `${entity} not found: ${id}`);
  }

  static conflict(message: string) {
    return new AppError("CONFLICT", message);
  }

  static storage(message: string, cause?: unknown) {
    return new AppError("STORAGE", message, cause);
  }
}
