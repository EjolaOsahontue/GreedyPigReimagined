import { gameNotFound } from "./errors.js";
import crypto from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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

async function loadGame(tx, id, { lock = false } = {}) {
  if (!UUID_RE.test(id)) throw gameNotFound(); 

  // Dynamically add FOR UPDATE only if lock is true
  const query = `SELECT * FROM games WHERE id = $1 ${lock ? "FOR UPDATE" : ""};`;
  
  const result = await tx.query(query, [id]);

  if (result.rows.length === 0) {
    throw gameNotFound();
  }

  return result.rows[0];
}


async function ensureOpenTurn(tx, gameId, player) {
  const open = 'SELECT id FROM turns WHERE game_player_id = $1 AND outcome = \'OPEN\'';
  const result = await tx.query(open, [player.id]);

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  const insert = 'INSERT INTO turns (game_id, game_player_id, turn_number) VALUES ($1, $2, $3) RETURNING id';
  const insertResult = await tx.query(insert, [gameId, player.id, player.turns_taken + 1]);
  return insertResult.rows[0].id;
}

async function closeTurn(tx, turnId, outcome, points) {
  const close = 'UPDATE turns SET outcome = $2, points = $3 WHERE id = $1';
  await tx.query(close, [turnId, outcome, points]);
}

async function passTurn(tx, game, playerCount) {
  const next = (game.current_seat + 1) % playerCount;
  const update = 'UPDATE games SET current_seat = $2, turn_number = turn_number + 1, updated_at = now() WHERE id = $1';
  await tx.query(update, [game.id, next]);
}


export async function roll(tx, id) {
   const game = await loadGame(tx, id, { lock: true });
   if (game.status !== "IN_PROGRESS") throw gameFinished();

   const players = await loadPlayers(tx, id);
   const currentPlayer = players[game.current_seat];
   const value = crypto.randomInt(1, 7);
   const turnId = await ensureOpenTurn(tx, game.id, currentPlayer);
   const insertRoll = 'INSERT INTO rolls (game_id, game_player_id, turn_id, value) VALUES ($1, $2, $3, $4)';
   await tx.query(insertRoll, [game.id, currentPlayer.id, turnId, value]);

   if (value === 1) {
     await closeTurn(tx, turnId, "BUSTED", currentPlayer.turn_score);
     const updatePlayer = 'UPDATE game_players SET turn_score = 0, rolls_this_turn = 0, turns_taken = turns_taken + 1 WHERE id = $1';
     await tx.query(updatePlayer, [currentPlayer.id]);
     await passTurn(tx, game, players.length);
   }
   if (value !== 1) {
     const running = currentPlayer.turn_score + value;
     if (currentPlayer.total_score + running >= game.target_score) {
       await closeTurn(tx, turnId, "BANKED", running);
       const updatePlayer = 'UPDATE game_players SET total_score = total_score + $2, turn_score = 0, rolls_this_turn = 0, turns_taken = turns_taken + 1 WHERE id = $1';
       await tx.query(updatePlayer, [currentPlayer.id, running]);
       const updateGame = 'UPDATE games SET status = \'FINISHED\', winner_player_id = $2, finished_at = now() WHERE id = $1';
       await tx.query(updateGame, [game.id, currentPlayer.id]);
     } else {
       const updatePlayer = 'UPDATE game_players SET turn_score = $2, rolls_this_turn = rolls_this_turn + 1 WHERE id = $1';
       await tx.query(updatePlayer, [currentPlayer.id, running]);
     }
    }
    const updateGame = 'UPDATE games SET last_roll_value = $2, last_roll_player_id = $3, updated_at = now() WHERE id = $1';
    await tx.query(updateGame, [game.id, value, currentPlayer.id]);
    return { roll: { value, outcome: value === 1 ? "bust" : (currentPlayer.total_score + currentPlayer.turn_score + value >= game.target_score ? "win" : "continue"), player_id: currentPlayer.id }, game: await getGame(tx, id) };
 
}
