import { db } from "@shared/db/db";

export type ParticipantRow = {
  id: number;
  round_id: number;
  mode: "SOLO" | "GROUP";
  secret: string;
  nickname: string;
  created_at: string;
};

export function insertParticipant(
  roundId: number,
  mode: "SOLO" | "GROUP",
  secret: string,
  nickname: string,
  at: string,
): number {
  const r = db()
    .prepare(
      "INSERT INTO participant (round_id, mode, secret, nickname, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(roundId, mode, secret, nickname, at);
  return Number(r.lastInsertRowid);
}

export function findParticipantBySecret(secret: string): ParticipantRow | null {
  return (
    (db().prepare("SELECT * FROM participant WHERE secret = ?").get(secret) as ParticipantRow) ??
    null
  );
}

export function findParticipantById(id: number): ParticipantRow | null {
  return (db().prepare("SELECT * FROM participant WHERE id = ?").get(id) as ParticipantRow) ?? null;
}

export function listNicknamesInRound(roundId: number): string[] {
  return (
    db().prepare("SELECT nickname FROM participant WHERE round_id = ?").all(roundId) as {
      nickname: string;
    }[]
  ).map((r) => r.nickname);
}
