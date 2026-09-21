import { transaction } from "@shared/db/db";
import { badRequest, forbidden, notFound } from "@shared/lib/errors";
import { publish } from "@shared/lib/event-bus";
import { addMinutes, minIso, nowIso } from "@shared/lib/time";
import * as examRepo from "@modules/exam/exam.repository";
import { getRoundQuestions, toPublic, type PublicQuestion, type QuestionView } from "@modules/exam/question.view";
import * as participantService from "@modules/participant/participant.service";
import * as repo from "./attempt.repository";
import { grade, parseChoiceIds, scorePercent, type AnswerMap } from "./grading";

export function soloChannel(roundId: number): string {
  return `round:${roundId}:solo`;
}

export type AnswerView = { choiceIds: number[]; text: string };

export type ResultView = {
  correct: number;
  total: number;
  scorePct: number;
  perQuestion: {
    questionId: number;
    answered: boolean;
    correct: boolean;
    answerChoiceIds: number[];
    answerTexts: string[];
    explanation: string;
  }[];
};

export type SoloState = {
  examTitle: string;
  roundNo: number;
  participantId: number;
  nickname: string;
  questions: PublicQuestion[];
  answers: Record<number, AnswerView>;
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  submitted: boolean;
  submitKind: repo.SubmitKind | null;
  result: ResultView | null;
};

export type EntryDenied = {
  reason: "LINK_CLOSED" | "NOT_STARTED" | "ENDED" | "GROUP_STARTED" | "NOT_FOUND";
  message: string;
  examTitle?: string;
  startsAt?: string;
};

export function deadlineOf(round: examRepo.RoundRow, startedAt: string): string {
  return minIso(addMinutes(startedAt, round.solo_limit_min), round.ends_at);
}

/**
 * 개인풀이 입장. 쿠키(secret)로 기존 응시를 이어가거나 새 응시를 만든다.
 * 새로 만들면 participant를 함께 돌려주어 쿠키를 심게 한다.
 */
export function enterSolo(
  token: string,
  secret: string | undefined,
): { state: SoloState; newParticipant: participantService.Participant | null } {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "SOLO") throw notFound("링크를 찾을 수 없습니다.");
  const round = examRepo.findRound(link.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  const at = nowIso();

  const existing = participantService.findParticipant(secret, round.id, "SOLO");
  if (existing) {
    finalizeDue(round);
    return { state: buildState(exam, round, existing), newParticipant: null };
  }

  if (!link.is_open) throw forbidden("닫힌 링크입니다.", "LINK_CLOSED");
  if (at < round.starts_at) throw forbidden("아직 시험 시작 전입니다.", "NOT_STARTED");
  if (at >= round.ends_at) throw forbidden("시험이 종료되었습니다.", "ENDED");
  if (repo.groupStartedAt(round.id)) {
    throw forbidden("협력풀이가 시작되어 개인풀이에 새로 들어갈 수 없습니다.", "GROUP_STARTED");
  }

  const participant = transaction(() => {
    const p = participantService.createParticipant(round.id, "SOLO");
    repo.insertAttempt(round.id, p.id, at);
    return p;
  });
  publish(soloChannel(round.id), { type: "entered" });
  return { state: buildState(exam, round, participant), newParticipant: participant };
}

