import { transaction } from "@shared/db/db";
import { badRequest, conflict, notFound } from "@shared/lib/errors";
import { nowIso } from "@shared/lib/time";
import { randomToken } from "@shared/lib/random";
import * as generation from "@modules/generation/generation.service";
import * as attemptService from "@modules/attempt/attempt.service";
import * as roomService from "@modules/room/room.service";
import { assertSourceLength, MAX_SOURCE_CHARS } from "./source-text";
import { getRoundQuestions, type QuestionView } from "./question.view";
import * as repo from "./exam.repository";

// ---------- 입력 ----------

export type SourceInput = {
  kind: repo.SourceKind;
  fileName: string | null;
  content: string;
  shortCount: number;
  multipleCount: number;
  choiceCount: number;
  maxAnswerCount: number;
};

export type RoundTimesInput = {
  startsAt: string;
  endsAt: string;
  soloLimitMin: number;
  groupLimitMin: number;
};

export type CreateExamInput = RoundTimesInput & {
  title: string;
  commonPrompt: string;
  sources: SourceInput[];
};

function validateTimes(t: RoundTimesInput): void {
  if (!t.startsAt || !t.endsAt) throw badRequest("시작 시각과 종료 시각을 입력하세요.");
  if (t.startsAt >= t.endsAt) throw badRequest("종료 시각은 시작 시각보다 뒤여야 합니다.");
  for (const [label, v] of [["개인풀이", t.soloLimitMin], ["협력풀이", t.groupLimitMin]] as const) {
    if (!Number.isInteger(v) || v < 1 || v > 600) {
      throw badRequest(`${label} 제한시간은 1~600분 사이 정수여야 합니다.`);
    }
  }
}

function validateSource(s: SourceInput, index: number): void {
  const label = s.fileName ?? `자료 ${index + 1}`;
  assertSourceLength(s.content, label);
  for (const [name, v, max] of [
    ["주관식 문제 수", s.shortCount, 30],
    ["객관식 문제 수", s.multipleCount, 30],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > max) throw badRequest(`${label}: ${name}는 0~${max} 사이여야 합니다.`);
  }
  if (s.shortCount + s.multipleCount === 0) throw badRequest(`${label}: 문제 수가 0입니다.`);
  if (s.multipleCount > 0) {
    if (!Number.isInteger(s.choiceCount) || s.choiceCount < 2 || s.choiceCount > 6) {
      throw badRequest(`${label}: 보기 개수는 2~6 사이여야 합니다.`);
    }
    if (!Number.isInteger(s.maxAnswerCount) || s.maxAnswerCount < 1 || s.maxAnswerCount > s.choiceCount) {
      throw badRequest(`${label}: 최대 복수정답 수는 1~보기 개수 사이여야 합니다.`);
    }
  }
}

// ---------- 생성 ----------

/** 시험지가 이 관리자의 것이 아니면 404 (남의 시험지는 존재를 알리지 않는다). */
export function assertOwner(examId: number, adminId: number): repo.ExamRow {
  const exam = repo.findExam(examId);
  if (!exam || exam.admin_id !== adminId) throw notFound("시험지를 찾을 수 없습니다.");
  return exam;
}

export function assertRoundOwner(roundId: number, adminId: number): number {
  const examId = repo.examIdOfRound(roundId);
  if (examId === null) throw notFound("차시를 찾을 수 없습니다.");
  assertOwner(examId, adminId);
  return examId;
}

export function assertLinkOwner(linkId: number, adminId: number): number {
  const examId = repo.examIdOfLink(linkId);
  if (examId === null) throw notFound("링크를 찾을 수 없습니다.");
  assertOwner(examId, adminId);
  return examId;
}

