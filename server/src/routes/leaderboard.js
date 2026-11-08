import { Router } from "express";
import { getLeaderboard } from "../statsService.js";
import { parseLimit } from "../statsService.js";

const router = Router();

router.get("/", async (req, res) => {    
    const leaderboard = await getLeaderboard({limit: parseLimit(req.query.limit)});
    res.json({ leaderboard });
});

export default router;