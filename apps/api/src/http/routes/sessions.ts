import { Router } from "express";
import type { SessionService } from "@agent-memory-studio/memory-core";
import type { MemoryService } from "@agent-memory-studio/memory-core";
import {
  createSessionSchema,
  updateSessionSchema,
  sessionQuerySchema,
  memoryQuerySchema,
} from "@agent-memory-studio/shared";
import { validateBody, validateQuery } from "../middleware/validate.js";

export function sessionRoutes(
  sessionService: SessionService,
  memoryService: MemoryService,
): Router {
  const router = Router();

  router.post("/", validateBody(createSessionSchema), async (req, res, next) => {
    try {
      const session = await sessionService.create(req.body);
      res.status(201).json(session);
    } catch (e) { next(e); }
  });

  router.get("/", validateQuery(sessionQuerySchema), async (req, res, next) => {
    try {
      const list = await sessionService.list({
        status: req.query.status as string | undefined,
        limit: Number(req.query.limit ?? 20),
      });
      res.json(list);
    } catch (e) { next(e); }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const session = await sessionService.getById(req.params.id!);
      res.json(session);
    } catch (e) { next(e); }
  });

  router.patch("/:id", validateBody(updateSessionSchema), async (req, res, next) => {
    try {
      const session = await sessionService.update(req.params.id!, req.body);
      res.json(session);
    } catch (e) { next(e); }
  });

  router.get("/:id/memories", validateQuery(memoryQuerySchema), async (req, res, next) => {
    try {
      const list = await memoryService.listBySession(req.params.id!, {
        kind: req.query.kind as string | undefined,
        status: req.query.status as string | undefined,
        limit: Number(req.query.limit ?? 50),
      });
      res.json(list);
    } catch (e) { next(e); }
  });

  return router;
}
