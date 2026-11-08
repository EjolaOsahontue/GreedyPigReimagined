import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool } from "./db.js";
import { handleError } from "./errors.js";
import gamesRouter from "./routes/games.js";
import leaderboardRouter from "./routes/leaderboard.js";
import playersRouter from "./routes/players.js";

const app = express();

const allowed = (process.env.FRONTEND_URL || "").split(",");
app.use(cors({ origin: allowed }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW() AS time");
    res.json({ status: "ok", dbTime: rows[0].time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

app.use("/api/v1/games", gamesRouter);
app.use("/api/v1/leaderboard", leaderboardRouter);
app.use("/api/v1/players", playersRouter);
// Anything not matched above
app.use((req, res) => res.status(404).json({ error: "Route not found" }));



app.use(handleError); 



app.listen(process.env.PORT || 3000, () =>
  console.log("API running on port", process.env.PORT || 3000)
);