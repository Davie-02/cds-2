import pg from "pg";

// Return DATE columns as plain YYYY-MM-DD strings instead of shifting them into local midnight.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// Counts and sums come back as bigint strings; the amounts here comfortably fit in a number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(connectionString: string, ssl = false): Db {
  return new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
}

export async function inTransaction<T>(
  db: Db,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
