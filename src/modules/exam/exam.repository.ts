import { db } from "@shared/db/db";

export type ExamRow = {
  id: number;
  admin_id: number;
  title: string;
  common_prompt: string;
  created_at: string;
  updated_at: string;
};

export type RoundRow = {
  id: number;
  exam_id: number;
  round_no: number;
  starts_at: string;
  ends_at: string;
  solo_limit_min: number;
  group_limit_min: number;
  created_at: string;
  updated_at: string;
};

export type SourceKind = "MD" | "PDF" | "TEXT";

export type SourceRow = {
  id: number;
  round_id: number;
  seq: number;
  kind: SourceKind;
  file_name: string | null;
  content: string;
  short_count: number;
  multiple_count: number;
  choice_count: number;
  max_answer_count: number;
  created_at: string;
};

export type QuestionType = "SHORT" | "MULTIPLE";

export type QuestionRow = {
  id: number;
  round_id: number;
  source_id: number;
  seq: number;
  type: QuestionType;
  text: string;
  explanation: string;
  created_at: string;
};

export type ChoiceRow = {
  id: number;
  question_id: number;
  seq: number;
  text: string;
  is_answer: number;
};

export type ShortAnswerRow = {
  id: number;
  question_id: number;
  seq: number;
  text: string;
};

export type LinkMode = "SOLO" | "GROUP";

export type AccessLinkRow = {
  id: number;
  round_id: number;
  mode: LinkMode;
  token: string;
  is_open: number;
  created_at: string;
  updated_at: string;
};

export type GenerationLogRow = {
  id: number;
  round_id: number | null;
  source_id: number | null;
  model: string;
  request_summary: string;
  response_json: string | null;
  duration_ms: number;
  error: string | null;
  created_at: string;
};

// ---------- exam ----------

