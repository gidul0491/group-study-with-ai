import * as repo from "./exam.repository";

export type ChoiceView = { id: number; seq: number; text: string; isAnswer: boolean };

/** 관리자용 전체 보기 (정답 포함). */
export type QuestionView = {
  id: number;
  seq: number;
  sourceId: number;
  type: repo.QuestionType;
  text: string;
  explanation: string;
  choices: ChoiceView[];
  answers: string[];
  maxAnswerCount: number;
};

/** 응시자용 (정답·해설 없음). */
export type PublicQuestion = {
  id: number;
  seq: number;
  type: repo.QuestionType;
  text: string;
  choices: { id: number; seq: number; text: string }[];
  maxAnswerCount: number;
};

export function getRoundQuestions(roundId: number): QuestionView[] {
  const sources = new Map(repo.listSources(roundId).map((s) => [s.id, s]));
  const choices = repo.listChoices(roundId);
  const answers = repo.listShortAnswers(roundId);
  return repo.listQuestions(roundId).map((q) => ({
    id: q.id,
    seq: q.seq,
    sourceId: q.source_id,
    type: q.type,
    text: q.text,
    explanation: q.explanation,
    choices: choices
      .filter((c) => c.question_id === q.id)
      .map((c) => ({ id: c.id, seq: c.seq, text: c.text, isAnswer: c.is_answer === 1 })),
    answers: answers.filter((a) => a.question_id === q.id).map((a) => a.text),
    maxAnswerCount: sources.get(q.source_id)?.max_answer_count ?? 1,
  }));
}

export function toPublic(q: QuestionView): PublicQuestion {
  return {
    id: q.id,
    seq: q.seq,
    type: q.type,
    text: q.text,
    choices: q.choices.map((c) => ({ id: c.id, seq: c.seq, text: c.text })),
    maxAnswerCount: q.maxAnswerCount,
  };
}
