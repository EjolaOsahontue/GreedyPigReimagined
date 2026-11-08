import { Router } from "express";
import { getPlayerStats, getPlayerHistory, parseLimit } from "../statsService.js";

const router = Router();

router.get("/:name/stats", async (req, res) => {
  res.json({ player: await getPlayerStats(req.params.name) })
});

router.get("/:name/history", async (req, res) => {
  res.json({ history: await getPlayerHistory(req.params.name, { limit: parseLimit(req.query.limit) }) });
});

export default router;