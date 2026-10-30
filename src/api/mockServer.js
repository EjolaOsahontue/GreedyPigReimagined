// In-browser stand-in for Member 1's backend.
//
// It does two jobs:
//  1. Lets you build and test the frontend before the real API exists.
//  2. Acts as the REFERENCE for the game rules. Member 1 ports the rules in
//     applyRoll() and applyBank() to the real server. Rules live ONLY here and
//     on the server, never in React components.
//
// Same function names and return shapes as httpClient.js (see docs/API_CONTRACT.md).

import { ApiError } from "./errors";

const LATENCY_MS = 350; // fake network delay so loading states are visible
const FAILURE_RATE = 0; // set to e.g. 0.2 to test error handling
const STORAGE_KEY = "greedy-pig-mock-games";

const LIMITS = { minPlayers: 2, maxPlayers: 8, minTarget: 25, maxTarget: 1000, maxName: 20, maxPigIndex: 28 };

// ---- storage (in memory, mirrored to localStorage so a refresh keeps the game)
const games = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  saved.forEach((g) => games.set(g.id, g));
} catch {
  /* storage unavailable: in-memory only */
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...games.values()]));
  } catch {
    /* ignore */
  }
}

// ---- helpers
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));
const newId = () => crypto.randomUUID();

// Server-side dice. Uses crypto, not Math.random(), so it cannot be predicted.
function rollOneDie() {
  const buf = new Uint32Array(1);
  let n;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= 4294967292); // reject the tail so 1-6 stay equally likely
  return (n % 6) + 1;
}

async function simulateNetwork() {
  await wait(LATENCY_MS);
  if (Math.random() < FAILURE_RATE) {
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: "Could not reach the server" });
  }
}

function getOrThrow(gameId) {
  const game = games.get(gameId);
  if (!game) throw new ApiError({ status: 404, code: "GAME_NOT_FOUND", message: "Game not found" });
  return game;
}

function assertInProgress(game) {
  if (game.status === "finished") {
    throw new ApiError({ status: 409, code: "GAME_FINISHED", message: "This game is already over" });
  }
}

function validateCreate({ players, targetScore }) {
  const fields = {};
  if (!Array.isArray(players) || players.length < LIMITS.minPlayers || players.length > LIMITS.maxPlayers) {
    fields.players = `Need ${LIMITS.minPlayers} to ${LIMITS.maxPlayers} players`;
  } else {
    players.forEach((p, i) => {
      const name = typeof p?.name === "string" ? p.name.trim() : null;
      if (name === null || name.length > LIMITS.maxName) fields[`players[${i}].name`] = `Name must be at most ${LIMITS.maxName} characters`;
      if (!Number.isInteger(p?.pig_index) || p.pig_index < 0 || p.pig_index > LIMITS.maxPigIndex)
        fields[`players[${i}].pig_index`] = `pig_index must be a whole number from 0 to ${LIMITS.maxPigIndex}`;
    });
  }
  if (!Number.isInteger(targetScore) || targetScore < LIMITS.minTarget || targetScore > LIMITS.maxTarget) {
    fields.target_score = `Target score must be a whole number from ${LIMITS.minTarget} to ${LIMITS.maxTarget}`;
  }
  if (Object.keys(fields).length) {
    throw new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Please fix the highlighted fields", fields });
  }
}

// ---- RULES (port these to the real server)

function nextPlayer(game) {
  game.current_player_index = (game.current_player_index + 1) % game.players.length;
  game.turn_number += 1;
}

function applyRoll(game, value) {
  const player = game.players[game.current_player_index];
  game.last_roll = { value, player_id: player.id };

  if (value === 1) {
    // Bust: lose the unbanked running points, turn passes.
    player.running_points = 0;
    nextPlayer(game);
    return "bust";
  }

  player.running_points += value;

  // Reaching the target ends the game immediately, no need to bank first.
  if (player.total_points + player.running_points >= game.target_score) {
    player.total_points += player.running_points;
    player.running_points = 0;
    game.status = "finished";
    game.winner_id = player.id;
    return "win";
  }
  return "continue";
}

function applyBank(game) {
  // Banking with 0 running points is allowed (it just passes the turn), same as the base game.
  const player = game.players[game.current_player_index];
  player.total_points += player.running_points;
  player.running_points = 0;
  nextPlayer(game);
}

// ---- public API (same signatures as httpClient.js)

export async function createGame({ players, targetScore }) {
  await simulateNetwork();
  validateCreate({ players, targetScore });
  const now = new Date().toISOString();
  const game = {
    id: newId(),
    status: "in_progress",
    target_score: targetScore,
    current_player_index: 0,
    turn_number: 1,
    last_roll: null,
    winner_id: null,
    players: players.map((p) => ({
      id: newId(),
      name: p.name.trim(),
      pig_index: p.pig_index,
      running_points: 0,
      total_points: 0,
    })),
    created_at: now,
    updated_at: now,
  };
  games.set(game.id, game);
  persist();
  return { game: clone(game) };
}

export async function getGame(gameId) {
  await simulateNetwork();
  return { game: clone(getOrThrow(gameId)) };
}

export async function rollDice(gameId) {
  await simulateNetwork();
  const game = getOrThrow(gameId);
  assertInProgress(game);
  const value = rollOneDie();
  const rollerId = game.players[game.current_player_index].id;
  const outcome = applyRoll(game, value); // "continue" | "bust" | "win"
  game.updated_at = new Date().toISOString();
  persist();
  return { roll: { value, outcome, player_id: rollerId }, game: clone(game) };
}

export async function bankPoints(gameId) {
  await simulateNetwork();
  const game = getOrThrow(gameId);
  assertInProgress(game);
  applyBank(game);
  game.updated_at = new Date().toISOString();
  persist();
  return { game: clone(game) };
}
