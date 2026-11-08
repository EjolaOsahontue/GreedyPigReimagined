import { Router } from "express";
import { getLeaderboard } from "../statsService.js";
import { parseLimit } from "../statsService.js";

const router = Router();

router.get("/", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
});

export default router;