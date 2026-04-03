import { Router } from "express";
import type { AgentService } from "@agent-memory-studio/memory-core";
import { createAgentSchema, updateAgentSchema } from "@agent-memory-studio/shared";
import { validateBody } from "../middleware/validate.js";

export function agentRoutes(agentService: AgentService): Router {
  const router = Router();

  router.post("/", validateBody(createAgentSchema), async (req, res, next) => {
    try {
      const agent = await agentService.create(req.body);
      res.status(201).json(agent);
    } catch (e) { next(e); }
  });

  router.get("/", async (_req, res, next) => {
    try {
      const list = await agentService.list();
      res.json(list);
    } catch (e) { next(e); }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const agent = await agentService.getById(req.params.id!);
      res.json(agent);
    } catch (e) { next(e); }
  });

  router.patch("/:id", validateBody(updateAgentSchema), async (req, res, next) => {
    try {
      const agent = await agentService.update(req.params.id!, req.body);
      res.json(agent);
    } catch (e) { next(e); }
  });

  return router;
}
