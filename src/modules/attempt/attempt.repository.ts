import { db } from "@shared/db/db";

export type SubmitKind = "MANUAL" | "TIMEOUT" | "LINK_CLOSED" | "GROUP_STARTED";

export type SoloAttemptRow = {
  id: number;
  round_id: number;
  participant_id: number;
  started_at: string;
  submitted_at: string | null;
  submit_kind: SubmitKind | null;
  correct_count: number | null;
  question_count: number | null;
  created_at: string;
  updated_at: string;
};

export type SoloAnswerRow = {
  id: number;
  attempt_id: number;
  question_id: number;
  choice_ids: string | null;
  text: string | null;
  updated_at: string;
};

export function insertAttempt(roundId: number, participantId: number, at: string): number {
  const r = db()
    .prepare(
      `INSERT INTO solo_attempt (round_id, participant_id, started_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(roundId, participantId, at, at, at);
  return Number(r.lastInsertRowid);
}

export function findAttemptByParticipant(participantId: number): SoloAttemptRow | null {
  return (
    (db()
      .prepare("SELECT * FROM solo_attempt WHERE participant_id = ?")
      .get(participantId) as SoloAttemptRow) ?? null
  );
}

export function findAttempt(id: number): SoloAttemptRow | null {
  return (db().prepare("SELECT * FROM solo_attempt WHERE id = ?").get(id) as SoloAttemptRow) ?? null;
}

export function listAttempts(roundId: number): SoloAttemptRow[] {
  return db()
    .prepare("SELECT * FROM solo_attempt WHERE round_id = ? ORDER BY id ASC")
    .all(roundId) as SoloAttemptRow[];
}

export function listOpenAttempts(roundId: number): SoloAttemptRow[] {
  return db()
    .prepare("SELECT * FROM solo_attempt WHERE round_id = ? AND submitted_at IS NULL")
    .all(roundId) as SoloAttemptRow[];
}

export function markSubmitted(
  id: number,
  kind: SubmitKind,
  correct: number,
  total: number,
  at: string,
): void {
  db()
    .prepare(
      `UPDATE solo_attempt
       SET submitted_at = ?, submit_kind = ?, correct_count = ?, question_count = ?, updated_at = ?
       WHERE id = ? AND submitted_at IS NULL`,
    )
    .run(at, kind, correct, total, at, id);
}

export function upsertAnswer(
  attemptId: number,
  questionId: number,
  choiceIds: number[] | null,
  text: string | null,
  at: string,
): void {
  db()
    .prepare(
      `INSERT INTO solo_answer (attempt_id, question_id, choice_ids, text, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id, question_id)
       DO UPDATE SET choice_ids = excluded.choice_ids, text = excluded.text, updated_at = excluded.updated_at`,
    )
    .run(attemptId, questionId, choiceIds ? JSON.stringify(choiceIds) : null, text, at);
}

export function listAnswers(attemptId: number): SoloAnswerRow[] {
  return db()
    .prepare("SELECT * FROM solo_answer WHERE attempt_id = ?")
    .all(attemptId) as SoloAnswerRow[];
}

/** 차시의 제출된 답안 전부 (통계용). */
export function listSubmittedAnswersInRound(roundId: number): SoloAnswerRow[] {
  return db()
    .prepare(
      `SELECT a.* FROM solo_answer a JOIN solo_attempt t ON t.id = a.attempt_id
       WHERE t.round_id = ? AND t.submitted_at IS NOT NULL`,
    )
    .all(roundId) as SoloAnswerRow[];
}

export type AttemptWithNickname = SoloAttemptRow & { nickname: string };

export function listAttemptsWithNickname(roundId: number): AttemptWithNickname[] {
  return db()
    .prepare(
      `SELECT t.*, p.nickname FROM solo_attempt t JOIN participant p ON p.id = t.participant_id
       WHERE t.round_id = ? ORDER BY t.id ASC`,
    )
    .all(roundId) as AttemptWithNickname[];
}

/** 협력풀이가 시작됐는지 (개인 신규 입장 차단 판단용). */
export function groupStartedAt(roundId: number): string | null {
  const row = db()
    .prepare("SELECT started_at FROM group_room WHERE round_id = ?")
    .get(roundId) as { started_at: string | null } | undefined;
  return row?.started_at ?? null;
}