export function insertExam(adminId: number, title: string, commonPrompt: string, at: string): number {
  const r = db()
    .prepare("INSERT INTO exam (admin_id, title, common_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(adminId, title, commonPrompt, at, at);
  return Number(r.lastInsertRowid);
}

export function findExam(id: number): ExamRow | null {
  return (db().prepare("SELECT * FROM exam WHERE id = ?").get(id) as ExamRow) ?? null;
}

export function listExams(adminId: number): ExamRow[] {
  return db().prepare("SELECT * FROM exam WHERE admin_id = ? ORDER BY id DESC").all(adminId) as ExamRow[];
}

/** 차시 → 시험지 id. 소유자 확인용. */
export function examIdOfRound(roundId: number): number | null {
  const row = db().prepare("SELECT exam_id FROM round WHERE id = ?").get(roundId) as { exam_id: number } | undefined;
  return row?.exam_id ?? null;
}

/** 링크 → 시험지 id. 소유자 확인용. */
export function examIdOfLink(linkId: number): number | null {
  const row = db()
    .prepare("SELECT r.exam_id FROM access_link l JOIN round r ON r.id = l.round_id WHERE l.id = ?")
    .get(linkId) as { exam_id: number } | undefined;
  return row?.exam_id ?? null;
}

export function touchExam(id: number, at: string): void {
  db().prepare("UPDATE exam SET updated_at = ? WHERE id = ?").run(at, id);
}

export function deleteExam(id: number): void {
  db().prepare("DELETE FROM exam WHERE id = ?").run(id);
}

// ---------- round ----------

export function insertRound(
  examId: number,
  roundNo: number,
  startsAt: string,
  endsAt: string,
  soloLimitMin: number,
  groupLimitMin: number,
  at: string,
): number {
  const r = db()
    .prepare(
      `INSERT INTO round (exam_id, round_no, starts_at, ends_at, solo_limit_min, group_limit_min, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(examId, roundNo, startsAt, endsAt, soloLimitMin, groupLimitMin, at, at);
  return Number(r.lastInsertRowid);
}

export function findRound(id: number): RoundRow | null {
  return (db().prepare("SELECT * FROM round WHERE id = ?").get(id) as RoundRow) ?? null;
}

export function listRounds(examId: number): RoundRow[] {
  return db()
    .prepare("SELECT * FROM round WHERE exam_id = ? ORDER BY round_no ASC")
    .all(examId) as RoundRow[];
}

export function findLatestRound(examId: number): RoundRow | null {
  return (
    (db()
      .prepare("SELECT * FROM round WHERE exam_id = ? ORDER BY round_no DESC LIMIT 1")
      .get(examId) as RoundRow) ?? null
  );
}

export function maxRoundNo(examId: number): number {
  const row = db()
    .prepare("SELECT COALESCE(MAX(round_no), 0) AS n FROM round WHERE exam_id = ?")
    .get(examId) as { n: number };
  return row.n;
}

export function updateRoundTimes(
  id: number,
  startsAt: string,
  endsAt: string,
  soloLimitMin: number,
  groupLimitMin: number,
  at: string,
): void {
  db()
    .prepare(
      `UPDATE round SET starts_at = ?, ends_at = ?, solo_limit_min = ?, group_limit_min = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(startsAt, endsAt, soloLimitMin, groupLimitMin, at, id);
}

export function deleteRound(id: number): void {
  db().prepare("DELETE FROM round WHERE id = ?").run(id);
}

export function countRounds(examId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM round WHERE exam_id = ?").get(examId) as { n: number }).n;
}

export function countParticipantsInRound(roundId: number): number {
  return (
    db().prepare("SELECT COUNT(*) AS n FROM participant WHERE round_id = ?").get(roundId) as {
      n: number;
    }
  ).n;
}

export function countParticipantsInExam(examId: number): number {
  return (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM participant p JOIN round r ON r.id = p.round_id WHERE r.exam_id = ?`,
      )
      .get(examId) as { n: number }
  ).n;
}

// ---------- source ----------

export function insertSource(s: Omit<SourceRow, "id">): number {
  const r = db()
    .prepare(
      `INSERT INTO source (round_id, seq, kind, file_name, content, short_count, multiple_count, choice_count, max_answer_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      s.round_id,
      s.seq,
      s.kind,
      s.file_name,
      s.content,
      s.short_count,
      s.multiple_count,
      s.choice_count,
      s.max_answer_count,
      s.created_at,
    );
  return Number(r.lastInsertRowid);
}

export function findSource(id: number): SourceRow | null {
  return (db().prepare("SELECT * FROM source WHERE id = ?").get(id) as SourceRow) ?? null;
}

export function listSources(roundId: number): SourceRow[] {
  return db()
    .prepare("SELECT * FROM source WHERE round_id = ? ORDER BY seq ASC")
    .all(roundId) as SourceRow[];
}

export function deleteSource(id: number): void {
  db().prepare("DELETE FROM source WHERE id = ?").run(id);
}

// ---------- question ----------

export function insertQuestion(q: Omit<QuestionRow, "id">): number {
  const r = db()
    .prepare(
      `INSERT INTO question (round_id, source_id, seq, type, text, explanation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(q.round_id, q.source_id, q.seq, q.type, q.text, q.explanation, q.created_at);
  return Number(r.lastInsertRowid);
}

export function findQuestion(id: number): QuestionRow | null {
  return (db().prepare("SELECT * FROM question WHERE id = ?").get(id) as QuestionRow) ?? null;
}

export function listQuestions(roundId: number): QuestionRow[] {
  return db()
    .prepare("SELECT * FROM question WHERE round_id = ? ORDER BY seq ASC")
    .all(roundId) as QuestionRow[];
}

export function listQuestionsBySource(sourceId: number): QuestionRow[] {
  return db()
    .prepare("SELECT * FROM question WHERE source_id = ? ORDER BY seq ASC")
    .all(sourceId) as QuestionRow[];
}

export function countQuestions(roundId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM question WHERE round_id = ?").get(roundId) as { n: number }).n;
}

export function maxQuestionSeq(roundId: number): number {
  return (
    db().prepare("SELECT COALESCE(MAX(seq), 0) AS n FROM question WHERE round_id = ?").get(roundId) as {
      n: number;
    }
  ).n;
}

export function deleteQuestion(id: number): void {
  db().prepare("DELETE FROM question WHERE id = ?").run(id);
}

export function updateQuestionSeq(id: number, seq: number): void {
  db().prepare("UPDATE question SET seq = ? WHERE id = ?").run(seq, id);
}

export function insertChoice(questionId: number, seq: number, text: string, isAnswer: boolean): number {
  const r = db()
    .prepare("INSERT INTO choice (question_id, seq, text, is_answer) VALUES (?, ?, ?, ?)")
    .run(questionId, seq, text, isAnswer ? 1 : 0);
  return Number(r.lastInsertRowid);
}

export function listChoices(roundId: number): ChoiceRow[] {
  return db()
    .prepare(
      `SELECT c.* FROM choice c JOIN question q ON q.id = c.question_id
       WHERE q.round_id = ? ORDER BY q.seq, c.seq`,
    )
    .all(roundId) as ChoiceRow[];
}

export function listChoicesOfQuestion(questionId: number): ChoiceRow[] {
  return db()
    .prepare("SELECT * FROM choice WHERE question_id = ? ORDER BY seq ASC")
    .all(questionId) as ChoiceRow[];
}

export function insertShortAnswer(questionId: number, seq: number, text: string): number {
  const r = db()
    .prepare("INSERT INTO short_answer (question_id, seq, text) VALUES (?, ?, ?)")
    .run(questionId, seq, text);
  return Number(r.lastInsertRowid);
}

export function listShortAnswers(roundId: number): ShortAnswerRow[] {
  return db()
    .prepare(
      `SELECT s.* FROM short_answer s JOIN question q ON q.id = s.question_id
       WHERE q.round_id = ? ORDER BY q.seq, s.seq`,
    )
    .all(roundId) as ShortAnswerRow[];
}

export function listShortAnswersOfQuestion(questionId: number): ShortAnswerRow[] {
  return db()
    .prepare("SELECT * FROM short_answer WHERE question_id = ? ORDER BY seq ASC")
    .all(questionId) as ShortAnswerRow[];
}

// ---------- access_link ----------

export function insertLink(roundId: number, mode: LinkMode, token: string, at: string): number {
  const r = db()
    .prepare(
      `INSERT INTO access_link (round_id, mode, token, is_open, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    )
    .run(roundId, mode, token, at, at);
  return Number(r.lastInsertRowid);
}

export function findLink(id: number): AccessLinkRow | null {
  return (db().prepare("SELECT * FROM access_link WHERE id = ?").get(id) as AccessLinkRow) ?? null;
}

export function findLinkByToken(token: string): AccessLinkRow | null {
  return (
    (db().prepare("SELECT * FROM access_link WHERE token = ?").get(token) as AccessLinkRow) ?? null
  );
}

export function findLinkByRoundMode(roundId: number, mode: LinkMode): AccessLinkRow | null {
  return (
    (db()
      .prepare("SELECT * FROM access_link WHERE round_id = ? AND mode = ?")
      .get(roundId, mode) as AccessLinkRow) ?? null
  );
}

export function listLinks(roundId: number): AccessLinkRow[] {
  return db()
    .prepare("SELECT * FROM access_link WHERE round_id = ? ORDER BY mode")
    .all(roundId) as AccessLinkRow[];
}

export function updateLinkOpen(id: number, open: boolean, at: string): void {
  db()
    .prepare("UPDATE access_link SET is_open = ?, updated_at = ? WHERE id = ?")
    .run(open ? 1 : 0, at, id);
}

export function updateLinkToken(id: number, token: string, at: string): void {
  db().prepare("UPDATE access_link SET token = ?, updated_at = ? WHERE id = ?").run(token, at, id);
}

// ---------- generation_log ----------

export function insertGenerationLog(l: Omit<GenerationLogRow, "id">): number {
  const r = db()
    .prepare(
      `INSERT INTO generation_log (round_id, source_id, model, request_summary, response_json, duration_ms, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      l.round_id,
      l.source_id,
      l.model,
      l.request_summary,
      l.response_json,
      l.duration_ms,
      l.error,
      l.created_at,
    );
  return Number(r.lastInsertRowid);
}

export function findLatestLogForSource(sourceId: number): GenerationLogRow | null {
  return (
    (db()
      .prepare("SELECT * FROM generation_log WHERE source_id = ? ORDER BY id DESC LIMIT 1")
      .get(sourceId) as GenerationLogRow) ?? null
  );
}
