// Checks the whole backend in one go:  node scripts/test-everything.js
//
//   Part 1  the game rules, leaderboard, stats and history, called directly (needs DATABASE_URL)
//   Part 2  the real HTTP endpoints, including cheat attempts and error shapes
//           (needs the API running; set BASE_URL to test the live server, default http://localhost:3000)
//
// Every game it creates uses a name starting with sttest_, lbtest_ or httptest_, and all of them
// are deleted at the end (and at the start, in case an earlier run crashed). Nothing else is touched.
import { pool, withTransaction } from "../src/db.js";
import { createGame, roll, bank, finish } from "../src/gameService.js";
import { getLeaderboard, getPlayerStats, getPlayerHistory, parseLimit } from "../src/statsService.js";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API = BASE + "/api/v1";
const T = (fn) => withTransaction(fn);
const R = (n) => ["roll", n];
const dice = (...values) => { let i = 0; return () => values[i++]; }; // fixed dice, for tests only
const pause = () => new Promise((r) => setTimeout(r, 20));          // so "newest first" is unambiguous
const ids = [];
let failed = 0;

// ---------------------------------------------------------------- helpers
async function section(name, fn) {
  const problems = [];
  const expect = (ok, msg) => { if (!ok) problems.push(msg); };
  async function expectError(promise, code, label) {
    try { await promise; problems.push(`${label}: should have thrown ${code}`); }
    catch (e) { expect(e.code === code, `${label}: wanted ${code}, got ${e.code} (${e.message})`); }
  }
  try { await fn(expect, expectError); }
  catch (e) { problems.push("crashed: " + e.message); }
  if (problems.length) { failed++; console.log(`FAIL  ${name}`); problems.forEach((p) => console.log("      - " + p)); }
  else console.log(`PASS  ${name}`);
}

const rulePlayers = [{ name: "sttest_ada", pig_index: 0 }, { name: "", pig_index: 1 }];
async function newGame(target = 1000, players = rulePlayers) {
  const g = await T((tx) => createGame(tx, { players, target_score: target }));
  ids.push(g.id);
  return g;
}
const setTotal = (g, seat, n) => pool.query("UPDATE game_players SET total_score = $1 WHERE id = $2", [n, g.players[seat].id]);

// Plays one scripted game between named players, newest results get a distinct timestamp.
async function play(names, moves) {
  let game = await T((tx) => createGame(tx, { players: names.map((name, i) => ({ name, pig_index: i })), target_score: 25 }));
  ids.push(game.id);
  for (const [action, n] of moves) {
    if (action === "roll") game = (await T((tx) => roll(tx, game.id, () => n))).game;
    else if (action === "bank") game = (await T((tx) => bank(tx, game.id))).game;
  }
  await pause();
  return game;
}

async function removeGames(gameIds) {
  if (!gameIds.length) return;
  await pool.query("UPDATE games SET winner_player_id = NULL WHERE id = ANY($1)", [gameIds]);
  for (const table of ["results", "rolls", "turns", "game_players"]) {
    await pool.query(`DELETE FROM ${table} WHERE game_id = ANY($1)`, [gameIds]);
  }
  await pool.query("DELETE FROM games WHERE id = ANY($1)", [gameIds]);
}
async function cleanup() {
  await removeGames(ids);
  const { rows } = await pool.query(
    `SELECT DISTINCT game_id FROM game_players
      WHERE display_name ILIKE 'sttest\\_%' OR display_name ILIKE 'lbtest\\_%' OR display_name ILIKE 'httptest\\_%'`
  );
  await removeGames(rows.map((r) => r.game_id));
}

await cleanup(); // leftovers from a crashed earlier run

// ================================================================ PART 1: direct calls
console.log("--- Part 1: rules, leaderboard, stats and history ---");

