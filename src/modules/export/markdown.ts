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

// ---------- 협력 답안 (그룹 선택 + 개인 제출 비율) ----------

export type GroupSheetInput = {
  title: string;
  roundNo: number;
  questions: QuestionView[];
  /** 그룹이 고른 답 */
  groupAnswers: Record<number, { choiceIds: number[]; text: string }>;
  groupScore: { correct: number; total: number } | null;
  members: { memberNo: number; nickname: string }[];
  /** 개인풀이 통계 */
  stats: {
    questionId: number;
    submitted: number;
    correct: number;
    unanswered: number;
    choiceCounts: { choiceId: number; count: number }[];
    shortAnswers: { text: string; count: number; correct: boolean }[];
  }[];
};

export function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : "-";
}

export function buildGroupMarkdown(input: GroupSheetInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title} — ${input.roundNo}차시 협력 답안`);
  lines.push("");
  if (input.groupScore) {
    const s = input.groupScore;
    lines.push(`**팀 점수:** ${s.total ? Math.round((s.correct / s.total) * 1000) / 10 : 0}점 (${s.correct}/${s.total})`);
  } else {
    lines.push("**팀 점수:** 아직 제출하지 않음");
  }
  if (input.members.length) {
    lines.push(`**참가자:** ${input.members.map((m) => `${m.memberNo}번 ${m.nickname}`).join(", ")}`);
  }
  lines.push("");
  lines.push("범례: ☑ 팀 선택 · ✅ 정답 · % 는 개인풀이 제출 비율");
  lines.push("");
  for (const q of input.questions) {
    const stat = input.stats.find((s) => s.questionId === q.id);
    const submitted = stat?.submitted ?? 0;
    const ans = input.groupAnswers[q.id];
    lines.push(`## ${q.seq}. ${q.text}`);
    lines.push("");
    if (q.type === "MULTIPLE") {
      for (const c of q.choices) {
        const chosen = ans?.choiceIds.includes(c.id) ? "☑" : "☐";
        const count = stat?.choiceCounts.find((x) => x.choiceId === c.id)?.count ?? 0;
        lines.push(`- ${chosen} ${choiceMark(c.seq)} ${c.text}${c.isAnswer ? " ✅" : ""} — 개인 ${pct(count, submitted)}`);
      }
    } else {
      lines.push(`- 팀 답: **${ans?.text?.trim() || "(미선택)"}**`);
      lines.push(`- 정답: ${q.answers.join(", ")}`);
      if (stat && stat.shortAnswers.length) {
        lines.push("- 개인 답안:");
        for (const a of stat.shortAnswers) {
          lines.push(`  - ${a.text}${a.correct ? " ✅" : ""} — ${a.count}명 (${pct(a.count, submitted)})`);
        }
      }
    }
    lines.push(`- 개인 정답률 ${pct(stat?.correct ?? 0, submitted)} · 미선택 ${pct(stat?.unanswered ?? 0, submitted)} · 제출 ${submitted}명`);
    lines.push("");
    lines.push(`**해설:** ${q.explanation}`);
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function groupSheetFileName(title: string, roundNo: number, ext: "md" | "pdf"): string {
  const safe = title.replace(/[\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "시험지";
  return `${safe}_${roundNo}차시_협력답안.${ext}`;
}
