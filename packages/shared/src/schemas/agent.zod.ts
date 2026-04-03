import { z } from "zod";

export const agentKindSchema = z.enum(["human", "bot", "orchestrator", "subagent"]);

export const agentCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const createAgentSchema = z.object({
  externalId: z.string().nullish(),
  kind: agentKindSchema,
  displayName: z.string().min(1),
  capabilities: z.array(agentCapabilitySchema).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateAgentSchema = z.object({
  displayName: z.string().min(1).optional(),
  kind: agentKindSchema.optional(),
  capabilities: z.array(agentCapabilitySchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});
