import { Router } from "express";
import { withTransaction } from "../db.js";
import { createGameSchema, parse } from "../schemas.js";
import * as games from "../gameService.js";
import { AppError } from "../errors.js";
import { ca } from "zod/v4/locales";

const router = Router();

function rejectBody(req, res, next) {
    if (req.body && Object.keys(req.body).length > 0) {
        return next(new AppError(400, "VALIDATION_ERROR", "The server decides the dice and the score. Do not send them."));
    }
    next();

}

router.post("/:id/roll", rejectBody, async (req, res) => {
    res.json(await withTransaction((tx) => games.roll(tx, req.params.id)));
});

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