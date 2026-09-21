import type { GeneratedQuestion, GeneratedMultiple, GeneratedShort, GenerationSpec } from "./prompt";

export type ValidationResult =
  | { ok: true; questions: GeneratedQuestion[] }
  | { ok: false; reason: string };

/**
 * AI 응답을 옵션과 대조한다 (요구사항 5-5).
 * 개수·보기 수·정답 수가 어긋나면 실패. 사소한 문제(공백, 중복 유의어)는 고쳐서 통과시킨다.
 */
export function validateGenerated(rawText: string, spec: GenerationSpec): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: "응답이 JSON이 아닙니다." };
  }
  const list = (parsed as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return { ok: false, reason: "questions 배열이 없습니다." };

  type Raw = {
    type?: unknown;
    text?: unknown;
    explanation?: unknown;
    choices?: unknown;
    answerIndexes?: unknown;
    answers?: unknown;
  };
  const multiples: GeneratedMultiple[] = [];
  const shorts: GeneratedShort[] = [];
  for (const [i, item] of list.entries()) {
    const q = (item ?? {}) as Raw;
    const text = clean(q.text);
    const explanation = clean(q.explanation);
    if (!text) return { ok: false, reason: `${i + 1}번 문제 본문이 비었습니다.` };
    if (q.type === "multiple") {
      const rawChoices: unknown[] = Array.isArray(q.choices) ? q.choices : [];
      const choices = rawChoices.map(clean).filter(Boolean);
      if (choices.length !== spec.choiceCount) {
        return {
          ok: false,
          reason: `${i + 1}번 객관식 보기 수가 ${choices.length}개입니다 (요청 ${spec.choiceCount}개).`,
        };
      }
      const rawIdx: unknown[] = Array.isArray(q.answerIndexes) ? q.answerIndexes : [];
      const idx = Array.from(new Set(rawIdx.map((n) => Number(n)))).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < choices.length,
      );
      if (idx.length < 1 || idx.length > spec.maxAnswerCount) {
        return {
          ok: false,
          reason: `${i + 1}번 객관식 정답 수가 ${idx.length}개입니다 (허용 1~${spec.maxAnswerCount}개).`,
        };
      }
      multiples.push({ type: "multiple", text, choices, answerIndexes: idx.sort((a, b) => a - b), explanation });
    } else if (q.type === "short") {
      const rawAnswers: unknown[] = Array.isArray(q.answers) ? q.answers : [];
      const answers = Array.from(new Set(rawAnswers.map(clean).filter(Boolean)));
      if (answers.length < 1) return { ok: false, reason: `${i + 1}번 주관식 정답이 없습니다.` };
      shorts.push({ type: "short", text, answers, explanation });
    } else {
      return { ok: false, reason: `${i + 1}번 문제 유형이 잘못되었습니다.` };
    }
  }
  if (multiples.length !== spec.multipleCount || shorts.length !== spec.shortCount) {
    return {
      ok: false,
      reason: `객관식 ${multiples.length}/${spec.multipleCount}, 주관식 ${shorts.length}/${spec.shortCount}개로 개수가 맞지 않습니다.`,
    };
  }
  return { ok: true, questions: [...multiples, ...shorts] };
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
