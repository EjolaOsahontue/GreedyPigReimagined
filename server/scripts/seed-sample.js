// Plays a few complete games through the real game rules, with scripted dice, so the
// leaderboard has something to rank.
//   npm run seed          -> remove old sample games, then create fresh ones
//   npm run seed:clean    -> remove the sample games only
// Sample players are named seed_ada, seed_bola and seed_chi. Nothing else is touched.
// WARNING: this writes to the database DATABASE_URL points to (your live Neon database).
import { pool, withTransaction } from "../src/db.js";
import { createGame, roll, bank, doubleDown } from "../src/gameService.js";

const T = (fn) => withTransaction(fn);
const R = (n) => ["roll", n];

// Each game: who sits where, and the exact moves. The last move must be a winning roll.
const GAMES = [
  { names: ["seed_ada", "seed_bola"], moves: [R(6), R(6), R(6), R(6), R(6)] },                                   // ada wins
  { names: ["seed_ada", "seed_bola"], moves: [R(5), ["bank"], R(1), ["dd"], R(3), R(3), R(3), R(3)] },              // ada wins with Double Down (5 banked + 12 doubled = 29)
  { names: ["seed_bola", "seed_ada"], moves: [R(6), R(6), R(6), R(6), R(6)] },                                   // bola wins
  { names: ["seed_ada", "seed_chi"],  moves: [["dd"], R(4), R(1), R(6), R(6), R(6), R(6), R(6)] },               // ada busts a Double Down, chi wins
  { names: ["seed_bola", "seed_chi"], moves: [R(5), ["bank"], R(3), R(1), R(6), R(6), R(6), R(6)] },             // bola wins
  { names: ["seed_chi", "seed_ada"],  moves: [["bank"], R(6), R(6), R(6), R(6), R(6)] },                         // ada wins
];

async function clean() {
  const { rows } = await pool.query(
    "SELECT DISTINCT game_id FROM game_players WHERE display_name LIKE 'seed\\_%'"
  );
  const ids = rows.map((r) => r.game_id);
  if (ids.length) {
    await pool.query("UPDATE games SET winner_player_id = NULL WHERE id = ANY($1)", [ids]);
    for (const table of ["results", "rolls", "turns", "game_players"]) {
      await pool.query(`DELETE FROM ${table} WHERE game_id = ANY($1)`, [ids]);
    }
    await pool.query("DELETE FROM games WHERE id = ANY($1)", [ids]);
  }
  return ids.length;
}

try {
  console.log("Removed", await clean(), "old sample games");
  if (!process.argv.includes("--clean")) {
    for (const [i, g] of GAMES.entries()) {
      let game = await T((tx) => createGame(tx, {
        players: g.names.map((name, k) => ({ name, pig_index: k })),
        target_score: 25,
      }));
      for (const [action, n] of g.moves) {
        const die = () => n;
        if (action === "roll") game = (await T((tx) => roll(tx, game.id, die))).game;
        else if (action === "bank") game = (await T((tx) => bank(tx, game.id))).game;
        else if (action === "dd") game = (await T((tx) => doubleDown(tx, game.id))).game;
      }
      const winner = game.players.find((p) => p.id === game.winner_id);
      console.log(`Game ${i + 1}: ${game.status}, winner ${winner?.name}`);
    }
  }
} finally {
  await pool.end();
}