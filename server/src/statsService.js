import { pool } from "./db.js";

export async function getLeaderboard() {
const leader = `
  SELECT lower(trim(display_name)) AS name,
         COUNT(*) AS games_played,
         COUNT(*) FILTER (WHERE is_winner) AS wins,
         ROUND(100.0 * COUNT(*) FILTER (WHERE is_winner) / COUNT(*)) AS win_rate
  FROM results
  WHERE trim(display_name) <> ''
  GROUP BY lower(trim(display_name))
  ORDER BY wins DESC, win_rate DESC, games_played ASC, name ASC`;  const { rows } = await pool.query(leader);
  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    games_played: Number(row.games_played),
    wins: Number(row.wins),
    win_rate: Number(row.win_rate),
  }));
}