await section("roll: the dice rules", async (expect, expectError) => {
  let game = await newGame(25);
  let rolls = 0;
  while (game.status === "in_progress" && rolls < 500) {
    const before = game, who = before.current_player_index;
    const res = await T((tx) => roll(tx, game.id));
    game = res.game; rolls++;
    const { value, outcome, bonus } = res.roll;
    expect(value >= 1 && value <= 6, "value out of range: " + value);
    expect(Number.isInteger(bonus) && bonus >= 0 && bonus <= 2, "roll.bonus must be 0 or 2, got " + bonus);
    if (value === 1) {
      expect(outcome === "bust", "a 1 must be a bust");
      expect(bonus === 0, "a bust must have no bonus");
      expect(game.players[who].running_points === 0 && game.players[who].streak === 0, "a bust must zero the turn points and the streak");
      expect(game.current_player_index !== who, "a bust must pass the turn");
    } else if (outcome === "continue") {
      expect(game.players[who].running_points === before.players[who].running_points + value + bonus, "points must add up (roll + bonus)");
      expect(game.players[who].streak === before.players[who].streak + 1, "the streak must go up by 1 on every non-1 roll");
      expect(game.current_player_index === who, "the turn must stay with the roller");
    }
  }
  expect(game.status === "finished", "the game must finish");
  const winner = game.players.find((p) => p.id === game.winner_id);
  expect(winner && winner.total_points >= 25, "the winner must reach the target");
  await expectError(T((tx) => roll(tx, game.id)), "GAME_FINISHED", "roll on a finished game");
});

await section("bank: cashing in", async (expect, expectError) => {
  let game = await newGame();
  const id = game.id;
  while (true) {
    const res = await T((tx) => roll(tx, id));
    game = res.game;
    if (res.roll.outcome === "continue") break;
  }
  const who = game.current_player_index;
  const running = game.players[who].running_points;
  const totalBefore = game.players[who].total_points;
  const turnBefore = game.turn_number;
  const after = (await T((tx) => bank(tx, id))).game;
  expect(after.players[who].total_points === totalBefore + running, "banking must add the turn points to the total");
  expect(after.players[who].running_points === 0, "banking must reset the turn points");
  expect(after.current_player_index === (who + 1) % 2, "banking must pass the turn");
  expect(after.turn_number === turnBefore + 1, "turn_number must go up by 1");
  const t = await pool.query(
    "SELECT outcome, points FROM turns WHERE game_id = $1 AND game_player_id = $2 ORDER BY turn_number DESC LIMIT 1",
    [id, after.players[who].id]
  );
  expect(t.rows[0]?.outcome === "BANKED" && t.rows[0]?.points === running, "the turn row must be BANKED with the banked points");
  const next = after.current_player_index;
  const zero = (await T((tx) => bank(tx, id))).game;
  expect(zero.players[next].total_points === after.players[next].total_points, "banking 0 must not change the total");
  expect(zero.current_player_index === (next + 1) % 2, "banking 0 must still pass the turn");

  let g2 = await newGame(25), moves = 0;
  while (g2.status === "in_progress" && moves < 2000) {
    moves++;
    const p = g2.players[g2.current_player_index];
    g2 = p.running_points >= 10 ? (await T((tx) => bank(tx, g2.id))).game : (await T((tx) => roll(tx, g2.id))).game;
  }
  expect(g2.status === "finished", "a game of rolls and banks must finish");
  await expectError(T((tx) => bank(tx, g2.id)), "GAME_FINISHED", "bank on a finished game");
});

await section("finish: saving results", async (expect, expectError) => {
  let game = await newGame(25);
  const id = game.id;
  await expectError(T((tx) => finish(tx, id)), "GAME_NOT_FINISHED", "finish too early");
  const early = await pool.query("SELECT count(*) FROM results WHERE game_id = $1", [id]);
  expect(Number(early.rows[0].count) === 0, "no results may exist before the game ends");
  let rolls = 0;
  while (game.status === "in_progress" && rolls < 500) { game = (await T((tx) => roll(tx, id))).game; rolls++; }
  const saved = await pool.query("SELECT * FROM results WHERE game_id = $1", [id]);
  expect(saved.rows.length === 2, "the winning roll must save 2 result rows");
  const winners = saved.rows.filter((r) => r.is_winner);
  expect(winners.length === 1, "exactly one result must be the winner");
  expect(winners[0]?.final_score >= 25, "the winner's final_score must reach the target");
  expect(winners[0]?.game_player_id === game.winner_id, "the winner row must match winner_id");
  const a = await T((tx) => finish(tx, id));
  const b = await T((tx) => finish(tx, id));
  expect(a.results.length === 2 && b.results.length === 2, "finish must return 2 results");
  expect(a.results[0].is_winner === true, "results should list the winner first");
  const after = await pool.query("SELECT count(*) FROM results WHERE game_id = $1", [id]);
  expect(Number(after.rows[0].count) === 2, "calling finish twice must not duplicate results");
});