export function createExam(adminId: number, input: CreateExamInput): { examId: number; roundId: number } {
  const title = input.title.trim();
  if (!title || title.length > 100) throw badRequest("제목은 1~100자로 입력하세요.");
  if (input.sources.length === 0) throw badRequest("자료를 하나 이상 넣으세요.");
  if (input.sources.length > 20) throw badRequest("자료는 20개까지 넣을 수 있습니다.");
  validateTimes(input);
  input.sources.forEach(validateSource);

  const ids = transaction(() => {
    const at = nowIso();
    const examId = repo.insertExam(adminId, title, input.commonPrompt.trim(), at);
    const roundId = repo.insertRound(
      examId, 1, input.startsAt, input.endsAt, input.soloLimitMin, input.groupLimitMin, at,
    );
    input.sources.forEach((s, i) =>
      repo.insertSource({
        round_id: roundId,
        seq: i + 1,
        kind: s.kind,
        file_name: s.fileName,
        content: s.content,
        short_count: s.shortCount,
        multiple_count: s.multipleCount,
        choice_count: s.multipleCount > 0 ? s.choiceCount : 4,
        max_answer_count: s.multipleCount > 0 ? s.maxAnswerCount : 1,
        created_at: at,
      }),
    );
    createLinks(roundId, at);
    return { examId, roundId };
  });
  generation.startExamGeneration(ids.examId, ids.roundId);
  return ids;
}

function createLinks(roundId: number, at: string): void {
  repo.insertLink(roundId, "SOLO", randomToken(), at);
  repo.insertLink(roundId, "GROUP", randomToken(), at);
}

// ---------- 조회 ----------

export type RoundStatus = "SCHEDULED" | "OPEN" | "ENDED";

export function roundStatus(r: repo.RoundRow, at = nowIso()): RoundStatus {
  if (at < r.starts_at) return "SCHEDULED";
  if (at >= r.ends_at) return "ENDED";
  return "OPEN";
}

export type ExamSummary = {
  id: number;
  title: string;
  questionCount: number;
  roundCount: number;
  latestRoundNo: number | null;
  latestStatus: RoundStatus | null;
  generating: boolean;
  createdAt: string;
};

export function listExamSummaries(adminId: number): ExamSummary[] {
  return repo.listExams(adminId).map((e) => {
    const latest = repo.findLatestRound(e.id);
    return {
      id: e.id,
      title: e.title,
      questionCount: latest ? repo.countQuestions(latest.id) : 0,
      roundCount: repo.countRounds(e.id),
      latestRoundNo: latest?.round_no ?? null,
      latestStatus: latest ? roundStatus(latest) : null,
      generating: generation.isGenerating(e.id),
      createdAt: e.created_at,
    };
  });
}

export type LinkView = {
  id: number;
  mode: repo.LinkMode;
  token: string;
  isOpen: boolean;
};

export type RoundView = {
  id: number;
  roundNo: number;
  startsAt: string;
  endsAt: string;
  soloLimitMin: number;
  groupLimitMin: number;
  status: RoundStatus;
  participantCount: number;
  soloAttempts: number;
  soloDone: number;
  groupStarted: boolean;
  groupSubmitted: boolean;
  links: LinkView[];
};

export type SourceView = {
  id: number;
  seq: number;
  kind: repo.SourceKind;
  fileName: string | null;
  label: string;
  contentChars: number;
  shortCount: number;
  multipleCount: number;
  choiceCount: number;
  maxAnswerCount: number;
  questionCount: number;
  lastError: string | null;
};

export type ExamDetail = {
  id: number;
  title: string;
  commonPrompt: string;
  createdAt: string;
  generating: boolean;
  rounds: RoundView[];
  latestRound: RoundView;
  sources: SourceView[];
  questions: QuestionView[];
  hasParticipants: boolean;
};

export function roundView(r: repo.RoundRow): RoundView {
  const progress = attemptService.soloProgress(r);
  const group = roomService.groupResult(r.id);
  return {
    id: r.id,
    roundNo: r.round_no,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    soloLimitMin: r.solo_limit_min,
    groupLimitMin: r.group_limit_min,
    status: roundStatus(r),
    participantCount: repo.countParticipantsInRound(r.id),
    soloAttempts: progress.total,
    soloDone: progress.done,
    groupStarted: group?.started ?? false,
    groupSubmitted: group?.submitted ?? false,
    links: repo.listLinks(r.id).map((l) => ({ id: l.id, mode: l.mode, token: l.token, isOpen: l.is_open === 1 })),
  };
}

