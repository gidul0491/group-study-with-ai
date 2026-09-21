/**
 * 출제 요청 프롬프트와 응답 스키마.
 * 응답은 JSON 하나: { questions: [...] } (요구사항 5장).
 */
import { Type, type Schema } from "@google/genai";

export type GenerationSpec = {
  content: string;
  commonPrompt: string;
  shortCount: number;
  multipleCount: number;
  choiceCount: number;
  maxAnswerCount: number;
  /** 재출제 시 겹치지 않게 피할 기존 문제 본문 */
  avoid: string[];
};

export type GeneratedMultiple = {
  type: "multiple";
  text: string;
  choices: string[];
  answerIndexes: number[];
  explanation: string;
};

export type GeneratedShort = {
  type: "short";
  text: string;
  answers: string[];
  explanation: string;
};

export type GeneratedQuestion = GeneratedMultiple | GeneratedShort;

export const responseSchema: Schema = {
  type: Type.OBJECT,
  required: ["questions"],
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["type", "text", "explanation"],
        properties: {
          type: { type: Type.STRING, enum: ["multiple", "short"] },
          text: { type: Type.STRING },
          choices: { type: Type.ARRAY, items: { type: Type.STRING } },
          answerIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          answers: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
        },
      },
    },
  },
};

export function systemInstruction(): string {
  return [
    "당신은 스터디 모임을 위한 시험 출제자입니다.",
    "주어진 자료의 내용만 근거로 문제를 냅니다. 자료에 없는 사실을 지어내지 않습니다.",
    "문제·보기·정답·해설은 별도 지시가 없으면 한국어로 씁니다. 자료가 다른 언어여도 한국어로 냅니다. 고유명사·용어는 원어를 괄호로 덧붙여도 됩니다.",
    "문제는 서로 다른 핵심 내용을 다루고, 자료의 중요한 부분을 고르게 다룹니다.",
    "객관식: 보기는 서로 뚜렷이 구분되고 길이가 비슷해야 합니다. 정답이 아닌 보기도 그럴듯해야 합니다. 정답 보기의 위치는 무작위로 섞습니다.",
    "주관식: 한 단어나 짧은 구로 답할 수 있는 문제만 냅니다. answers 배열의 첫 항목이 대표 정답이고, 뒤에는 정답으로 인정할 만한 표기·유의어·약어·원어를 모두 넣습니다. 채점은 공백과 문장부호를 뺀 정확 일치로 하므로, 인정할 표기는 빠짐없이 적습니다.",
    "해설은 왜 그것이 정답인지 자료를 근거로 2~4문장으로 씁니다.",
    "반드시 요청한 개수와 형식을 정확히 지킵니다.",
  ].join("\n");
}

export function userPrompt(spec: GenerationSpec): string {
  const lines: string[] = [];
  lines.push("## 출제 조건");
  lines.push(`- 객관식 ${spec.multipleCount}문제, 주관식 ${spec.shortCount}문제. 총 ${spec.multipleCount + spec.shortCount}문제.`);
  if (spec.multipleCount > 0) {
    lines.push(`- 객관식 보기 개수: 정확히 ${spec.choiceCount}개.`);
    if (spec.maxAnswerCount > 1) {
      lines.push(
        `- 객관식 정답 개수: 문제마다 1개 이상 ${spec.maxAnswerCount}개 이하. 일부 문제는 정답이 2개 이상이 되게 섞습니다. 문제 본문 끝에 "(정답 n개)"처럼 정답 개수를 적습니다.`,
      );
    } else {
      lines.push("- 객관식 정답 개수: 문제마다 정확히 1개.");
    }
    lines.push("- answerIndexes는 choices 배열의 0부터 시작하는 인덱스입니다.");
  }
  lines.push("- 객관식은 type=\"multiple\"에 choices·answerIndexes를, 주관식은 type=\"short\"에 answers를 채웁니다.");
  if (spec.commonPrompt.trim()) {
    lines.push("");
    lines.push("## 출제자 추가 지시 (반드시 반영)");
    lines.push(spec.commonPrompt.trim());
  }
  if (spec.avoid.length > 0) {
    lines.push("");
    lines.push("## 이미 출제된 문제 (같거나 비슷한 문제를 내지 마세요)");
    for (const a of spec.avoid) lines.push(`- ${a.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  lines.push("");
  lines.push("## 자료");
  lines.push(spec.content);
  return lines.join("\n");
}