await section("hot streak: the plan's rules", async (expect) => {
  // A: 3 plain rolls, then +2 on rolls 4 to 8 (the +10 cap), then plain again
  let g = await newGame();
  const dieA = dice(2, 2, 2, 2, 2, 2, 2, 2, 2);
  const bonuses = [], running = [];
  for (let i = 0; i < 9; i++) {
    const r = await T((tx) => roll(tx, g.id, dieA));
    bonuses.push(r.roll.bonus); running.push(r.game.players[0].running_points);
    if (i === 3) expect(r.game.players[0].streak === 4, "A: streak must be 4 after 4 rolls, got " + r.game.players[0].streak);
  }
  expect(bonuses.join() === "0,0,0,2,2,2,2,2,0", "A: bonuses must be 0,0,0,2,2,2,2,2,0, got " + bonuses.join());
  expect(running.join() === "2,4,6,10,14,18,22,26,28", "A: running points must be 2,4,6,10,14,18,22,26,28, got " + running.join());

  // B: a 1 wipes everything, bonus included, and ends the streak
  g = await newGame();
  const dieB = dice(2, 2, 2, 2, 1);
  for (let i = 0; i < 4; i++) await T((tx) => roll(tx, g.id, dieB));
  const rb = await T((tx) => roll(tx, g.id, dieB));
  expect(rb.roll.outcome === "bust" && rb.roll.bonus === 0, "B: a 1 is a bust with no bonus");
  expect(rb.game.players[0].total_points === 0 && rb.game.players[0].running_points === 0 && rb.game.players[0].streak === 0, "B: turn points and streak wiped, total untouched");
  expect(rb.game.current_player_index === 1, "B: bust passes the turn");
  const tb = await pool.query("SELECT outcome, points FROM turns WHERE game_id = $1 AND outcome = 'BUSTED'", [g.id]);
  expect(tb.rows[0]?.points === 10, "B: the bust must record the 10 points lost (bonus included), got " + tb.rows[0]?.points);

  // C: banking keeps the bonus; D: the next turn starts with no streak
  g = await newGame();
  const dieC = dice(2, 2, 2, 2, 5);
  for (let i = 0; i < 4; i++) await T((tx) => roll(tx, g.id, dieC));
  const rc = await T((tx) => bank(tx, g.id));
  expect(rc.game.players[0].total_points === 10, "C: 2+2+2+(2+2) banked must be 10, got " + rc.game.players[0].total_points);
  expect(rc.game.players[0].streak === 0, "C: banking resets the streak");
  await T((tx) => bank(tx, g.id));                              // player 2 banks 0, back to player 1
  const rd = await T((tx) => roll(tx, g.id, dieC));
  expect(rd.roll.bonus === 0 && rd.game.players[0].streak === 1, "D: a new turn starts with no streak and no bonus");

  // E: the bonus can win the game (18 + 6 + 2 = 26 reaches 25, 24 would not)
  g = await newGame(25);
  const dieE = dice(6, 6, 6, 6);
  for (let i = 0; i < 3; i++) await T((tx) => roll(tx, g.id, dieE));
  const re = await T((tx) => roll(tx, g.id, dieE));
  expect(re.roll.outcome === "win" && re.roll.bonus === 2 && re.game.status === "finished", "E: the 4th six wins with a +2 bonus");
  expect(re.game.players[0].total_points === 26, "E: final total is 26, got " + re.game.players[0].total_points);
  const saved = await pool.query("SELECT final_score FROM results WHERE game_id = $1 AND is_winner", [g.id]);
  expect(saved.rows[0]?.final_score === 26, "E: the saved result must say 26");
});

const sixes = [R(6), R(6), R(6), R(6)];                       // 18, then 6 + 2 = 26: wins a target-25 game

