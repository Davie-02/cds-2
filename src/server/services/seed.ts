import { inTransaction, type Db, type Queryable } from "../db/pool.js";
import * as defaults from "../content/defaults.js";
import { hashPassword } from "./passwords.js";

const SEEDED_KEY = "content_seeded";

async function insertRows(
  db: Queryable,
  table: string,
  rows: readonly Record<string, unknown>[],
  sortable = true,
) {
  for (const [index, row] of rows.entries()) {
    const data: Record<string, unknown> = sortable ? { position: index, ...row } : { ...row };
    const columns = Object.keys(data);
    await db.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
      columns.map((column) => toParam(data[column])),
    );
  }
}

function toParam(value: unknown): unknown {
  const isJsonObject = typeof value === "object" && value !== null && !isStringArray(value);
  return isJsonObject ? JSON.stringify(value) : value;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Inserts the default content the first time the app starts against an empty database. */
export async function seedDefaultContent(db: Db): Promise<boolean> {
  return inTransaction(db, async (client) => {
    await client.query("LOCK TABLE meta IN EXCLUSIVE MODE");
    const { rows } = await client.query("SELECT 1 FROM meta WHERE key = $1", [SEEDED_KEY]);
    if (rows.length) return false;

    for (const page of defaults.DEFAULT_PAGES) {
      const { sections, ...fields } = page;
      const { rows: inserted } = await client.query<{ id: string }>(
        `INSERT INTO pages (slug, title, seo_title, seo_description, published, is_system)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          fields.slug,
          fields.title,
          fields.seo_title ?? null,
          fields.seo_description ?? null,
          fields.published ?? true,
          fields.is_system ?? false,
        ],
      );
      const pageId = inserted[0]!.id;
      await insertRows(
        client,
        "sections",
        sections.map((section) => ({
          page_id: pageId,
          type: section.type,
          content: section.content,
        })),
      );
    }

    await insertRows(client, "menu_items", defaults.DEFAULT_MENU);
    await insertRows(client, "branches", defaults.DEFAULT_BRANCHES);
    await insertRows(client, "courses", defaults.DEFAULT_COURSES);
    await insertRows(client, "instructors", defaults.DEFAULT_INSTRUCTORS);
    await insertRows(client, "faqs", defaults.DEFAULT_FAQS);
    await insertRows(client, "testimonials", defaults.DEFAULT_TESTIMONIALS);
    await insertRows(client, "gallery_items", defaults.DEFAULT_GALLERY);
    await insertRows(client, "skills", defaults.DEFAULT_SKILLS);
    await insertRows(client, "theory_tests", defaults.DEFAULT_THEORY_TESTS);
    await insertRows(client, "posts", defaults.DEFAULT_POSTS, false);
    await insertRows(client, "notices", defaults.DEFAULT_NOTICES, false);
    await insertRows(client, "questions", defaults.DEFAULT_QUESTIONS, false);

    await client.query("INSERT INTO meta (key, value) VALUES ($1, $2)", [
      SEEDED_KEY,
      JSON.stringify(new Date()),
    ]);
    return true;
  });
}

/** Creates the first owner account from environment variables when no owner exists yet. */
export async function ensureOwner(
  db: Db,
  owner: { email?: string; password?: string; name: string },
): Promise<"created" | "exists" | "missing-config"> {
  const { rows } = await db.query(
    "SELECT 1 FROM users WHERE role = 'owner' AND deleted_at IS NULL LIMIT 1",
  );
  if (rows.length) return "exists";
  if (!owner.email || !owner.password) return "missing-config";
  await db.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, lower($2), $3, 'owner')",
    [owner.name, owner.email, await hashPassword(owner.password)],
  );
  return "created";
}
