import { SETTINGS_GROUPS, type Settings, type SettingsGroupName } from "../../shared/settings.js";
import { validate } from "../../shared/validation.js";
import { DEFAULT_SETTINGS } from "../content/defaults.js";
import { inTransaction, type Db, type Queryable } from "../db/pool.js";
import { badRequest, notFound } from "../errors.js";
import { recordActivity, type Actor } from "./audit.js";

export function isSettingsGroup(name: string): name is SettingsGroupName {
  return Object.hasOwn(SETTINGS_GROUPS, name);
}

/**
 * Saved values override the defaults key by key, so settings added in a later release still
 * have a value. A saved empty value is kept: clearing a field is a deliberate choice.
 */
export async function loadSettings(db: Queryable): Promise<Settings> {
  const { rows } = await db.query<{ group_name: string; data: Record<string, unknown> }>(
    "SELECT group_name, data FROM settings",
  );
  const saved = new Map(rows.map((row) => [row.group_name, row.data]));
  const merged = {} as Settings;
  for (const group of Object.keys(SETTINGS_GROUPS) as SettingsGroupName[]) {
    merged[group] = { ...DEFAULT_SETTINGS[group], ...saved.get(group) };
  }
  return merged;
}

export async function saveSettingsGroup(
  db: Db,
  group: string,
  input: unknown,
  actor: Actor,
): Promise<Record<string, unknown>> {
  if (!isSettingsGroup(group)) throw notFound("Settings group");
  const result = validate(SETTINGS_GROUPS[group].fields, input, "create");
  if (!result.ok) throw badRequest("Please correct the highlighted fields", result.errors);

  return inTransaction(db, async (client) => {
    const before = (await loadSettings(client))[group];
    await writeSettingsGroup(client, group, result.data);
    await recordActivity(client, actor, {
      action: "update",
      resource: "settings",
      recordId: group,
      summary: `Changed ${SETTINGS_GROUPS[group].label.toLowerCase()} settings`,
      before,
      after: result.data,
    });
    return (await loadSettings(client))[group];
  });
}

export async function writeSettingsGroup(
  db: Queryable,
  group: string,
  data: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO settings (group_name, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (group_name) DO UPDATE SET data = excluded.data, updated_at = now()`,
    [group, JSON.stringify(data)],
  );
}
