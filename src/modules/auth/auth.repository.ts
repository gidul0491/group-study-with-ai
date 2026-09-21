import { db } from "@shared/db/db";

export type AdminRow = {
  id: number;
  username: string;
  password_hash: string;
  recovery_question: string;
  recovery_answer_hash: string;
  created_at: string;
  updated_at: string;
};

export type AdminSessionRow = {
  id: string;
  admin_id: number;
  expires_at: string;
  created_at: string;
};

export function countAdmins(): number {
  const row = db().prepare("SELECT COUNT(*) AS n FROM admin").get() as { n: number };
  return row.n;
}

export function findAdminByUsername(username: string): AdminRow | null {
  return (db().prepare("SELECT * FROM admin WHERE username = ?").get(username) as AdminRow) ?? null;
}

export function findAdminById(id: number): AdminRow | null {
  return (db().prepare("SELECT * FROM admin WHERE id = ?").get(id) as AdminRow) ?? null;
}

export function insertAdmin(
  username: string,
  passwordHash: string,
  recoveryQuestion: string,
  recoveryAnswerHash: string,
  at: string,
): number {
  const r = db()
    .prepare(
      `INSERT INTO admin (username, password_hash, recovery_question, recovery_answer_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(username, passwordHash, recoveryQuestion, recoveryAnswerHash, at, at);
  return Number(r.lastInsertRowid);
}

export function updateAdminPassword(id: number, passwordHash: string, at: string): void {
  db()
    .prepare("UPDATE admin SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(passwordHash, at, id);
}

export function updateAdminRecovery(id: number, question: string, answerHash: string, at: string): void {
  db()
    .prepare("UPDATE admin SET recovery_question = ?, recovery_answer_hash = ?, updated_at = ? WHERE id = ?")
    .run(question, answerHash, at, id);
}

export function insertSession(id: string, adminId: number, expiresAt: string, at: string): void {
  db()
    .prepare(
      "INSERT INTO admin_session (id, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, adminId, expiresAt, at);
}

export function findSession(id: string): AdminSessionRow | null {
  return (db().prepare("SELECT * FROM admin_session WHERE id = ?").get(id) as AdminSessionRow) ?? null;
}

export function deleteSession(id: string): void {
  db().prepare("DELETE FROM admin_session WHERE id = ?").run(id);
}

export function deleteSessionsOfAdmin(adminId: number): void {
  db().prepare("DELETE FROM admin_session WHERE admin_id = ?").run(adminId);
}

export function deleteExpiredSessions(nowIso: string): void {
  db().prepare("DELETE FROM admin_session WHERE expires_at <= ?").run(nowIso);
}
