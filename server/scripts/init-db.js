import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "..", "schema.sql"), "utf8");
const reset = process.argv.includes("--reset");

const DROP = `
  DROP TABLE IF EXISTS results, rolls, turns, game_players, games CASCADE;
  DROP TYPE  IF EXISTS turn_outcome, game_mode, game_status;
`;

try {
  if (reset) {
    console.log("Resetting: dropping existing tables...");
    await pool.query(DROP);
  }
  await pool.query(schema);
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1"
  );
  console.log("Done. Tables:", rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("Schema setup failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}