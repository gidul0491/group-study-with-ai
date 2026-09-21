import type { QuestionView } from "@modules/exam/question.view";

export type SheetInput = {
  title: string;
  roundNo: number;
  questions: QuestionView[];
  withAnswers: boolean;
};

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

export function choiceMark(seq: number): string {
  return CIRCLED[seq - 1] ?? `${seq}.`;
}

/** 문제지(withAnswers=false) 또는 답안지(withAnswers=true) 마크다운. */
export function buildMarkdown(input: SheetInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title} — ${input.roundNo}차시 ${input.withAnswers ? "답안지" : "문제지"}`);
  lines.push("");
  for (const q of input.questions) {
    lines.push(`## ${q.seq}. ${q.text}`);
    lines.push("");
    if (q.type === "MULTIPLE") {
      for (const c of q.choices) {
        const mark = input.withAnswers && c.isAnswer ? " ✅" : "";
        lines.push(`- ${choiceMark(c.seq)} ${c.text}${mark}`);
      }
    } else {
      lines.push(input.withAnswers ? "" : "답: ______________________");
    }
    if (input.withAnswers) {
      lines.push("");
      if (q.type === "MULTIPLE") {
        lines.push(`**정답:** ${q.choices.filter((c) => c.isAnswer).map((c) => choiceMark(c.seq)).join(", ")}`);
      } else {
        lines.push(`**정답:** ${q.answers[0] ?? ""}`);
        if (q.answers.length > 1) lines.push(`**인정 답안:** ${q.answers.slice(1).join(", ")}`);
      }
      lines.push("");
      lines.push(`**해설:** ${q.explanation}`);
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function sheetFileName(title: string, roundNo: number, withAnswers: boolean, ext: "md" | "pdf"): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "시험지";
  return `${safe}_${roundNo}차시_${withAnswers ? "답안지" : "문제지"}.${ext}`;
}
