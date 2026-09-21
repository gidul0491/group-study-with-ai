import { db } from "@shared/db/db";

export type GroupSubmitKind = "MANUAL" | "TIMEOUT" | "LINK_CLOSED";

export type GroupRoomRow = {
  id: number;
  round_id: number;
  leader_participant_id: number | null;
  started_at: string | null;
  submitted_at: string | null;
  submit_kind: GroupSubmitKind | null;
  correct_count: number | null;
  question_count: number | null;
  created_at: string;
  updated_at: string;
};

export type RoomMemberRow = {
  id: number;
  room_id: number;
  participant_id: number;
  member_no: number;
  joined_at: string;
  last_seen_at: string;
};

export type MemberWithNickname = RoomMemberRow & { nickname: string };

export type GroupAnswerRow = {
  id: number;
  room_id: number;
  question_id: number;
  choice_ids: string | null;
  text: string | null;
  updated_at: string;
};

export function findRoomByRound(roundId: number): GroupRoomRow | null {
  return (
    (db().prepare("SELECT * FROM group_room WHERE round_id = ?").get(roundId) as GroupRoomRow) ??
    null
  );
}

export function findRoom(id: number): GroupRoomRow | null {
  return (db().prepare("SELECT * FROM group_room WHERE id = ?").get(id) as GroupRoomRow) ?? null;
}

export function insertRoom(roundId: number, at: string): number {
  const r = db()
    .prepare("INSERT INTO group_room (round_id, created_at, updated_at) VALUES (?, ?, ?)")
    .run(roundId, at, at);
  return Number(r.lastInsertRowid);
}

export function updateLeader(roomId: number, participantId: number | null, at: string): void {
  db()
    .prepare("UPDATE group_room SET leader_participant_id = ?, updated_at = ? WHERE id = ?")
    .run(participantId, at, roomId);
}

export function markStarted(roomId: number, at: string): void {
  db()
    .prepare("UPDATE group_room SET started_at = ?, updated_at = ? WHERE id = ? AND started_at IS NULL")
    .run(at, at, roomId);
}

export function markRoomSubmitted(
  roomId: number,
  kind: GroupSubmitKind,
  correct: number,
  total: number,
  at: string,
): void {
  db()
    .prepare(
      `UPDATE group_room
       SET submitted_at = ?, submit_kind = ?, correct_count = ?, question_count = ?, updated_at = ?
       WHERE id = ? AND submitted_at IS NULL`,
    )
    .run(at, kind, correct, total, at, roomId);
}

export function insertMember(roomId: number, participantId: number, memberNo: number, at: string): number {
  const r = db()
    .prepare(
      `INSERT INTO room_member (room_id, participant_id, member_no, joined_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(roomId, participantId, memberNo, at, at);
  return Number(r.lastInsertRowid);
}

export function maxMemberNo(roomId: number): number {
  return (
    db().prepare("SELECT COALESCE(MAX(member_no), 0) AS n FROM room_member WHERE room_id = ?").get(roomId) as {
      n: number;
    }
  ).n;
}

export function findMemberByParticipant(participantId: number): RoomMemberRow | null {
  return (
    (db()
      .prepare("SELECT * FROM room_member WHERE participant_id = ?")
      .get(participantId) as RoomMemberRow) ?? null
  );
}

export function listMembers(roomId: number): MemberWithNickname[] {
  return db()
    .prepare(
      `SELECT m.*, p.nickname FROM room_member m JOIN participant p ON p.id = m.participant_id
       WHERE m.room_id = ? ORDER BY m.member_no ASC`,
    )
    .all(roomId) as MemberWithNickname[];
}

export function touchMember(participantId: number, at: string): void {
  db().prepare("UPDATE room_member SET last_seen_at = ? WHERE participant_id = ?").run(at, participantId);
}

export function upsertGroupAnswer(
  roomId: number,
  questionId: number,
  choiceIds: number[] | null,
  text: string | null,
  at: string,
): void {
  db()
    .prepare(
      `INSERT INTO group_answer (room_id, question_id, choice_ids, text, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(room_id, question_id)
       DO UPDATE SET choice_ids = excluded.choice_ids, text = excluded.text, updated_at = excluded.updated_at`,
    )
    .run(roomId, questionId, choiceIds ? JSON.stringify(choiceIds) : null, text, at);
}

export function listGroupAnswers(roomId: number): GroupAnswerRow[] {
  return db().prepare("SELECT * FROM group_answer WHERE room_id = ?").all(roomId) as GroupAnswerRow[];
}
