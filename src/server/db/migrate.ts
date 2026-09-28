import { pathToFileURL } from "node:url";
import { createPool, inTransaction, type Db } from "./pool.js";
import { MIGRATIONS } from "./migrations.js";

export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const pending = MIGRATIONS.filter((migration) => !applied.has(migration.name));

  for (const migration of pending) {
    await inTransaction(db, async (client) => {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
    });
  }
  return pending.map((migration) => migration.name);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = createPool(url, process.env.DATABASE_SSL === "true");
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date");
  await db.end();
}
