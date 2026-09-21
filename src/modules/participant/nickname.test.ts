import { describe, expect, it } from "vitest";
import { randomNickname, uniqueNickname } from "./nickname";

describe("nickname", () => {
  it("형용사 명사 형태의 한글 닉네임", () => {
    expect(randomNickname()).toMatch(/^\S+ \S+$/);
  });

  it("이미 쓰인 닉네임은 피한다", () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) taken.add(uniqueNickname(taken));
    expect(taken.size).toBe(200);
  });
});
