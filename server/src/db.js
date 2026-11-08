import pg from "pg";
import "dotenv/config";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  idleTimeoutMillis: 10000, 
});

pool.on("error", (err) => {
  console.error("Idle database connection error:", err.message);
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  let broken = null;
  const onError = (err) => {
    broken = err;
    console.error("Connection error in transaction:", err.message);
  };
  client.on("error", onError);
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    if (!broken) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    throw e;
  } finally {
    client.removeListener("error", onError);
    client.release(broken || undefined);
  }
}