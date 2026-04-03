import { z } from "zod";

export const sessionStatusSchema = z.enum(["open", "closed"]);

export const createSessionSchema = z.object({
  title: z.string().nullish(),
  primaryAgentId: z.string().uuid().nullish(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateSessionSchema = z.object({
  title: z.string().nullish(),
  status: sessionStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const sessionQuerySchema = z.object({
  status: sessionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
