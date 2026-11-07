import { Router } from "express";
import { getLeaderboard } from "../statsService.js";
import { parseLimit } from "../statsService.js";

const router = Router();

router.get("/", async (req, res) => {
    // Extract the limit from query params, defaulting to 10 if not provided
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    
    const leaderboard = await getLeaderboard(limit);
    res.json({ leaderboard });
});

export default router;