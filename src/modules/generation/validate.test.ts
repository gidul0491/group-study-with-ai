import { describe, expect, it } from "vitest";
import { validateGenerated } from "./validate";
import type { GenerationSpec } from "./prompt";

const spec: GenerationSpec = {
  content: "",
  commonPrompt: "",
  shortCount: 1,
  multipleCount: 1,
  choiceCount: 4,
  maxAnswerCount: 2,
  avoid: [],
};

const good = {
  questions: [
    { type: "multiple", text: "Q1", choices: ["a", "b", "c", "d"], answerIndexes: [2, 0], explanation: "e" },
    { type: "short", text: "Q2", answers: ["x", " x ", "y"], explanation: "e" },
  ],
};

describe("validateGenerated", () => {
  it("정상 응답을 통과시키고 정답 인덱스를 정렬·중복 제거한다", () => {
    const r = validateGenerated(JSON.stringify(good), spec);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions[0]).toMatchObject({ type: "multiple", answerIndexes: [0, 2] });
    expect(r.questions[1]).toMatchObject({ type: "short", answers: ["x", "y"] });
  });

  it("보기 수가 다르면 실패", () => {
    const bad = structuredClone(good);
    bad.questions[0].choices = ["a", "b", "c"];
    const r = validateGenerated(JSON.stringify(bad), spec);
    expect(r.ok).toBe(false);
  });

  it("정답 수가 허용 범위를 넘으면 실패", () => {
    const bad = structuredClone(good);
    bad.questions[0].answerIndexes = [0, 1, 2];
    expect(validateGenerated(JSON.stringify(bad), spec).ok).toBe(false);
  });

  it("문제 개수가 맞지 않으면 실패", () => {
    const bad = { questions: [good.questions[0]] };
    expect(validateGenerated(JSON.stringify(bad), spec).ok).toBe(false);
  });

  it("JSON이 아니면 실패", () => {
    expect(validateGenerated("not json", spec).ok).toBe(false);
  });
});
