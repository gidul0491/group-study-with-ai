import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { env } from "@shared/config/env";
import { migrations } from "./migrations";

export type Row = Record<string, SQLInputValue>;

let instance: DatabaseSync | null = null;

/** 프로세스당 하나의 연결. 처음 열 때 마이그레이션을 적용한다. */
export function db(): DatabaseSync {
  if (instance) return instance;
  const file = env().dbPath;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  instance = openDatabase(file);
  return instance;
}

/** 테스트용: 임시 파일이나 메모리 DB를 열어 마이그레이션까지 적용한다. */
export function openDatabase(file: string): DatabaseSync {
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec("PRAGMA busy_timeout = 3000;");
  migrate(conn);
  return conn;
}

function migrate(conn: DatabaseSync): void {
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(
    (conn.prepare("SELECT name FROM schema_migration").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    conn.exec("BEGIN;");
    try {
      conn.exec(m.sql);
      conn
        .prepare("INSERT INTO schema_migration (name, applied_at) VALUES (?, ?)")
        .run(m.name, new Date().toISOString());
      conn.exec("COMMIT;");
    } catch (e) {
      conn.exec("ROLLBACK;");
      throw e;
    }
  }
}

/** 트랜잭션 안에서 fn을 실행한다. 중첩 호출은 바깥 트랜잭션에 합류한다. */
let depth = 0;
export function transaction<T>(fn: () => T, conn: DatabaseSync = db()): T {
  if (depth > 0) return fn();
  depth++;
  conn.exec("BEGIN IMMEDIATE;");
  try {
    const out = fn();
    conn.exec("COMMIT;");
    return out;
  } catch (e) {
    conn.exec("ROLLBACK;");
    throw e;
  } finally {
    depth--;
  }
}

/** 테스트에서 연결을 바꿔 끼울 때 쓴다. */
export function useDatabase(conn: DatabaseSync | null): void {
  instance = conn;
}
