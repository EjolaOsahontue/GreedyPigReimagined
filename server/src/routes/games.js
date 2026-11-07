import { Router } from "express";
import { withTransaction } from "../db.js";
import { createGameSchema, parse } from "../schemas.js";
import * as games from "../gameService.js";

const router = Router();

router.post("/", async (req, res) => {
  const { players, target_score } = parse(createGameSchema, req.body);
  const game = await withTransaction((tx) => games.createGame(tx, { players, target_score }));
  res.status(201).json({ game });
});

router.get("/:id", async (req, res) => {
  const game = await withTransaction((tx) => games.getGame(tx, req.params.id));
  res.json({ game });
});

export default router;