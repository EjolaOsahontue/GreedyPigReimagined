import pg from "pg";
import "dotenv/config";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Handle database connection errors
pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

