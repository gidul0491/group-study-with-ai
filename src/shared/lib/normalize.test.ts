import { describe, expect, it } from "vitest";
import { answersMatch, choicesMatch, normalizeAnswer } from "./normalize";

describe("normalizeAnswer", () => {
  it("공백·문장부호·특수문자를 빼고 소문자로 만든다", () => {
    expect(normalizeAnswer("  Hello, World! ")).toBe("helloworld");
    expect(normalizeAnswer("데이터 베이스")).toBe("데이터베이스");
    expect(normalizeAnswer("O(n log n)")).toBe("onlogn");
    expect(normalizeAnswer("C++")).toBe("c");
  });

  it("NFC로 합쳐 자모 분리형과 완성형을 같게 본다", () => {
    expect(normalizeAnswer("한글".normalize("NFD"))).toBe("한글");
  });
});

describe("answersMatch", () => {
  it("유의어 중 하나와 정규화 후 같으면 정답", () => {
    expect(answersMatch("데이터베이스", ["데이터 베이스", "DB"])).toBe(true);
    expect(answersMatch("db", ["데이터베이스", "DB"])).toBe(true);
    expect(answersMatch("디비", ["데이터베이스", "DB"])).toBe(false);
  });

  it("빈 답은 오답", () => {
    expect(answersMatch("   ", ["x"])).toBe(false);
    expect(answersMatch("!!!", ["x"])).toBe(false);
  });
});

describe("choicesMatch", () => {
  it("집합이 완전히 같아야 정답", () => {
    expect(choicesMatch([1, 3], [3, 1])).toBe(true);
    expect(choicesMatch([1], [1, 3])).toBe(false);
    expect(choicesMatch([1, 3, 4], [1, 3])).toBe(false);
    expect(choicesMatch([], [])).toBe(true);
  });
});
