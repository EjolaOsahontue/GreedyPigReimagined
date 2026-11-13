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

// Hot Streak rules. The real server keeps these in one place too.
//   igniteAt:     non-1 rolls in a row (in one turn) that set a player ON FIRE
//   bonusPerRoll: extra points for every roll made while ON FIRE
//   bonusCap:     most bonus points one turn can earn
const RULES = { igniteAt: 3, bonusPerRoll: 2, bonusCap: 10 };

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

// TEST ONLY: queue the next dice values so tests can replay a known game.
// The real server has nothing like this.
let queuedRolls = [];
export function _queueRolls(values) {
  queuedRolls = [...values];
}

// Server-side dice. Uses crypto, not Math.random(), so it cannot be predicted.
function rollOneDie() {
  if (queuedRolls.length) return queuedRolls.shift();
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
      if (name === null || name.length > LIMITS.maxName)
        fields[`players[${i}].name`] = `Name must be at most ${LIMITS.maxName} characters`;
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
//
// HOT STREAK. Roll 3 non-1 numbers in a row in one turn and you are ON FIRE.
// Every roll after that gets +2 bonus (max +10 bonus per turn). A 1 still wipes the whole turn.
// It is automatic: there is no button. Because a 1 ends the turn, the streak is simply the
// number of rolls made so far this turn.

// `streak` is the only thing that is stored. The other two fields are worked out from it,
// so they can never disagree. Only the player whose turn it is can have a streak above 0.
function setStreak(player, streak) {
  player.streak = streak;
  player.on_fire = streak >= RULES.igniteAt;
  player.bonus_this_turn = Math.min(Math.max(0, streak - RULES.igniteAt) * RULES.bonusPerRoll, RULES.bonusCap);
}

function nextPlayer(game) {
  setStreak(game.players[game.current_player_index], 0); // the turn that just ended
  game.current_player_index = (game.current_player_index + 1) % game.players.length;
  game.turn_number += 1;
}

function applyRoll(game, value) {
  const player = game.players[game.current_player_index];
  game.last_roll = { value, player_id: player.id };

  if (value === 1) {
    // Bust: the whole turn is lost (turn points, streak and bonus) and the turn passes.
    player.running_points = 0;
    nextPlayer(game);
    return { outcome: "bust", bonus: 0, streak: 0, on_fire: false, caught_fire: false };
  }

  // A roll made while already ON FIRE earns the bonus, until the turn has earned the cap.
  const bonus = player.on_fire && player.bonus_this_turn < RULES.bonusCap ? RULES.bonusPerRoll : 0;
  setStreak(player, player.streak + 1);
  // The roll that sets the player on fire gets no bonus itself. The bonus starts with the next roll.
  const caughtFire = player.streak === RULES.igniteAt;
  player.running_points += value + bonus;
  const result = { bonus, streak: player.streak, on_fire: player.on_fire, caught_fire: caughtFire };

  // Reaching the target ends the game immediately, no need to bank first. The bonus counts.
  if (player.total_points + player.running_points >= game.target_score) {
    player.total_points += player.running_points;
    player.running_points = 0;
    game.status = "finished";
    game.winner_id = player.id;
    return { outcome: "win", ...result };
  }
  return { outcome: "continue", ...result };
}

function applyBank(game) {
  // Banking with 0 running points is allowed (it just passes the turn), same as the base game.
  const player = game.players[game.current_player_index];
  const pointsBanked = player.running_points;
  player.total_points += pointsBanked;
  player.running_points = 0;
  nextPlayer(game);
  return { player_id: player.id, points_banked: pointsBanked };
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
      streak: 0,
      on_fire: false,
      bonus_this_turn: 0,
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
  const result = applyRoll(game, value); // { outcome, bonus, streak, on_fire, caught_fire }
  game.updated_at = new Date().toISOString();
  persist();
  return { roll: { value, player_id: rollerId, ...result }, game: clone(game) };
}

export async function bankPoints(gameId) {
  await simulateNetwork();
  const game = getOrThrow(gameId);
  assertInProgress(game);
  const bank = applyBank(game);
  game.updated_at = new Date().toISOString();
  persist();
  return { bank, game: clone(game) };
}

// ---- COMPETITION (Member 4): leaderboard, player stats, match history
//
// Everything below is DERIVED from finished games, the same way the real server derives it from the
// `results` table. Nothing here accepts a score from the client. Only players with a name count,
// because unnamed pigs get a nickname on the client only. Names are matched ignoring case and spaces.

const normalizeName = (name) => String(name ?? "").trim().toLowerCase();
const clampLimit = (n) => Math.min(Math.max(Number.isInteger(n) ? n : 10, 1), 50);

// One row per (named player, finished game), newest game first.
function resultRows() {
  const rows = [];
  for (const g of games.values()) {
    if (g.status !== "finished") continue;
    const perGame = new Map(); // the same name used twice in one game counts once
    g.players.forEach((p) => {
      const key = normalizeName(p.name);
      if (!key) return;
      const won = p.id === g.winner_id;
      const prev = perGame.get(key);
      if (prev) {
        prev.won = prev.won || won;
        prev.score = Math.max(prev.score, p.total_points);
        return;
      }
      perGame.set(key, { key, name: p.name.trim(), game: g, won, score: p.total_points });
    });
    rows.push(...perGame.values());
  }
  return rows.sort((a, b) => b.game.updated_at.localeCompare(a.game.updated_at));
}

function groupByPlayer(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key).push(r);
  }
  return byKey;
}

