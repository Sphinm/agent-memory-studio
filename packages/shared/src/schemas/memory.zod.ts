import { z } from "zod";

export const memorySummaryPayloadSchema = z.object({
  goal: z.string().min(1),
  confirmedSlots: z.record(z.union([z.string(), z.number(), z.boolean()])),
  pendingSlots: z.array(z.string()),
  actionsDone: z.array(z.string()),
  constraints: z.array(z.string()),
});

export const memoryKindSchema = z.enum([
  "summary", "fact", "hypothesis", "constraint", "goal", "note",
]);

export const memoryStatusSchema = z.enum([
  "draft", "active", "archived", "deleted",
]);

export const createMemorySchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  kind: memoryKindSchema,
  status: memoryStatusSchema.default("active"),
  parentMemoryId: z.string().uuid().nullish(),
  supersedesId: z.string().uuid().nullish(),
  title: z.string().nullish(),
  content: z.string().min(1),
  structured: memorySummaryPayloadSchema.nullish(),
  tags: z.array(z.string()).default([]),
});

export const updateMemorySchema = z.object({
  title: z.string().nullish(),
  content: z.string().min(1).optional(),
  structured: memorySummaryPayloadSchema.nullish(),
  tags: z.array(z.string()).optional(),
  status: memoryStatusSchema.optional(),
  parentMemoryId: z.string().uuid().nullish(),
  changeReason: z.string().optional(),
});

export const memoryQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  kind: memoryKindSchema.optional(),
  status: memoryStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