await section("leaderboard: ranking rules", async (expect) => {
  await play(["lbtest_a", ""], sixes);                                  // lbtest_a beats a blank-named player
  await play(["LBTEST_A", "lbtest_b"], sixes);                          // same player, different capitals, newest spelling
  await play(["lbtest_b", ""], [["bank"], ...sixes]);                   // a blank-named player wins: must never be ranked
  const board = await getLeaderboard({ limit: 50 });
  const a = board.find((r) => r.name.toLowerCase() === "lbtest_a");
  const b = board.find((r) => r.name.toLowerCase() === "lbtest_b");
  expect(a && a.wins === 2 && a.games_played === 2 && a.win_rate === 100, "lbtest_a and LBTEST_A must be one player: 2 wins, 2 games, 100%");
  expect(a && a.name === "LBTEST_A", "the name must use the most recent spelling (LBTEST_A), got " + a?.name);
  expect(b && b.wins === 0 && b.games_played === 2 && b.win_rate === 0, "lbtest_b must have 0 wins from 2 games");
  expect(!board.some((r) => r.name.trim() === ""), "blank names must never be ranked");
  expect(a && b && board.indexOf(a) < board.indexOf(b), "more wins must rank higher");
  expect(board.every((r, i) => r.rank === i + 1), "ranks must be 1, 2, 3, ...");
  expect(board.every((r) => typeof r.wins === "number" && typeof r.games_played === "number" && typeof r.win_rate === "number"), "counts must be real numbers, not strings");
  expect(Object.keys(board[0] ?? {}).sort().join() === "games_played,name,rank,win_rate,wins", "each row must have exactly: rank, name, games_played, wins, win_rate");
  expect((await getLeaderboard()).length <= 10, "default is at most 10 rows");
  expect((await getLeaderboard({ limit: 1 })).length === 1, "limit 1 must return 1 row");
  expect(parseLimit("5") === 5 && parseLimit("50") === 50, "valid limits are kept");
  expect([undefined, "0", "51", "abc", "2.5", "-3", ""].every((v) => parseLimit(v) === 10), "invalid limits fall back to 10");
});

await section("stats and history", async (expect, expectError) => {
  const g1 = await play(["sttest_a", "sttest_b"], [R(4), ["bank"], R(1), R(6), R(6), R(6), R(6)]);           // a banks 4, then a hot streak turn of 26 wins: 30
  const g2 = await play(["sttest_b", "sttest_a"], sixes);                                                     // b wins at once
  const g3 = await play(["sttest_a", "sttest_b"], [R(5), R(4), R(1), R(6), R(6), R(6), R(6)]);                // a busts (loses 9), b wins
  const s = await getPlayerStats("sttest_a");
  expect(s.name === "sttest_a", "stats name");
  expect(s.games_played === 3 && s.wins === 1 && s.win_rate === 33, `games/wins/win_rate must be 3/1/33, got ${s.games_played}/${s.wins}/${s.win_rate}`);
  expect(s.best_score === 30, "best_score must be 30, got " + s.best_score);
  expect(s.best_turn === 26, "best_turn must be 26 (the hot streak turn), got " + s.best_turn);
  expect(s.biggest_bust === 9, "biggest_bust must be 9, got " + s.biggest_bust);
  expect(typeof s.wins === "number" && typeof s.best_score === "number", "counts must be real numbers, not strings");
  const sb = await getPlayerStats("  STTEST_B ");
  expect(sb.games_played === 3 && sb.wins === 2, "capitals and spaces must not matter: b has 3 games, 2 wins");
  await expectError(getPlayerStats("sttest_nobody"), "PLAYER_NOT_FOUND", "unknown player (stats)");
  await expectError(getPlayerStats("   "), "PLAYER_NOT_FOUND", "blank name (stats)");
  await expectError(getPlayerStats("x".repeat(30)), "PLAYER_NOT_FOUND", "over-long name (stats)");

  const h = await getPlayerHistory("sttest_a");
  expect(h.length === 3, "history must have 3 games, got " + h.length);
  expect(h[0]?.game_id === g3.id && h[1]?.game_id === g2.id && h[2]?.game_id === g1.id, "newest game must come first (G3, G2, G1)");
  expect(h[0]?.won === false && h[2]?.won === true, "won flags: G3 lost, G1 won");
  expect(h[2]?.final_score === 30 && h[0]?.final_score === 0, "final scores: G1 30, G3 0");
  expect(h[0]?.target_score === 25, "target_score must be included");
  expect(h[2]?.opponents?.length === 1 && h[2].opponents[0].name === "sttest_b" && h[2].opponents[0].final_score === 0, "G1 opponent is sttest_b with 0");
  expect(h[0]?.opponents?.[0]?.final_score === 26, "G3 opponent scored 26");
  expect(Object.keys(h[0] ?? {}).sort().join() === "final_score,game_id,opponents,played_at,target_score,won", "each entry needs exactly: game_id, played_at, target_score, won, final_score, opponents");
  expect((await getPlayerHistory("sttest_a", { limit: 1 })).length === 1, "limit 1 returns 1 entry");
  await expectError(getPlayerHistory("sttest_nobody"), "PLAYER_NOT_FOUND", "unknown player (history)");
});

// ================================================================ PART 2: the real HTTP endpoints
console.log("\n--- Part 2: HTTP endpoints at " + BASE + " ---");

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(65000), // a sleeping free server can take about a minute to wake
  });
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data };
}

