import { answersMatch, choicesMatch } from "@shared/lib/normalize";
import type { QuestionView } from "@modules/exam/question.view";

export type AnswerInput = { choiceIds?: number[] | null; text?: string | null };
export type AnswerMap = Map<number, AnswerInput>;

export type QuestionGrade = {
  questionId: number;
  answered: boolean;
  correct: boolean;
};

export type GradeResult = {
  correct: number;
  total: number;
  perQuestion: QuestionGrade[];
};

/** 문제 목록과 답안으로 채점한다. 미선택은 오답. */
export function grade(questions: QuestionView[], answers: AnswerMap): GradeResult {
  const perQuestion = questions.map<QuestionGrade>((q) => {
    const a = answers.get(q.id);
    if (q.type === "MULTIPLE") {
      const selected = a?.choiceIds ?? [];
      const answered = selected.length > 0;
      const answerIds = q.choices.filter((c) => c.isAnswer).map((c) => c.id);
      return { questionId: q.id, answered, correct: answered && choicesMatch(selected, answerIds) };
    }
    const text = (a?.text ?? "").trim();
    const answered = text.length > 0;
    return { questionId: q.id, answered, correct: answered && answersMatch(text, q.answers) };
  });
  return {
    correct: perQuestion.filter((g) => g.correct).length,
    total: questions.length,
    perQuestion,
  };
}

export function scorePercent(correct: number | null, total: number | null): number {
  if (!total) return 0;
  return Math.round(((correct ?? 0) / total) * 1000) / 10;
}

export function parseChoiceIds(json: string | null): number[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