export function sourceViews(roundId: number): SourceView[] {
  return repo.listSources(roundId).map((s) => {
    const log = repo.findLatestLogForSource(s.id);
    const questionCount = repo.listQuestionsBySource(s.id).length;
    return {
      id: s.id,
      seq: s.seq,
      kind: s.kind,
      fileName: s.file_name,
      label: generation.sourceLabel(s),
      contentChars: s.content.length,
      shortCount: s.short_count,
      multipleCount: s.multiple_count,
      choiceCount: s.choice_count,
      maxAnswerCount: s.max_answer_count,
      questionCount,
      lastError: questionCount === 0 && log?.error ? log.error : null,
    };
  });
}

export function getExamDetail(examId: number): ExamDetail {
  const exam = repo.findExam(examId);
  if (!exam) throw notFound("시험지를 찾을 수 없습니다.");
  const rounds = repo.listRounds(examId).map(roundView);
  const latest = rounds[rounds.length - 1];
  if (!latest) throw notFound("차시가 없습니다.");
  return {
    id: exam.id,
    title: exam.title,
    commonPrompt: exam.common_prompt,
    createdAt: exam.created_at,
    generating: generation.isGenerating(examId),
    rounds,
    latestRound: latest,
    sources: sourceViews(latest.id),
    questions: getRoundQuestions(latest.id),
    hasParticipants: repo.countParticipantsInExam(examId) > 0,
  };
}

export function getRound(roundId: number): repo.RoundRow {
  const r = repo.findRound(roundId);
  if (!r) throw notFound("차시를 찾을 수 없습니다.");
  return r;
}

// ---------- 삭제 ----------

export function deleteExam(examId: number): void {
  if (!repo.findExam(examId)) throw notFound("시험지를 찾을 수 없습니다.");
  if (generation.isGenerating(examId)) throw conflict("출제 중에는 삭제할 수 없습니다.", "GENERATING");
  repo.deleteExam(examId);
}

export function deleteRound(roundId: number): number {
  const r = getRound(roundId);
  if (repo.countRounds(r.exam_id) <= 1) throw conflict("마지막 차시는 지울 수 없습니다. 시험지를 삭제하세요.", "LAST_ROUND");
  repo.deleteRound(roundId);
  return r.exam_id;
}

// ---------- 차시 ----------

/** 같은 문제로 새 차시. 최신 차시의 자료·문제를 복사한다. */
export function createRound(examId: number, times: RoundTimesInput): number {
  validateTimes(times);
  const latest = repo.findLatestRound(examId);
  if (!latest) throw notFound("시험지를 찾을 수 없습니다.");
  if (generation.isGenerating(examId)) throw conflict("출제가 끝난 뒤에 만들 수 있습니다.", "GENERATING");
  return cloneRound(latest, times);
}

function cloneRound(from: repo.RoundRow, times: RoundTimesInput): number {
  return transaction(() => {
    const at = nowIso();
    const roundId = repo.insertRound(
      from.exam_id,
      repo.maxRoundNo(from.exam_id) + 1,
      times.startsAt,
      times.endsAt,
      times.soloLimitMin,
      times.groupLimitMin,
      at,
    );
    const sourceMap = new Map<number, number>();
    for (const s of repo.listSources(from.id)) {
      const id = repo.insertSource({ ...s, round_id: roundId, created_at: at });
      sourceMap.set(s.id, id);
    }
    for (const q of repo.listQuestions(from.id)) {
      const qid = repo.insertQuestion({
        round_id: roundId,
        source_id: sourceMap.get(q.source_id)!,
        seq: q.seq,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        created_at: at,
      });
      for (const c of repo.listChoicesOfQuestion(q.id)) repo.insertChoice(qid, c.seq, c.text, c.is_answer === 1);
      for (const a of repo.listShortAnswersOfQuestion(q.id)) repo.insertShortAnswer(qid, a.seq, a.text);
    }
    createLinks(roundId, at);
    repo.touchExam(from.exam_id, at);
    return roundId;
  });
}

/**
 * 수정 대상 차시. 최신 차시에 응시자가 있으면 복사해 새 차시를 만들고 그것을 돌려준다.
 * 수정 화면의 모든 동작이 이 함수를 거친다 (요구사항 4-6-2).
 */
