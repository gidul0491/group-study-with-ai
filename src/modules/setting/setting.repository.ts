import { db } from "@shared/db/db";

export function findSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM setting WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function upsertSetting(key: string, value: string, at: string): void {
  db()
    .prepare(
      `INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, at);
}
