import { badRequest } from "@shared/lib/errors";

export const MAX_SOURCE_CHARS = 100_000;

/** PDF 바이트에서 텍스트를 뽑는다. 스캔본(텍스트 없음)이면 오류. */
export async function extractPdfText(bytes: Uint8Array, fileName: string): Promise<string> {
  const { extractText } = await import("unpdf");
  let text = "";
  try {
    const result = (await extractText(bytes, { mergePages: true })) as { text: string | string[] };
    text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
  } catch (e) {
    throw badRequest(`PDF를 읽지 못했습니다: ${fileName}`, "PDF_PARSE_FAILED");
  }
  const cleaned = tidy(text);
  if (cleaned.length < 20) {
    throw badRequest(
      `PDF에서 텍스트를 찾지 못했습니다 (스캔본은 지원하지 않습니다): ${fileName}`,
      "PDF_NO_TEXT",
    );
  }
  return cleaned;
}

/** md·텍스트는 그대로 쓰되 줄 끝 공백과 과한 빈 줄만 정리한다. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function assertSourceLength(content: string, label: string): void {
  if (!content.trim()) throw badRequest(`${label}: 내용이 비어 있습니다.`, "SOURCE_EMPTY");
  if (content.length > MAX_SOURCE_CHARS) {
    throw badRequest(
      `${label}: 자료가 ${content.length.toLocaleString()}자입니다. 자료당 최대 ${MAX_SOURCE_CHARS.toLocaleString()}자까지 넣을 수 있습니다.`,
      "SOURCE_TOO_LONG",
    );
  }
}
