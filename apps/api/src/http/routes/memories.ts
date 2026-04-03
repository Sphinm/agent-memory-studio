import { Router } from "express";
import type { MemoryService } from "@agent-memory-studio/memory-core";
import type { WsHub } from "../../ws/hub.js";
import {
  createMemorySchema,
  updateMemorySchema,
  WS_EVENTS,
} from "@agent-memory-studio/shared";
import { validateBody } from "../middleware/validate.js";

export function memoryRoutes(memoryService: MemoryService, wsHub: WsHub): Router {
  const router = Router();

  router.post("/", validateBody(createMemorySchema), async (req, res, next) => {
    try {
      const memory = await memoryService.create(req.body);
      wsHub.broadcast(memory.sessionId, WS_EVENTS.MEMORY_CREATED, memory);
      res.status(201).json(memory);
    } catch (e) { next(e); }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const memory = await memoryService.getById(req.params.id!);
      res.json(memory);
    } catch (e) { next(e); }
  });

  router.patch("/:id", validateBody(updateMemorySchema), async (req, res, next) => {
    try {
      const memory = await memoryService.update(req.params.id!, req.body);
      wsHub.broadcast(memory.sessionId, WS_EVENTS.MEMORY_UPDATED, memory);
      res.json(memory);
    } catch (e) { next(e); }
  });

  router.post("/:id/archive", async (req, res, next) => {
    try {
      const memory = await memoryService.archive(req.params.id!);
      wsHub.broadcast(memory.sessionId, WS_EVENTS.MEMORY_ARCHIVED, memory);
      res.json(memory);
    } catch (e) { next(e); }
  });

  router.get("/:id/versions", async (req, res, next) => {
    try {
      const versions = await memoryService.getVersions(req.params.id!);
      res.json(versions);
    } catch (e) { next(e); }
  });

  return router;
}