/** 링크 정보만 (입장 거부 화면용). */
export function describeSoloLink(token: string): { examTitle: string; roundNo: number; startsAt: string; endsAt: string } | null {
  const link = examRepo.findLinkByToken(token);
  if (!link) return null;
  const round = examRepo.findRound(link.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  return { examTitle: exam.title, roundNo: round.round_no, startsAt: round.starts_at, endsAt: round.ends_at };
}

export function getSoloState(token: string, secret: string | undefined): SoloState {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "SOLO") throw notFound("링크를 찾을 수 없습니다.");
  const round = examRepo.findRound(link.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  const p = participantService.findParticipant(secret, round.id, "SOLO");
  if (!p) throw forbidden("응시 정보가 없습니다. 링크로 다시 들어오세요.", "NO_PARTICIPANT");
  finalizeDue(round);
  return buildState(exam, round, p);
}

function buildState(
  exam: examRepo.ExamRow,
  round: examRepo.RoundRow,
  p: participantService.Participant,
): SoloState {
  const attempt = repo.findAttemptByParticipant(p.id);
  if (!attempt) throw notFound("응시 기록이 없습니다.");
  const questions = getRoundQuestions(round.id);
  const answers = answerMapOf(attempt.id);
  const submitted = attempt.submitted_at !== null;
  return {
    examTitle: exam.title,
    roundNo: round.round_no,
    participantId: p.id,
    nickname: p.nickname,
    questions: questions.map(toPublic),
    answers: toAnswerRecord(answers),
    startedAt: attempt.started_at,
    deadlineAt: deadlineOf(round, attempt.started_at),
    serverNow: nowIso(),
    submitted,
    submitKind: attempt.submit_kind,
    result: submitted ? buildResult(questions, answers, attempt.correct_count, attempt.question_count) : null,
  };
}

export function buildResult(
  questions: QuestionView[],
  answers: AnswerMap,
  correctCount: number | null,
  questionCount: number | null,
): ResultView {
  const g = grade(questions, answers);
  return {
    correct: correctCount ?? g.correct,
    total: questionCount ?? g.total,
    scorePct: scorePercent(correctCount ?? g.correct, questionCount ?? g.total),
    perQuestion: questions.map((q, i) => ({
      questionId: q.id,
      answered: g.perQuestion[i].answered,
      correct: g.perQuestion[i].correct,
      answerChoiceIds: q.choices.filter((c) => c.isAnswer).map((c) => c.id),
      answerTexts: q.answers,
      explanation: q.explanation,
    })),
  };
}

function answerMapOf(attemptId: number): AnswerMap {
  const map: AnswerMap = new Map();
  for (const a of repo.listAnswers(attemptId)) {
    map.set(a.question_id, { choiceIds: parseChoiceIds(a.choice_ids), text: a.text });
  }
  return map;
}

export function toAnswerRecord(map: AnswerMap): Record<number, AnswerView> {
  const out: Record<number, AnswerView> = {};
  for (const [qid, a] of map) out[qid] = { choiceIds: a.choiceIds ?? [], text: a.text ?? "" };
  return out;
}

/** 답 저장. 제출됐거나 마감이 지났거나 링크가 닫혔으면 거부. */
export function saveSoloAnswer(
  token: string,
  secret: string | undefined,
  questionId: number,
  answer: { choiceIds?: number[]; text?: string },
): void {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "SOLO") throw notFound("링크를 찾을 수 없습니다.");
  if (!link.is_open) throw forbidden("닫힌 링크입니다.", "LINK_CLOSED");
  const round = examRepo.findRound(link.round_id)!;
  const p = participantService.findParticipant(secret, round.id, "SOLO");
  if (!p) throw forbidden("응시 정보가 없습니다.", "NO_PARTICIPANT");
  finalizeDue(round);
  const attempt = repo.findAttemptByParticipant(p.id)!;
  if (attempt.submitted_at) throw forbidden("이미 제출되었습니다.", "ALREADY_SUBMITTED");
  const q = examRepo.findQuestion(questionId);
  if (!q || q.round_id !== round.id) throw notFound("문제를 찾을 수 없습니다.");
  const normalized = normalizeAnswerInput(q, answer);
  repo.upsertAnswer(attempt.id, q.id, normalized.choiceIds, normalized.text, nowIso());
}

export function normalizeAnswerInput(
  q: examRepo.QuestionRow,
  answer: { choiceIds?: number[]; text?: string },
): { choiceIds: number[] | null; text: string | null } {
  if (q.type === "MULTIPLE") {
    const valid = new Set(examRepo.listChoicesOfQuestion(q.id).map((c) => c.id));
    const source = examRepo.findSource(q.source_id);
    const max = source?.max_answer_count ?? 1;
    const ids = Array.from(new Set((answer.choiceIds ?? []).map(Number))).filter((id) => valid.has(id));
    if (ids.length > max) throw badRequest(`정답은 최대 ${max}개까지 고를 수 있습니다.`);
    return { choiceIds: ids, text: null };
  }
  const text = (answer.text ?? "").slice(0, 200);
  return { choiceIds: null, text };
}

export function submitSolo(token: string, secret: string | undefined): SoloState {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "SOLO") throw notFound("링크를 찾을 수 없습니다.");
  const round = examRepo.findRound(link.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  const p = participantService.findParticipant(secret, round.id, "SOLO");
  if (!p) throw forbidden("응시 정보가 없습니다.", "NO_PARTICIPANT");
  finalizeDue(round);
  const attempt = repo.findAttemptByParticipant(p.id)!;
  if (!attempt.submitted_at) finalizeAttempt(round, attempt, "MANUAL");
  return buildState(exam, round, p);
}