let serverUp = false;
try {
  const h = await fetch(BASE + "/api/health", { signal: AbortSignal.timeout(65000) });
  serverUp = h.ok;
} catch { /* not reachable */ }

if (!serverUp) {
  console.log("SKIP  the API is not reachable at " + BASE + ". Start it with `npm run dev` (or set BASE_URL) to run Part 2.");
} else {
  const good = [{ name: "httptest_a", pig_index: 0 }, { name: "httptest_b", pig_index: 1 }];

  await section("http: bad input gets a clean 400 or 404", async (expect) => {
    const bad = [
      ["only 1 player", { players: [good[0]], target_score: 100 }, "players"],
      ["name over 20 characters", { players: [{ name: "x".repeat(21), pig_index: 0 }, good[1]] }, "players.0.name"],
      ["target_score 10", { players: good, target_score: 10 }, "target_score"],
      ["target_score as a string", { players: good, target_score: "100" }, "target_score"],
      ["pig_index 99", { players: [{ name: "A", pig_index: 99 }, good[1]] }, "players.0.pig_index"],
      ["an extra field (a fake score)", { players: good, total_points: 999 }, null],
    ];
    for (const [label, body, field] of bad) {
      const r = await call("POST", "/games", body);
      expect(r.status === 400 && r.data?.error?.code === "VALIDATION_ERROR", `${label}: want 400 VALIDATION_ERROR, got ${r.status}`);
      if (field) expect(!!r.data?.error?.fields?.[field], `${label}: fields must name "${field}"`);
    }
    const broken = await call("POST", "/games", "{not json");
    expect(broken.status === 400 && broken.data?.error?.code === "VALIDATION_ERROR", "broken JSON must give a clean 400");
    const badId = await call("GET", "/games/not-a-uuid");
    expect(badId.status === 404 && badId.data?.error?.code === "GAME_NOT_FOUND", "a bad game id must give 404 GAME_NOT_FOUND");
    const unknown = await call("GET", "/games/00000000-0000-4000-8000-000000000000");
    expect(unknown.status === 404 && unknown.data?.error?.code === "GAME_NOT_FOUND", "an unknown game id must give 404 GAME_NOT_FOUND");
    const route = await call("GET", "/nothing-here");
    expect(route.status === 404 && route.data?.error?.code === "NOT_FOUND", "an unknown route must give 404 with error.code NOT_FOUND (update the 404 catch-all in index.js)");
  });

  let gameId = null;
  await section("http: play a game, cheat attempts, Hot Streak, finish", async (expect) => {
    let r = await call("POST", "/games", { players: good, target_score: 25 });
    expect(r.status === 201 && r.data?.game?.status === "in_progress", "create game must give 201 and in_progress");
    const game = r.data?.game;
    gameId = game?.id;
    expect(game?.players?.length === 2 && game.players[0].streak === 0, "players must include streak, starting at 0");
    expect(Object.keys(game?.players?.[0] ?? {}).sort().join() === "id,name,pig_index,running_points,streak,total_points",
      "player fields must be exactly: id, name, pig_index, running_points, total_points, streak");
    r = await call("GET", `/games/${gameId}`);
    expect(r.status === 200 && r.data?.game?.id === gameId, "GET game must return the same game");

    // cheating: the server decides the dice and the score, so any body is refused
    for (const [path, body] of [["roll", { value: 6 }], ["roll", { bonus: 10 }], ["bank", { total_points: 500 }], ["finish", { winner: "x" }]]) {
      r = await call("POST", `/games/${gameId}/${path}`, body);
      expect(r.status === 400 && r.data?.error?.code === "VALIDATION_ERROR", `CHEAT on /${path}: a request body must be refused with 400, got ${r.status}`);
    }
    r = await call("GET", `/games/${gameId}`);
    expect(r.data.game.players.every((p) => p.total_points === 0 && p.running_points === 0) && r.data.game.last_roll === null, "cheat attempts must change nothing");

    r = await call("POST", `/games/${gameId}/finish`);
    expect(r.status === 409 && r.data?.error?.code === "GAME_NOT_FINISHED", "finish too early must give 409 GAME_NOT_FINISHED, got " + r.status);

    r = await call("POST", `/games/${gameId}/double-down`);
    expect(r.status === 404 && r.data?.error?.code === "NOT_FOUND", "the old double-down endpoint must be gone (404), got " + r.status);

    r = await call("POST", `/games/${gameId}/roll`);
    expect(r.status === 200 && r.data?.roll?.bonus === 0 && typeof r.data.roll.value === "number", "the first roll must give 200 with value and bonus 0");
    expect(r.data?.game?.players?.[0] && typeof r.data.game.players[0].streak === "number", "the roll response game must include each player's streak");

    // two rolls at the same instant must both be handled cleanly (the game row is locked)
    const both = await Promise.all([call("POST", `/games/${gameId}/roll`), call("POST", `/games/${gameId}/roll`)]);
    expect(both.every((x) => x.status === 200 && x.data?.roll?.value >= 1 && x.data.roll.value <= 6 && Number.isInteger(x.data.roll.bonus)), "two simultaneous rolls must both give 200 with a value from 1 to 6 and a bonus");

    // play on to the end through the API
    let g = (await call("GET", `/games/${gameId}`)).data.game, moves = 0;
    while (g.status === "in_progress" && moves < 3000) {
      moves++;
      const p = g.players[g.current_player_index];
      const action = p.running_points >= 10 ? "bank" : "roll";
      const res = await call("POST", `/games/${gameId}/${action}`);
      if (res.status !== 200) { expect(false, `${action} gave ${res.status} during play`); break; }
      g = res.data.game;
    }
    expect(g.status === "finished" && !!g.winner_id, "the game must finish with a winner_id");
    for (const path of ["roll", "bank"]) {
      r = await call("POST", `/games/${gameId}/${path}`);
      expect(r.status === 409 && r.data?.error?.code === "GAME_FINISHED", `${path} on a finished game must give 409 GAME_FINISHED, got ${r.status}`);
    }
    r = await call("POST", `/games/${gameId}/finish`);
    expect(r.status === 200 && r.data?.results?.length === 2 && r.data.results.filter((x) => x.is_winner).length === 1, "finish must give 200 with 2 results and one winner");
    const again = await call("POST", `/games/${gameId}/finish`);
    expect(again.status === 200 && again.data?.results?.length === 2, "finish twice must be harmless");
  });

  await section("http: leaderboard, stats and history", async (expect) => {
    let r = await call("GET", "/leaderboard");
    expect(r.status === 200 && Array.isArray(r.data?.leaderboard) && r.data.leaderboard.length <= 10, "leaderboard must give 200 with at most 10 rows");
    expect(r.data.leaderboard.every((x, i) => x.rank === i + 1 && Object.keys(x).sort().join() === "games_played,name,rank,win_rate,wins"), "rows need rank 1,2,3... and exactly: rank, name, games_played, wins, win_rate");
    r = await call("GET", "/leaderboard?limit=1");
    expect(r.status === 200 && r.data.leaderboard.length <= 1, "?limit=1 must give at most 1 row");
    r = await call("GET", "/leaderboard?limit=abc");
    expect(r.status === 200 && r.data.leaderboard.length <= 10, "?limit=abc must fall back to 10, not fail");

    r = await call("GET", "/players/httptest_a/stats");
    const need = "best_score,best_turn,biggest_bust,games_played,last_played_at,name,win_rate,wins";
    expect(r.status === 200 && r.data?.player?.games_played === 1, "stats for httptest_a must give 200 and 1 game, got " + r.status);
    expect(Object.keys(r.data?.player ?? {}).sort().join() === need, "stats fields must be exactly: " + need);
    r = await call("GET", "/players/httptest_a/history");
    expect(r.status === 200 && r.data?.history?.length === 1 && r.data.history[0].game_id === gameId && r.data.history[0].opponents?.length === 1, "history must give 200 with this game and one opponent");
    r = await call("GET", "/players/httptest_nobody/stats");
    expect(r.status === 404 && r.data?.error?.code === "PLAYER_NOT_FOUND", "unknown player stats must give 404 PLAYER_NOT_FOUND, got " + r.status);
    r = await call("GET", "/players/httptest_nobody/history");
    expect(r.status === 404 && r.data?.error?.code === "PLAYER_NOT_FOUND", "unknown player history must give 404 PLAYER_NOT_FOUND, got " + r.status);
    r = await call("GET", "/players/%20/stats");
    expect(r.status === 404 && r.data?.error?.code === "PLAYER_NOT_FOUND", "a blank player name must give 404 PLAYER_NOT_FOUND, got " + r.status);
  });
}

// ================================================================ finish
await cleanup();
await pool.end();
console.log(failed ? `\n${failed} section(s) failed` : "\nEVERYTHING OK");
process.exit(failed ? 1 : 0);