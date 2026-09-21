import { For, Show } from "solid-js";
import { style } from "som-style/solid";
import { theme } from "@style/theme.js";
import { card, stack, badge, badgeSuccess, badgeDanger, muted, divider, rowBetween } from "./layout.style";
import { choiceMark } from "@modules/export/markdown";
import type { PublicQuestion } from "@modules/exam/question.view";

export type AnswerValue = { choiceIds: number[]; text: string };

export type QuestionResult = {
  answered: boolean;
  correct: boolean;
  answerChoiceIds: number[];
  answerTexts: string[];
  explanation: string;
};

export type SoloStat = {
  submitted: number;
  unanswered: number;
  choiceCounts: { choiceId: number; count: number }[];
  shortAnswers: { text: string; count: number }[];
};

const choiceRow = style({
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.6rem",
    minHeight: "44px",
    padding: "0.55rem 0.7rem",
    borderRadius: "0.7rem",
    border: `1px solid ${theme.border}`,
    background: theme.surface,
    cursor: "pointer",
    lineHeight: "1.45",
    "&:hover": { borderColor: theme.borderStrong },
  },
});

const choiceRowSelected = choiceRow.extend({
  base: { borderColor: theme.primary, background: theme.mark, fontWeight: "600" },
});

const choiceRowAnswer = choiceRow.extend({
  base: { borderColor: theme.success, background: "oklch(0.95 0.04 145)" },
});

const choiceRowDisabled = choiceRow.extend({
  base: { cursor: "default", opacity: "0.7" },
});

const shortInput = style({
  base: {
    width: "100%",
    minHeight: "44px",
    padding: "0.6rem 0.8rem",
    borderRadius: "0.7rem",
    border: `1px solid ${theme.borderStrong}`,
    background: theme.surface,
    fontSize: "1rem",
    outline: "none",
    "&:focus": { borderColor: theme.primary, boxShadow: `0 0 0 3px ${theme.primaryFocus}` },
    "&:disabled": { background: theme.surfaceMuted },
  },
});

const statBar = style({
  base: {
    height: "5px",
    borderRadius: "999px",
    background: theme.surfaceMuted,
    overflow: "hidden",
    marginTop: "3px",
  },
});

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : "0%";
}

export function QuestionCard(props: {
  question: PublicQuestion;
  answer?: AnswerValue;
  disabled?: boolean;
  onChange?: (value: AnswerValue) => void;
  result?: QuestionResult;
  soloStat?: SoloStat;
}) {
  const selected = () => props.answer?.choiceIds ?? [];
  const multi = () => props.question.maxAnswerCount > 1;

  const toggle = (id: number) => {
    if (props.disabled || !props.onChange) return;
    let next: number[];
    if (!multi()) {
      next = selected().includes(id) ? [] : [id];
    } else if (selected().includes(id)) {
      next = selected().filter((x) => x !== id);
    } else {
      if (selected().length >= props.question.maxAnswerCount) return;
      next = [...selected(), id];
    }
    props.onChange({ choiceIds: next, text: "" });
  };

  const rowClass = (id: number, isAnswer: boolean) => {
    if (props.result && isAnswer) return choiceRowAnswer;
    if (selected().includes(id)) return choiceRowSelected;
    return props.disabled ? choiceRowDisabled : choiceRow;
  };

  return (
    <div class={card} id={`q-${props.question.id}`}>
      <div class={stack}>
        <div class={rowBetween}>
          <span class={badge}>
            {props.question.seq}번 · {props.question.type === "MULTIPLE" ? (multi() ? `객관식 (최대 ${props.question.maxAnswerCount}개)` : "객관식") : "주관식"}
          </span>
          <Show when={props.result}>
            <span class={props.result!.correct ? badgeSuccess : badgeDanger}>
              {props.result!.correct ? "정답" : props.result!.answered ? "오답" : "미선택"}
            </span>
          </Show>
        </div>
        <div style={{ "font-weight": "600", "line-height": "1.55", "font-size": "1.02rem" }}>{props.question.text}</div>

        <Show when={props.question.type === "MULTIPLE"}>
          <div class={stack} style={{ gap: "0.45rem" }}>
            <For each={props.question.choices}>
              {(c) => {
                const isAnswer = () => props.result?.answerChoiceIds.includes(c.id) ?? false;
                const stat = () => props.soloStat?.choiceCounts.find((x) => x.choiceId === c.id)?.count ?? 0;
                return (
                  <div>
                    <label class={rowClass(c.id, isAnswer())} onClick={(e) => { e.preventDefault(); toggle(c.id); }}>
                      <input
                        type={multi() ? "checkbox" : "radio"}
                        checked={selected().includes(c.id)}
                        disabled={props.disabled}
                        style={{ "margin-top": "0.25rem", "accent-color": "var(--som-theme-primary)" }}
                        tabIndex={-1}
                      />
                      <span style={{ flex: "1" }}>
                        <strong style={{ "margin-right": "0.3rem" }}>{choiceMark(c.seq)}</strong>
                        {c.text}
                        <Show when={isAnswer()}> ✓</Show>
                      </span>
                      <Show when={props.soloStat}>
                        <span class={muted} style={{ "white-space": "nowrap" }}>{pct(stat(), props.soloStat!.submitted)}</span>
                      </Show>
                    </label>
                    <Show when={props.soloStat}>
                      <div class={statBar}>
                        <div style={{ height: "100%", width: pct(stat(), props.soloStat!.submitted), background: "var(--som-theme-primary)" }} />
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
            <Show when={props.soloStat}>
              <p class={muted}>개인풀이 {props.soloStat!.submitted}명 · 미선택 {pct(props.soloStat!.unanswered, props.soloStat!.submitted)}</p>
            </Show>
          </div>
        </Show>

        <Show when={props.question.type === "SHORT"}>
          <input
            class={shortInput}
            type="text"
            value={props.answer?.text ?? ""}
            placeholder="답을 입력하세요"
            disabled={props.disabled}
            maxLength={200}
            autocomplete="off"
            onInput={(e) => props.onChange?.({ choiceIds: [], text: e.currentTarget.value })}
          />
          <Show when={props.soloStat}>
            <div class={stack} style={{ gap: "0.3rem" }}>
              <p class={muted}>개인풀이 답안 ({props.soloStat!.submitted}명 · 미선택 {pct(props.soloStat!.unanswered, props.soloStat!.submitted)})</p>
              <For each={props.soloStat!.shortAnswers}>
                {(a) => (
                  <div>
                    <div class={rowBetween} style={{ "font-size": "0.92rem" }}>
                      <span>{a.text}</span>
                      <span class={muted}>{a.count}명 · {pct(a.count, props.soloStat!.submitted)}</span>
                    </div>
                    <div class={statBar}>
                      <div style={{ height: "100%", width: pct(a.count, props.soloStat!.submitted), background: "var(--som-theme-primary)" }} />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>

        <Show when={props.result}>
          <div class={divider} />
          <Show when={props.question.type === "SHORT"}>
            <p><strong>정답:</strong> {props.result!.answerTexts[0]}
              <Show when={props.result!.answerTexts.length > 1}>
                <span class={muted}> (인정: {props.result!.answerTexts.slice(1).join(", ")})</span>
              </Show>
            </p>
          </Show>
          <p style={{ "line-height": "1.6" }}><strong>해설:</strong> {props.result!.explanation}</p>
        </Show>
      </div>
    </div>
  );
}
