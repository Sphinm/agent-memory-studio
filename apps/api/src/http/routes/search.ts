import { Router } from "express";
import type { MemoryService } from "@agent-memory-studio/memory-core";

export function searchRoutes(memoryService: MemoryService): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "");
      if (!q) {
        res.json([]);
        return;
      }
      const results = await memoryService.search(q, {
        sessionId: req.query.sessionId as string | undefined,
        limit: Number(req.query.limit ?? 50),
      });
      res.json(results);
    } catch (e) { next(e); }
  });

  return router;
}