function finalizeAttempt(round: examRepo.RoundRow, attempt: repo.SoloAttemptRow, kind: repo.SubmitKind): void {
  const questions = getRoundQuestions(round.id);
  const g = grade(questions, answerMapOf(attempt.id));
  repo.markSubmitted(attempt.id, kind, g.correct, g.total, nowIso());
  publish(soloChannel(round.id), { type: "submitted" });
}

/** 마감(제한시간·종료시각)이 지난 응시를 자동 제출한다. 상태를 읽을 때마다 부른다. */
export function finalizeDue(round: examRepo.RoundRow): void {
  const at = nowIso();
  for (const a of repo.listOpenAttempts(round.id)) {
    if (deadlineOf(round, a.started_at) <= at) finalizeAttempt(round, a, "TIMEOUT");
  }
}

/** 링크 닫힘·협력 시작 등으로 풀이 중인 응시를 전부 제출 처리한다. */
export function finalizeSoloAttempts(roundId: number, kind: repo.SubmitKind): number {
  const round = examRepo.findRound(roundId);
  if (!round) return 0;
  const open = repo.listOpenAttempts(roundId);
  for (const a of open) finalizeAttempt(round, a, kind);
  return open.length;
}

// ---------- 결과·통계 ----------

export type SoloProgress = { total: number; done: number; allDone: boolean };

export function soloProgress(round: examRepo.RoundRow): SoloProgress {
  finalizeDue(round);
  const attempts = repo.listAttempts(round.id);
  const done = attempts.filter((a) => a.submitted_at !== null).length;
  return { total: attempts.length, done, allDone: done === attempts.length };
}

export type ParticipantScore = {
  participantId: number;
  nickname: string;
  startedAt: string;
  submittedAt: string | null;
  submitKind: repo.SubmitKind | null;
  correct: number | null;
  total: number | null;
  scorePct: number | null;
};

export function participantScores(roundId: number): ParticipantScore[] {
  const round = examRepo.findRound(roundId);
  if (round) finalizeDue(round);
  return repo.listAttemptsWithNickname(roundId).map((a) => ({
    participantId: a.participant_id,
    nickname: a.nickname,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    submitKind: a.submit_kind,
    correct: a.correct_count,
    total: a.question_count,
    scorePct: a.submitted_at ? scorePercent(a.correct_count, a.question_count) : null,
  }));
}

export type QuestionStat = {
  questionId: number;
  submitted: number;          // 제출된 응시 수
  correct: number;
  unanswered: number;
  choiceCounts: { choiceId: number; count: number }[];
  shortAnswers: { text: string; count: number; correct: boolean }[];
};

/** 문제별 통계 (제출된 개인풀이만). 정답률·보기별 선택·미선택·주관식 답안 분포. */
export function roundStats(roundId: number): QuestionStat[] {
  const round = examRepo.findRound(roundId);
  if (!round) return [];
  finalizeDue(round);
  const questions = getRoundQuestions(roundId);
  const submittedAttempts = repo.listAttempts(roundId).filter((a) => a.submitted_at !== null);
  const answers = repo.listSubmittedAnswersInRound(roundId);
  const byQuestion = new Map<number, repo.SoloAnswerRow[]>();
  for (const a of answers) {
    const list = byQuestion.get(a.question_id) ?? [];
    list.push(a);
    byQuestion.set(a.question_id, list);
  }
  return questions.map((q) => {
    const rows = byQuestion.get(q.id) ?? [];
    const choiceCounts = q.choices.map((c) => ({ choiceId: c.id, count: 0 }));
    const shortMap = new Map<string, { text: string; count: number; correct: boolean }>();
    let answered = 0;
    let correct = 0;
    for (const r of rows) {
      const map: AnswerMap = new Map([[q.id, { choiceIds: parseChoiceIds(r.choice_ids), text: r.text }]]);
      const g = grade([q], map).perQuestion[0];
      if (!g.answered) continue;
      answered += 1;
      if (g.correct) correct += 1;
      if (q.type === "MULTIPLE") {
        for (const id of parseChoiceIds(r.choice_ids)) {
          const c = choiceCounts.find((x) => x.choiceId === id);
          if (c) c.count += 1;
        }
      } else {
        const key = (r.text ?? "").trim();
        const e = shortMap.get(key) ?? { text: key, count: 0, correct: g.correct };
        e.count += 1;
        shortMap.set(key, e);
      }
    }
    return {
      questionId: q.id,
      submitted: submittedAttempts.length,
      correct,
      unanswered: submittedAttempts.length - answered,
      choiceCounts,
      shortAnswers: [...shortMap.values()].sort((a, b) => b.count - a.count),
    };
  });
}