export function editableRound(examId: number): { round: repo.RoundRow; created: boolean } {
  const latest = repo.findLatestRound(examId);
  if (!latest) throw notFound("시험지를 찾을 수 없습니다.");
  if (generation.isGenerating(examId)) throw conflict("출제가 끝난 뒤에 수정할 수 있습니다.", "GENERATING");
  if (repo.countParticipantsInRound(latest.id) === 0) return { round: latest, created: false };
  const id = cloneRound(latest, {
    startsAt: latest.starts_at,
    endsAt: latest.ends_at,
    soloLimitMin: latest.solo_limit_min,
    groupLimitMin: latest.group_limit_min,
  });
  return { round: repo.findRound(id)!, created: true };
}

export function updateRoundTimes(examId: number, times: RoundTimesInput): number {
  validateTimes(times);
  const { round } = editableRound(examId);
  repo.updateRoundTimes(round.id, times.startsAt, times.endsAt, times.soloLimitMin, times.groupLimitMin, nowIso());
  repo.touchExam(examId, nowIso());
  return round.id;
}

export function deleteSourceFromExam(examId: number, sourceId: number): void {
  const { round } = editableRound(examId);
  const target = resolveInRound(round.id, sourceId, "source");
  if (repo.listSources(round.id).length <= 1) throw conflict("마지막 자료는 지울 수 없습니다.", "LAST_SOURCE");
  transaction(() => {
    repo.deleteSource(target);
    generation.resequence(round.id);
    repo.touchExam(examId, nowIso());
  });
}

export function deleteQuestionFromExam(examId: number, questionId: number): void {
  const { round } = editableRound(examId);
  const target = resolveInRound(round.id, questionId, "question");
  if (repo.countQuestions(round.id) <= 1) throw conflict("마지막 문제는 지울 수 없습니다.", "LAST_QUESTION");
  transaction(() => {
    repo.deleteQuestion(target);
    generation.resequence(round.id);
    repo.touchExam(examId, nowIso());
  });
}

export async function regenerateSourceInExam(examId: number, sourceId: number): Promise<void> {
  const { round } = editableRound(examId);
  const target = resolveInRound(round.id, sourceId, "source");
  await generation.regenerateSource(round.id, target);
  repo.touchExam(examId, nowIso());
}

export async function regenerateQuestionInExam(examId: number, questionId: number): Promise<void> {
  const { round } = editableRound(examId);
  const target = resolveInRound(round.id, questionId, "question");
  await generation.regenerateQuestion(round.id, target);
  repo.touchExam(examId, nowIso());
}

/**
 * 수정 화면이 보고 있던 id가 이전 차시의 것일 수 있다 (복사 직후).
 * 같은 seq의 항목을 새 차시에서 찾아 준다.
 */
function resolveInRound(roundId: number, id: number, kind: "source" | "question"): number {
  if (kind === "source") {
    const s = repo.findSource(id);
    if (!s) throw notFound("자료를 찾을 수 없습니다.");
    if (s.round_id === roundId) return id;
    const match = repo.listSources(roundId).find((x) => x.seq === s.seq);
    if (!match) throw notFound("자료를 찾을 수 없습니다.");
    return match.id;
  }
  const q = repo.findQuestion(id);
  if (!q) throw notFound("문제를 찾을 수 없습니다.");
  if (q.round_id === roundId) return id;
  const match = repo.listQuestions(roundId).find((x) => x.seq === q.seq);
  if (!match) throw notFound("문제를 찾을 수 없습니다.");
  return match.id;
}

// ---------- 링크 ----------

export function setLinkOpen(linkId: number, open: boolean): repo.AccessLinkRow {
  const link = repo.findLink(linkId);
  if (!link) throw notFound("링크를 찾을 수 없습니다.");
  transaction(() => {
    repo.updateLinkOpen(linkId, open, nowIso());
    if (!open) {
      if (link.mode === "SOLO") attemptService.finalizeSoloAttempts(link.round_id, "LINK_CLOSED");
      else roomService.closeRoomForRound(link.round_id);
    }
  });
  return repo.findLink(linkId)!;
}

export function regenerateLinkToken(linkId: number): repo.AccessLinkRow {
  const link = repo.findLink(linkId);
  if (!link) throw notFound("링크를 찾을 수 없습니다.");
  repo.updateLinkToken(linkId, randomToken(), nowIso());
  return repo.findLink(linkId)!;
}

export function linkPath(mode: repo.LinkMode, token: string): string {
  return `/${mode === "SOLO" ? "s" : "g"}/${token}`;
}

export { MAX_SOURCE_CHARS };
