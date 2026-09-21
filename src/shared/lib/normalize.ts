/**
 * 주관식 채점용 정규화 (요구사항 4-7-8).
 * 유니코드 NFC → 소문자 → 공백 전부 제거 → 문장부호·특수문자 제거.
 * 글자(한글·영문·한자 등)와 숫자만 남긴다.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

export function answersMatch(submitted: string, accepted: string[]): boolean {
  const s = normalizeAnswer(submitted);
  if (!s) return false;
  return accepted.some((a) => normalizeAnswer(a) === s);
}

/** 객관식: 선택 집합과 정답 집합이 완전히 같아야 정답. */
export function choicesMatch(selected: number[], answers: number[]): boolean {
  if (selected.length !== answers.length) return false;
  const set = new Set(answers);
  return selected.every((id) => set.has(id));
}