function summarize(list) {
  const wins = list.filter((r) => r.won).length;
  return {
    games_played: list.length,
    wins,
    win_rate: list.length ? Math.round((wins / list.length) * 100) : 0,
  };
}

function rowsForPlayerOrThrow(name) {
  const list = groupByPlayer(resultRows()).get(normalizeName(name));
  if (!list) {
    throw new ApiError({ status: 404, code: "PLAYER_NOT_FOUND", message: "No finished games found for that player" });
  }
  return list; // newest game first
}

// GET /leaderboard?limit=10
export async function getLeaderboard({ limit = 10 } = {}) {
  await simulateNetwork();
  const entries = [...groupByPlayer(resultRows()).values()].map((list) => ({
    name: list[0].name, // most recent spelling
    ...summarize(list),
  }));
  entries.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.win_rate - a.win_rate ||
      a.games_played - b.games_played ||
      a.name.localeCompare(b.name)
  );
  return { leaderboard: entries.slice(0, clampLimit(limit)).map((e, i) => ({ rank: i + 1, ...e })) };
}

// GET /players/:name/stats
export async function getPlayerStats(name) {
  await simulateNetwork();
  const list = rowsForPlayerOrThrow(name);
  return {
    player: {
      name: list[0].name,
      ...summarize(list),
      best_score: Math.max(...list.map((r) => r.score)),
      last_played_at: list[0].game.updated_at,
    },
  };
}

// GET /players/:name/history?limit=10
export async function getPlayerHistory(name, { limit = 10 } = {}) {
  await simulateNetwork();
  const list = rowsForPlayerOrThrow(name);
  return {
    history: list.slice(0, clampLimit(limit)).map((r) => ({
      game_id: r.game.id,
      played_at: r.game.updated_at,
      target_score: r.game.target_score,
      won: r.won,
      final_score: r.score,
      opponents: r.game.players
        .filter((p) => normalizeName(p.name) !== r.key)
        .map((p) => ({ name: p.name, final_score: p.total_points })),
    })),
  };
}

// ---- DEV ONLY: sample finished games so the leaderboard can be built before the game screens
// call this API. Marked `sample: true` so they can be removed again. The UI only offers these
// buttons in `npm run dev`, and the real server has no such endpoints.

const SAMPLE_GAMES = [
  { target: 100, winner: 0, players: [["Ada", 104], ["Tunde", 71]] },
  { target: 100, winner: 0, players: [["Tunde", 102], ["Ada", 88], ["Zainab", 40]] },
  { target: 50, winner: 0, players: [["Zainab", 52], ["Osas", 33]] },
  { target: 100, winner: 0, players: [["Osas", 100], ["Ada", 96]] },
  { target: 100, winner: 0, players: [["Ada", 103], ["Zainab", 90], ["", 55]] },
  { target: 75, winner: 0, players: [["Tosyn", 77], ["Osas", 60]] },
  { target: 100, winner: 1, players: [["Tunde", 65], ["Zainab", 101]] },
  { target: 100, winner: 1, players: [["Osas", 99], ["Tosyn", 102]] },
  { target: 100, winner: 1, players: [["Ada", 50], ["Zainab", 105]] },
];

export async function clearSampleGames() {
  await simulateNetwork();
  let removed = 0;
  for (const [id, g] of games) {
    if (g.sample) {
      games.delete(id);
      removed += 1;
    }
  }
  persist();
  return { removed };
}

export async function seedSampleGames() {
  await clearSampleGames();
  const start = Date.now() - SAMPLE_GAMES.length * 3600000; // one game per hour, oldest first
  SAMPLE_GAMES.forEach((s, i) => {
    const at = new Date(start + i * 3600000).toISOString();
    const players = s.players.map(([name, total]) => ({
      id: newId(),
      name,
      pig_index: 0,
      running_points: 0,
      total_points: total,
    }));
    const game = {
      id: newId(),
      status: "finished",
      target_score: s.target,
      current_player_index: 0,
      turn_number: 10 + i,
      last_roll: null,
      winner_id: players[s.winner].id,
      players,
      created_at: at,
      updated_at: at,
      sample: true,
    };
    games.set(game.id, game);
  });
  persist();
  return { seeded: SAMPLE_GAMES.length };
}
