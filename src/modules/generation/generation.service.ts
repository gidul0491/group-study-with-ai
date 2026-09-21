import { transaction } from "@shared/db/db";
import { badRequest, notFound } from "@shared/lib/errors";
import { publish } from "@shared/lib/event-bus";
import { nowIso } from "@shared/lib/time";
import * as repo from "@modules/exam/exam.repository";
import { callGemini } from "./gemini.client";
import { validateGenerated } from "./validate";
import type { GeneratedQuestion, GenerationSpec } from "./prompt";

/** 출제 진행 상태 (메모리). 채널 generation:<examId>로 발행한다. */
export type GenerationJob = {
  examId: number;
  roundId: number;
  total: number;
  done: number;
  current: { seq: number; label: string } | null;
  errors: { sourceId: number; seq: number; label: string; message: string }[];
  finished: boolean;
  startedAt: string;
};

const jobs = new Map<number, GenerationJob>();

export function jobChannel(examId: number): string {
  return `generation:${examId}`;
}

export function getJob(examId: number): GenerationJob | null {
  return jobs.get(examId) ?? null;
}

export function isGenerating(examId: number): boolean {
  const j = jobs.get(examId);
  return !!j && !j.finished;
}

function emit(job: GenerationJob): void {
  publish(jobChannel(job.examId), { ...job });
}

export function sourceLabel(s: repo.SourceRow): string {
  return s.file_name ?? `자료 ${s.seq}`;
}

/**
 * 시험지 전체 출제 (모든 자료, 순서대로 직렬). 비동기로 돌고 진행 상황을 발행한다.
 * 이미 문제가 있는 자료는 건너뛴다 (재시작 대비).
 */
