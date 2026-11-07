import { gameNotFound } from "./errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadGame(tx, id) {
 if (!UUID_RE.test(id)) throw gameNotFound(); 

  const result = await tx.query("SELECT * FROM games WHERE id = $1", [id]);
  if (!result.rows[0]) throw gameNotFound();
  return result.rows[0];
}

async function loadPlayers(tx, gameId) {
  const result = await tx.query("SELECT * FROM game_players WHERE game_id = $1 ORDER BY seat", [gameId]);
  return result.rows;
}

function toGame(g, players) {
  return {
    id: g.id,
    status: g.status.toLowerCase(), // IN_PROGRESS -> in_progress
    target_score: g.target_score,
    current_player_index: g.current_seat,
    turn_number: g.turn_number,
    last_roll: g.last_roll_value ? { value: g.last_roll_value, player_id: g.last_roll_player_id } : null,
    winner_id: g.winner_player_id,
    players: players.map((p) => ({
      id: p.id,
      name: p.display_name,
      pig_index: p.pig_index,
      running_points: p.turn_score,
      total_points: p.total_score,
    })),
    created_at: g.created_at,
    updated_at: g.updated_at,
}}

export async function getGame(tx, id) {
  // TODO 5: load the game, load its players, return toGame(game, players)
  const game = await loadGame(tx, id);
  const players = await loadPlayers(tx, id);
  return toGame(game, players);
}

export async function createGame(tx, { players, target_score }) {
  const gameResult = await tx.query("INSERT INTO games (target_score) VALUES ($1) RETURNING id", [target_score]);
  const newId = gameResult.rows[0].id;
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    await tx.query(
      "INSERT INTO game_players (game_id, display_name, pig_index, seat) VALUES ($1, $2, $3, $4)",
      [newId, player.name, player.pig_index, i]
    );
  }
  return getGame(tx, newId);
}

