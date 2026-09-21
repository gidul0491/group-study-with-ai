import { GoogleGenAI } from "@google/genai";
import { env } from "@shared/config/env";
import { badRequest } from "@shared/lib/errors";
import { responseSchema, systemInstruction, userPrompt, type GenerationSpec } from "./prompt";

export type GeminiResult = {
  model: string;
  rawText: string;
  durationMs: number;
};

let client: GoogleGenAI | null = null;

function ai(): GoogleGenAI {
  if (client) return client;
  const key = env().geminiApiKey;
  if (!key) throw badRequest(".env.txt에 GEMINI_API_KEY가 없습니다.", "NO_API_KEY");
  client = new GoogleGenAI({ apiKey: key });
  return client;
}

/** Gemini를 한 번 호출해 JSON 텍스트를 돌려준다. 파싱·검증은 호출자가 한다. */
export async function callGemini(spec: GenerationSpec): Promise<GeminiResult> {
  if (env().geminiMock) return mockGenerate(spec);
  const model = env().geminiModel;
  const started = Date.now();
  try {
    const response = await ai().models.generateContent({
      model,
      contents: userPrompt(spec),
      config: {
        systemInstruction: systemInstruction(),
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.7,
      },
    });
    const rawText = response.text ?? "";
    return { model, rawText, durationMs: Date.now() - started };
  } catch (e) {
    throw new Error(describeGeminiError(e));
  }
}

/** SDK가 JSON 문자열을 message로 던지므로 사람이 읽을 문장만 뽑는다. */
export function describeGeminiError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string; status?: string } };
    if (parsed?.error?.message) {
      const status = parsed.error.status ? ` [${parsed.error.status}]` : "";
      return `Gemini 오류${status}: ${parsed.error.message}`;
    }
  } catch {
    /* JSON이 아니면 그대로 */
  }
  return `Gemini 오류: ${raw.slice(0, 300)}`;
}

/**
 * 개발·화면 확인용 모의 출제 (.env.txt에 GEMINI_MOCK=1).
 * 자료의 문장을 잘라 문제처럼 만든다. 내용의 질은 보장하지 않는다.
 */
async function mockGenerate(spec: GenerationSpec): Promise<GeminiResult> {
  const started = Date.now();
  const sentences = spec.content
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  const pickSentence = (i: number) => sentences[(i * 7 + spec.avoid.length) % Math.max(1, sentences.length)] ?? `자료 내용 ${i + 1}`;
  const questions: unknown[] = [];
  for (let i = 0; i < spec.multipleCount; i++) {
    const base = pickSentence(i);
    const answers = new Set<number>();
    const answerCount = 1 + ((i + spec.avoid.length) % spec.maxAnswerCount);
    while (answers.size < answerCount) answers.add((i + answers.size * 2) % spec.choiceCount);
    questions.push({
      type: "multiple",
      text: `[모의] 다음 설명과 관련해 옳은 것을 고르세요${answerCount > 1 ? ` (정답 ${answerCount}개)` : ""}: "${base.slice(0, 60)}"`,
      choices: Array.from({ length: spec.choiceCount }, (_, c) =>
        answers.has(c) ? `${base.slice(0, 40)} (옳음 ${c + 1})` : `자료와 다른 설명 ${c + 1}`,
      ),
      answerIndexes: [...answers].sort((a, b) => a - b),
      explanation: `모의 해설: 자료에 "${base.slice(0, 80)}"라고 나와 있습니다.`,
    });
  }
  for (let i = 0; i < spec.shortCount; i++) {
    const base = pickSentence(spec.multipleCount + i);
    const word = base.match(/[가-힣A-Za-z]{2,}/)?.[0] ?? "정답";
    questions.push({
      type: "short",
      text: `[모의] 다음 문장의 핵심 용어를 쓰세요: "${base.replace(word, "____").slice(0, 80)}"`,
      answers: [word, word.toLowerCase()],
      explanation: `모의 해설: 빈칸에 들어갈 말은 "${word}"입니다.`,
    });
  }
  await new Promise((r) => setTimeout(r, 400));
  return { model: "mock", rawText: JSON.stringify({ questions }), durationMs: Date.now() - started };
}
