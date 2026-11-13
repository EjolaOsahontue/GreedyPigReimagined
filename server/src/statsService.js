import { pool } from "./db.js";
import { playerNotFound } from "./errors.js";

export function parseLimit(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 50) {
    return n;
  }
  return 10;
}

export async function getLeaderboard({ limit = 10 } = {}) {
  const query = `
    SELECT 
      (array_agg(display_name ORDER BY created_at DESC))[1] AS name,
      COUNT(*) AS games_played,
      COUNT(*) FILTER (WHERE is_winner) AS wins,
      ROUND(100.0 * COUNT(*) FILTER (WHERE is_winner) / COUNT(*)) AS win_rate
    FROM results
    WHERE trim(display_name) <> ''
    GROUP BY lower(trim(display_name))
    ORDER BY wins DESC, win_rate DESC, games_played ASC, lower(trim(display_name))
    LIMIT $1;
  `;

  const { rows } = await pool.query(query, [limit]);

  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    games_played: Number(row.games_played),
    wins: Number(row.wins),
    win_rate: Number(row.win_rate)
  }));
}

function normalizeName(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (normalized === '' || normalized.length > 20) {
    throw playerNotFound();
  }
  return normalized;
}

export async function getPlayerStats(name) {
  const key = normalizeName(name);

  const stats = `
    SELECT
      (array_agg(display_name ORDER BY created_at DESC))[1] AS name,
      COUNT(*) AS games_played,
      COUNT(*) FILTER (WHERE is_winner) AS wins,
      ROUND(100.0 * COUNT(*) FILTER (WHERE is_winner) / NULLIF(COUNT(*), 0)) AS win_rate,
      MAX(final_score) AS best_score,
      MAX(created_at) AS last_played_at
    FROM results
    WHERE lower(trim(display_name)) = $1
  `;
  const { rows } = await pool.query(stats, [key]);
  const playerStats = rows[0];
  if (!playerStats || Number(playerStats.games_played) === 0) {
    throw playerNotFound();
  }

  const turnsQuery = `
    SELECT
      COALESCE(MAX(t.points) FILTER (WHERE t.outcome = 'BANKED'), 0) AS best_turn,
      COALESCE(MAX(t.points) FILTER (WHERE t.outcome = 'BUSTED'), 0) AS biggest_bust
    FROM turns t
    JOIN game_players gp ON gp.id = t.game_player_id
    JOIN games g ON g.id = t.game_id
    WHERE g.status = 'FINISHED' AND lower(trim(gp.display_name)) = $1
  `;
  const { rows: turnRows } = await pool.query(turnsQuery, [key]);
  const playerTurns = turnRows[0];

  return {
    name: playerStats.name,
    games_played: Number(playerStats.games_played),
    wins: Number(playerStats.wins),
    win_rate: Number(playerStats.win_rate),
    best_score: Number(playerStats.best_score),
    last_played_at: playerStats.last_played_at,
    best_turn: Number(playerTurns.best_turn),
    biggest_bust: Number(playerTurns.biggest_bust)
  };
}

export async function getPlayerHistory(name, { limit = 10 } = {}) {
  const key = normalizeName(name);

  const historyQuery = `
    SELECT
      r.game_id,
      r.created_at AS played_at,
      g.target_score,
      r.is_winner AS won,
      r.final_score,
      COALESCE((
        SELECT json_agg(
                 json_build_object('name', o.display_name, 'final_score', o.final_score)
                 ORDER BY o.final_score DESC)
        FROM results o
        WHERE o.game_id = r.game_id
          AND lower(trim(o.display_name)) <> lower(trim(r.display_name))
      ), '[]'::json) AS opponents
    FROM results r
    JOIN games g ON g.id = r.game_id
    WHERE lower(trim(r.display_name)) = $1
    ORDER BY r.created_at DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(historyQuery, [key, limit]);
  if (!rows || rows.length === 0) {
    throw playerNotFound();
  }
  return rows.map(row => ({
    game_id: row.game_id,
    played_at: row.played_at,
    target_score: Number(row.target_score),
    won: row.won,
    final_score: Number(row.final_score),
    opponents: row.opponents
  }));
}