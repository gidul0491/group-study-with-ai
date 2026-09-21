import { describe, expect, it } from "vitest";
import { grade, scorePercent, parseChoiceIds } from "./grading";
import type { QuestionView } from "@modules/exam/question.view";

const questions: QuestionView[] = [
  {
    id: 1, seq: 1, sourceId: 1, type: "MULTIPLE", text: "q1", explanation: "", maxAnswerCount: 2,
    choices: [
      { id: 11, seq: 1, text: "a", isAnswer: true },
      { id: 12, seq: 2, text: "b", isAnswer: false },
      { id: 13, seq: 3, text: "c", isAnswer: true },
    ],
    answers: [],
  },
  {
    id: 2, seq: 2, sourceId: 1, type: "SHORT", text: "q2", explanation: "", maxAnswerCount: 1,
    choices: [],
    answers: ["데이터베이스", "DB"],
  },
];

describe("grade", () => {
  it("객관식은 전부 일치, 주관식은 정규화 일치", () => {
    const r = grade(
      questions,
      new Map([
        [1, { choiceIds: [13, 11] }],
        [2, { text: " d b " }],
      ]),
    );
    expect(r.correct).toBe(2);
    expect(r.total).toBe(2);
    expect(r.perQuestion.every((g) => g.answered && g.correct)).toBe(true);
  });

  it("미선택은 오답이고 answered=false", () => {
    const r = grade(questions, new Map([[1, { choiceIds: [11] }]]));
    expect(r.correct).toBe(0);
    expect(r.perQuestion[0]).toEqual({ questionId: 1, answered: true, correct: false });
    expect(r.perQuestion[1]).toEqual({ questionId: 2, answered: false, correct: false });
  });
});

describe("scorePercent", () => {
  it("소수 첫째 자리까지", () => {
    expect(scorePercent(2, 3)).toBe(66.7);
    expect(scorePercent(0, 0)).toBe(0);
    expect(scorePercent(null, 5)).toBe(0);
  });
});

describe("parseChoiceIds", () => {
  it("잘못된 JSON은 빈 배열", () => {
    expect(parseChoiceIds("[1,2]")).toEqual([1, 2]);
    expect(parseChoiceIds("nope")).toEqual([]);
    expect(parseChoiceIds(null)).toEqual([]);
  });
});