export function startExamGeneration(examId: number, roundId: number): GenerationJob {
  const existing = jobs.get(examId);
  if (existing && !existing.finished) return existing;
  const sources = repo.listSources(roundId);
  const job: GenerationJob = {
    examId,
    roundId,
    total: sources.length,
    done: 0,
    current: null,
    errors: [],
    finished: sources.length === 0,
    startedAt: nowIso(),
  };
  jobs.set(examId, job);
  emit(job);
  if (job.finished) return job;

  void (async () => {
    const exam = repo.findExam(examId);
    for (const source of sources) {
      job.current = { seq: source.seq, label: sourceLabel(source) };
      emit(job);
      if (repo.listQuestionsBySource(source.id).length === 0) {
        try {
          await generateForSource(roundId, source, exam?.common_prompt ?? "", []);
        } catch (e) {
          job.errors.push({
            sourceId: source.id,
            seq: source.seq,
            label: sourceLabel(source),
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      job.done += 1;
      emit(job);
    }
    job.current = null;
    job.finished = true;
    resequence(roundId);
    repo.touchExam(examId, nowIso());
    emit(job);
    setTimeout(() => {
      if (jobs.get(examId) === job) jobs.delete(examId);
    }, 10 * 60_000);
  })();

  return job;
}

/** 자료 하나를 출제해 저장한다. 실패하면 AppError를 던진다 (1회 재시도 포함). */
export async function generateForSource(
  roundId: number,
  source: repo.SourceRow,
  commonPrompt: string,
  avoid: string[],
): Promise<number[]> {
  const spec: GenerationSpec = {
    content: source.content,
    commonPrompt,
    shortCount: source.short_count,
    multipleCount: source.multiple_count,
    choiceCount: source.choice_count,
    maxAnswerCount: source.max_answer_count,
    avoid,
  };
  const questions = await generateWithRetry(spec, roundId, source.id);
  return insertGenerated(roundId, source.id, questions);
}

async function generateWithRetry(
  spec: GenerationSpec,
  roundId: number,
  sourceId: number,
): Promise<GeneratedQuestion[]> {
  let lastReason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let rawText = "";
    let model = "";
    try {
      const r = await callGemini(spec);
      rawText = r.rawText;
      model = r.model;
      const v = validateGenerated(rawText, spec);
      repo.insertGenerationLog({
        round_id: roundId,
        source_id: sourceId,
        model,
        request_summary: summarize(spec, attempt),
        response_json: rawText,
        duration_ms: r.durationMs,
        error: v.ok ? null : v.reason,
        created_at: nowIso(),
      });
      if (v.ok) return v.questions;
      lastReason = v.reason;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      repo.insertGenerationLog({
        round_id: roundId,
        source_id: sourceId,
        model: model || "unknown",
        request_summary: summarize(spec, attempt),
        response_json: rawText || null,
        duration_ms: Date.now() - started,
        error: message,
        created_at: nowIso(),
      });
      lastReason = message;
    }
  }
  throw badRequest(`출제에 실패했습니다: ${lastReason}`, "GENERATION_FAILED");
}

function summarize(spec: GenerationSpec, attempt: number): string {
  return JSON.stringify({
    attempt: attempt + 1,
    contentChars: spec.content.length,
    commonPromptChars: spec.commonPrompt.length,
    shortCount: spec.shortCount,
    multipleCount: spec.multipleCount,
    choiceCount: spec.choiceCount,
    maxAnswerCount: spec.maxAnswerCount,
    avoidCount: spec.avoid.length,
  });
}

/** 생성된 문제를 차시 끝에 붙여 저장한다. 순번은 나중에 resequence로 정리한다. */
export function insertGenerated(
  roundId: number,
  sourceId: number,
  questions: GeneratedQuestion[],
  atSeq?: number,
): number[] {
  return transaction(() => {
    const at = nowIso();
    let seq = atSeq ?? repo.maxQuestionSeq(roundId);
    const ids: number[] = [];
    for (const q of questions) {
      seq += 1;
      const id = repo.insertQuestion({
        round_id: roundId,
        source_id: sourceId,
        seq,
        type: q.type === "multiple" ? "MULTIPLE" : "SHORT",
        text: q.text,
        explanation: q.explanation,
        created_at: at,
      });
      if (q.type === "multiple") {
        q.choices.forEach((c, i) =>
          repo.insertChoice(id, i + 1, c, q.answerIndexes.includes(i)),
        );
      } else {
        q.answers.forEach((a, i) => repo.insertShortAnswer(id, i, a));
      }
      ids.push(id);
    }
    return ids;
  });
}

/** 자료 순서 → 문제 순서대로 1부터 다시 매긴다. */
export function resequence(roundId: number): void {
  transaction(() => {
    const sources = repo.listSources(roundId);
    const order = new Map(sources.map((s, i) => [s.id, i]));
    const questions = repo.listQuestions(roundId).sort((a, b) => {
      const sa = order.get(a.source_id) ?? 0;
      const sb = order.get(b.source_id) ?? 0;
      return sa - sb || a.seq - b.seq;
    });
    // 유니크 충돌은 없지만 안전하게 큰 값으로 옮긴 뒤 다시 매긴다.
    questions.forEach((q, i) => repo.updateQuestionSeq(q.id, 100000 + i));
    questions.forEach((q, i) => repo.updateQuestionSeq(q.id, i + 1));
  });
}

/** 자료 전체 재출제: 그 자료의 문제를 지우고 새로 낸다. 다른 자료 문제와 겹치지 않게. */
export async function regenerateSource(roundId: number, sourceId: number): Promise<void> {
  const source = repo.findSource(sourceId);
  if (!source || source.round_id !== roundId) throw notFound("자료를 찾을 수 없습니다.");
  const round = repo.findRound(roundId);
  const exam = round ? repo.findExam(round.exam_id) : null;
  const avoid = repo
    .listQuestions(roundId)
    .filter((q) => q.source_id !== sourceId)
    .map((q) => q.text);
  const questions = await generateWithRetry(
    {
      content: source.content,
      commonPrompt: exam?.common_prompt ?? "",
      shortCount: source.short_count,
      multipleCount: source.multiple_count,
      choiceCount: source.choice_count,
      maxAnswerCount: source.max_answer_count,
      avoid,
    },
    roundId,
    sourceId,
  );
  transaction(() => {
    for (const q of repo.listQuestionsBySource(sourceId)) repo.deleteQuestion(q.id);
    insertGenerated(roundId, sourceId, questions);
    resequence(roundId);
  });
}

/** 문제 하나 재출제: 같은 유형 1문제를 새로 내어 같은 자리에 넣는다. */
export async function regenerateQuestion(roundId: number, questionId: number): Promise<void> {
  const old = repo.findQuestion(questionId);
  if (!old || old.round_id !== roundId) throw notFound("문제를 찾을 수 없습니다.");
  const source = repo.findSource(old.source_id);
  if (!source) throw notFound("자료를 찾을 수 없습니다.");
  const round = repo.findRound(roundId);
  const exam = round ? repo.findExam(round.exam_id) : null;
  const avoid = repo
    .listQuestions(roundId)
    .filter((q) => q.id !== questionId)
    .map((q) => q.text);
  avoid.push(old.text);
  const questions = await generateWithRetry(
    {
      content: source.content,
      commonPrompt: exam?.common_prompt ?? "",
      shortCount: old.type === "SHORT" ? 1 : 0,
      multipleCount: old.type === "MULTIPLE" ? 1 : 0,
      choiceCount: source.choice_count,
      maxAnswerCount: source.max_answer_count,
      avoid,
    },
    roundId,
    source.id,
  );
  transaction(() => {
    repo.deleteQuestion(questionId);
    // 옛 자리(seq)를 그대로 물려받은 뒤 정렬한다.
    insertGenerated(roundId, source.id, questions, old.seq - 1);
    resequence(roundId);
  });
}
