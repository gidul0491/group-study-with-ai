import { Title } from "@solidjs/meta";
import { action, createAsync, query, revalidate, useParams, useSubmission } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { TopBar } from "@shared/ui/TopBar";
import { QuestionCard, type AnswerValue } from "@shared/ui/QuestionCard";
import { Countdown } from "@shared/ui/Countdown";
import {
  page, card, stack, muted, errorText, buttonPrimary, buttonBlock, centerBox, heading, subheading, badge, badgePrimary, rowBetween,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";
import { formatLocal } from "@shared/lib/time";
import type { SoloPage } from "@modules/attempt/attempt.controller";

const enterSolo = query(async (token: string): Promise<SoloPage> => {
  "use server";
  const { enter } = await import("@modules/attempt/attempt.controller");
  return enter(token);
}, "soloEnter");

type SaveResult = { ok: true } | { error: { code: string; message: string } };

async function saveAnswerFn(token: string, questionId: number, answer: { choiceIds?: number[]; text?: string }): Promise<SaveResult> {
  "use server";
  const { saveAnswer } = await import("@modules/attempt/attempt.controller");
  try {
    saveAnswer(token, questionId, answer);
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e) };
  }
}

const submitAction = action(async (token: string) => {
  "use server";
  const { submit } = await import("@modules/attempt/attempt.controller");
  try {
    submit(token);
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "submitSolo");

export const route = { preload: ({ params }: { params: { token: string } }) => enterSolo(params.token) };

export default function SoloRoute() {
  const params = useParams();
  const token = () => params.token ?? "";
  const data = createAsync(() => enterSolo(token()));

  return (
    <>
      <Title>개인풀이</Title>
      <Show when={data()}>
        {(d) => (
          <Show when={d().kind === "state"} fallback={<Denied page={d() as Extract<SoloPage, { kind: "denied" }>} />}>
            <Solving page={d() as Extract<SoloPage, { kind: "state" }>} token={token()} />
          </Show>
        )}
      </Show>
    </>
  );
}

function Denied(props: { page: Extract<SoloPage, { kind: "denied" }> }) {
  return (
    <main class={centerBox}>
      <h1 class={heading}>{props.page.info?.examTitle ?? "개인풀이"}</h1>
      <p class={subheading}>{props.page.message}</p>
      <Show when={props.page.reason === "NOT_STARTED" && props.page.info}>
        <p class={muted}>시작 시각: {formatLocal(props.page.info!.startsAt)}</p>
      </Show>
    </main>
  );
}

function Solving(props: { page: Extract<SoloPage, { kind: "state" }>; token: string }) {
  const state = () => props.page.state;
  const [answers, setAnswers] = createStore<Record<number, AnswerValue>>(structuredClone(state().answers));
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const submission = useSubmission(submitAction);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  const persist = async (questionId: number, value: AnswerValue) => {
    const r = await saveAnswerFn(props.token, questionId, value.choiceIds.length ? { choiceIds: value.choiceIds } : { text: value.text });
    if ("error" in r) {
      setSaveError(r.error.message);
      if (["LINK_CLOSED", "ALREADY_SUBMITTED"].includes(r.error.code)) void revalidate(enterSolo.keyFor(props.token));
    } else {
      setSaveError(null);
    }
  };

  const onChange = (questionId: number, value: AnswerValue, isText: boolean) => {
    setAnswers(questionId, value);
    const prev = timers.get(questionId);
    if (prev) clearTimeout(prev);
    if (isText) {
      timers.set(questionId, setTimeout(() => void persist(questionId, value), 500));
    } else {
      void persist(questionId, value);
    }
  };

  const answeredCount = () => state().questions.filter((q) => {
    const a = answers[q.id];
    return a && (a.choiceIds.length > 0 || a.text.trim().length > 0);
  }).length;

  const onExpire = () => {
    setTimeout(() => void revalidate(enterSolo.keyFor(props.token)), 800);
  };

  return (
    <>
      <TopBar
        title={`${state().examTitle} · ${state().roundNo}차시`}
        right={
          <Show when={!state().submitted}>
            <Countdown deadlineAt={state().deadlineAt} serverNow={state().serverNow} onExpire={onExpire} />
          </Show>
        }
      />
      <main class={page}>
        <div class={rowBetween}>
          <span class={badgePrimary}>🙋 {state().nickname}</span>
          <Show when={!state().submitted}>
            <span class={muted}>{answeredCount()} / {state().questions.length} 답함</span>
          </Show>
        </div>

        <Show when={state().submitted && state().result}>
          <div class={card} style={{ "text-align": "center" }}>
            <div class={stack}>
              <span class={muted}>내 점수</span>
              <div style={{ "font-size": "2.4rem", "font-weight": "800", color: "var(--som-theme-primary)" }}>{state().result!.scorePct}점</div>
              <span class={muted}>{state().result!.correct} / {state().result!.total} 정답
                <Show when={state().submitKind === "TIMEOUT"}> · 시간 초과로 자동 제출</Show>
                <Show when={state().submitKind === "LINK_CLOSED"}> · 링크가 닫혀 자동 제출</Show>
              </span>
            </div>
          </div>
        </Show>

        <For each={state().questions}>
          {(q) => (
            <QuestionCard
              question={q}
              answer={answers[q.id]}
              disabled={state().submitted}
              onChange={(v) => onChange(q.id, v, q.type === "SHORT")}
              result={state().result?.perQuestion.find((p) => p.questionId === q.id)}
            />
          )}
        </For>

        <Show when={saveError()}><p class={errorText}>{saveError()}</p></Show>
        <Show when={submission.result?.error}><p class={errorText}>{submission.result?.error}</p></Show>

        <Show when={!state().submitted}>
          <form action={submitAction.with(props.token)} method="post" onSubmit={(e) => {
            const left = state().questions.length - answeredCount();
            if (left > 0 && !confirm(`아직 ${left}문제를 답하지 않았어요. 그래도 제출할까요?`)) e.preventDefault();
          }}>
            <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={submission.pending}>
              {submission.pending ? "채점 중…" : "제출하고 채점하기"}
            </button>
          </form>
        </Show>
        <Show when={state().submitted}>
          <p class={muted} style={{ "text-align": "center" }}>수고했어요! 이 화면은 다시 열어도 볼 수 있어요.</p>
        </Show>
        <span class={badge} style={{ "align-self": "center" }}>제한시간이 끝나면 자동으로 제출됩니다</span>
      </main>
    </>
  );
}
