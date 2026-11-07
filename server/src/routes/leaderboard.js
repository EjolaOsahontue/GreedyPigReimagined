import { Router } from "express";
import { getLeaderboard } from "../statsService.js";

const router = Router();

router.get("/", async (req, res) => {
    const leaderboard = await getLeaderboard();
    res.json({ leaderboard });
});

export default router;