import { AppError, gameFinished, gameNotFound } from "./errors.js";
import crypto from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOUBLE_DOWN_MIN_ROLLS = 3;
const DOUBLE_DOWN_PENALTY = 5;

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
      double_down_used: p.double_down_used,
    double_down_active: p.double_down_active,
    rolls_until_bank: p.double_down_active 
      ? Math.max(0, DOUBLE_DOWN_MIN_ROLLS - p.rolls_this_turn) 
      : null,
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

export async function bank(tx, id) {
  const game = await loadGame(tx, id, { lock: true });
  if (game.status !== "IN_PROGRESS") throw gameFinished();
  
  const players = await loadPlayers(tx, id);
  const currentPlayer = players[game.current_seat];

  // 1. Enforce 3-roll minimum if Double Down is active
  if (currentPlayer.double_down_active && currentPlayer.rolls_this_turn < DOUBLE_DOWN_MIN_ROLLS) {
    const remaining = DOUBLE_DOWN_MIN_ROLLS - currentPlayer.rolls_this_turn;
    throw new AppError(409, "DOUBLE_DOWN_LOCKED", `Must roll ${remaining} more time(s) before banking under Double Down`);
  }

  const turnId = await ensureOpenTurn(tx, game.id, currentPlayer);
  
  // 2. Apply Double Down multiplier if active
  const multiplier = currentPlayer.double_down_active ? 2 : 1;
  const points = currentPlayer.turn_score * multiplier;

  await closeTurn(tx, turnId, "BANKED", points);

  // 3. Update player: add points, reset turn fields, clear double_down_active, increment turns_taken
  const updatePlayer = `
    UPDATE game_players 
    SET total_score = total_score + $2, 
        turn_score = 0, 
        rolls_this_turn = 0, 
        double_down_active = false, 
        turns_taken = turns_taken + 1 
    WHERE id = $1;
  `;
  await tx.query(updatePlayer, [currentPlayer.id, points]);

  if (currentPlayer.total_score + points >= game.target_score) {
    const updateGame = 'UPDATE games SET status = \'FINISHED\', winner_player_id = $2, finished_at = now() WHERE id = $1';
    await tx.query(updateGame, [game.id, currentPlayer.id]);
    await saveResults(tx, game.id);
  } else {
    await passTurn(tx, game, players.length);
  }
  
  return { game: await getGame(tx, id) };
}

export async function roll(tx, id, rollDie = () => crypto.randomInt(1, 7)) {
  const game = await loadGame(tx, id, { lock: true });
  if (game.status !== "IN_PROGRESS") throw gameFinished();
  
  const players = await loadPlayers(tx, id);
  const currentPlayer = players[game.current_seat];
  
  const multiplier = currentPlayer.double_down_active ? 2 : 1;
  const value = rollDie();
  const turnId = await ensureOpenTurn(tx, game.id, currentPlayer);
  
  const insertRoll = 'INSERT INTO rolls (game_id, game_player_id, turn_id, value) VALUES ($1, $2, $3, $4)';
  await tx.query(insertRoll, [game.id, currentPlayer.id, turnId, value]);

  let outcome;

  if (value === 1) {
    outcome = "bust";
    await closeTurn(tx, turnId, "BUSTED", currentPlayer.turn_score);
    
    // Apply penalty if Double Down was active, floored at 0 using GREATEST
    const penalty = currentPlayer.double_down_active ? DOUBLE_DOWN_PENALTY : 0;
    const updatePlayer = `
      UPDATE game_players 
      SET total_score = GREATEST(total_score - $2, 0), 
          turn_score = 0, 
          rolls_this_turn = 0, 
          double_down_active = false, 
          turns_taken = turns_taken + 1 
      WHERE id = $1;
    `;
    await tx.query(updatePlayer, [currentPlayer.id, penalty]);
    await passTurn(tx, game, players.length);
  } else {
    const running = currentPlayer.turn_score + value;
    const banked = running * multiplier;

    if (currentPlayer.total_score + banked >= game.target_score) {
      outcome = "win";
      await closeTurn(tx, turnId, "BANKED", banked);
      
      const updatePlayer = `
        UPDATE game_players 
        SET total_score = total_score + $2, 
            turn_score = 0, 
            rolls_this_turn = 0, 
            double_down_active = false, 
            turns_taken = turns_taken + 1 
        WHERE id = $1;
      `;
      await tx.query(updatePlayer, [currentPlayer.id, banked]);
      
      const updateGame = 'UPDATE games SET status = \'FINISHED\', winner_player_id = $2, finished_at = now() WHERE id = $1';
      await tx.query(updateGame, [game.id, currentPlayer.id]);
      await saveResults(tx, game.id);
    } else {
      outcome = "continue";
      const updatePlayer = 'UPDATE game_players SET turn_score = $2, rolls_this_turn = rolls_this_turn + 1 WHERE id = $1';
      await tx.query(updatePlayer, [currentPlayer.id, running]);
    }
  }

  const updateGameLastRoll = 'UPDATE games SET last_roll_value = $2, last_roll_player_id = $3, updated_at = now() WHERE id = $1';
  await tx.query(updateGameLastRoll, [game.id, value, currentPlayer.id]);

  return { 
    roll: { value, outcome, player_id: currentPlayer.id }, 
    game: await getGame(tx, id) 
  };
}
async function saveResults(tx, gameId) {
  const game = await loadGame(tx, gameId, { lock: true });
  const players = await loadPlayers(tx, gameId);
  const insertResult = 'INSERT INTO results (game_id, game_player_id, display_name, final_score, is_winner) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (game_id, game_player_id) DO NOTHING';
    for (const player of players) {
    const isWinner = player.id === game.winner_player_id;
    
    await tx.query(insertResult, [
      gameId,
      player.id,
      player.display_name,
      player.total_score,
      isWinner
      ]);

    
  }
}

export async function finish(tx, id) {
  const game = await loadGame(tx, id, { lock: true });
  if (game.status !== "FINISHED") {
    throw new AppError(409, "GAME_NOT_FINISHED", "This game is not finished yet");
  }
  await saveResults(tx, id);
  const final = "SELECT game_player_id, display_name, final_score, is_winner FROM results WHERE game_id = $1 ORDER BY final_score DESC";
  const result = await tx.query(final, [id]);
  const results = result.rows.map((row) => ({
    player_id: row.game_player_id,
    name: row.display_name,
    final_score: row.final_score,
    is_winner: row.is_winner
  }));
  return { 
    game: await getGame(tx, id), 
    results 
  };
}

export async function doubleDown(tx, id) {
  const game = await loadGame(tx, id, { lock: true });
  if (game.status !== "IN_PROGRESS") throw gameFinished();
  const players = await loadPlayers(tx, id);
  const declarer = players[game.current_seat];
  if (declarer.double_down_used) {
    throw new AppError(409, "DOUBLE_DOWN_USED", "Double Down already used");
  }
  if (declarer.rolls_this_turn > 0) {
    throw new AppError(409, "DOUBLE_DOWN_TOO_LATE", "Declare Double Down before your first roll of the turn");
  }
  const turnId = await ensureOpenTurn(tx, game.id, declarer);
  const updateTurn = 'UPDATE turns SET double_down = true WHERE id = $1';
  await tx.query(updateTurn, [turnId]);
  const updatePlayer = 'UPDATE game_players SET double_down_used = true, double_down_active = true WHERE id = $1';
  await tx.query(updatePlayer, [declarer.id]);
  return {game: await getGame(tx, id)}
}
