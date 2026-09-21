import { Title } from "@solidjs/meta";
import { createAsync, query, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { TopBar } from "@shared/ui/TopBar";
import { QuestionCard, type AnswerValue } from "@shared/ui/QuestionCard";
import { Countdown } from "@shared/ui/Countdown";
import {
  page, card, cardTitle, stack, muted, errorText, buttonPrimary, buttonSecondary, buttonSmall, buttonBlock,
  centerBox, heading, subheading, badge, badgePrimary, badgeSuccess, rowBetween, rowWrap, divider,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";
import { formatLocal } from "@shared/lib/time";
import type { GroupPage } from "@modules/room/room.controller";
import type { RoomState } from "@modules/room/room.service";

const enterGroup = query(async (token: string): Promise<GroupPage> => {
  "use server";
  const { enter } = await import("@modules/room/room.controller");
  return enter(token);
}, "groupEnter");

type Fail = { error: { code: string; message: string } };

async function transferFn(roomId: number, toMemberNo: number): Promise<{ ok: true } | Fail> {
  "use server";
  const { transferLeader } = await import("@modules/room/room.controller");
  try { transferLeader(roomId, toMemberNo); return { ok: true }; } catch (e) { return { error: describeError(e) }; }
}

async function startFn(roomId: number): Promise<{ ok: true } | Fail> {
  "use server";
  const { start } = await import("@modules/room/room.controller");
  try { start(roomId); return { ok: true }; } catch (e) { return { error: describeError(e) }; }
}

async function saveFn(roomId: number, questionId: number, answer: { choiceIds?: number[]; text?: string }): Promise<{ ok: true } | Fail> {
  "use server";
  const { saveAnswer } = await import("@modules/room/room.controller");
  try { saveAnswer(roomId, questionId, answer); return { ok: true }; } catch (e) { return { error: describeError(e) }; }
}

async function submitFn(roomId: number): Promise<{ ok: true } | Fail> {
  "use server";
  const { submit } = await import("@modules/room/room.controller");
  try { submit(roomId); return { ok: true }; } catch (e) { return { error: describeError(e) }; }
}

export const route = { preload: ({ params }: { params: { token: string } }) => enterGroup(params.token) };

export default function GroupRoute() {
  const params = useParams();
  const data = createAsync(() => enterGroup(params.token ?? ""));
  return (
    <>
      <Title>협력풀이</Title>
      <Show when={data()}>
        {(d) => (
          <Show when={d().kind === "room"} fallback={<Denied page={d() as Extract<GroupPage, { kind: "denied" }>} />}>
            <Room entry={d() as Extract<GroupPage, { kind: "room" }>} />
          </Show>
        )}
      </Show>
    </>
  );
}

function Denied(props: { page: Extract<GroupPage, { kind: "denied" }> }) {
  return (
    <main class={centerBox}>
      <h1 class={heading}>{props.page.examTitle ?? "협력풀이"}</h1>
      <p class={subheading}>{props.page.message}</p>
      <Show when={props.page.reason === "NOT_STARTED" && props.page.startsAt}>
        <p class={muted}>시작 시각: {formatLocal(props.page.startsAt!)}</p>
      </Show>
    </main>
  );
}

function Room(props: { entry: Extract<GroupPage, { kind: "room" }> }) {
  const [state, setState] = createStore<{ room: RoomState | null; error: string | null; connected: boolean }>({
    room: null, error: null, connected: false,
  });
  const [answers, setAnswers] = createStore<Record<number, AnswerValue>>({});
  const [busy, setBusy] = createSignal(false);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const roomId = () => props.entry.roomId;

  createEffect(() => {
    const es = new EventSource(`/api/group/${roomId()}/events`);
    es.addEventListener("state", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as RoomState | { error: { message: string } };
      if ("error" in data) {
        setState({ error: data.error.message, connected: true });
        return;
      }
      setState("room", reconcile(data));
      setState({ error: null, connected: true });
      // 방장이 아니면 서버 답안을 그대로 따라간다. 방장은 입력 중인 값을 지키되 서버 값으로 빈칸을 채운다.
      if (!data.me.isLeader) setAnswers(reconcile(data.answers));
      else for (const [qid, a] of Object.entries(data.answers)) if (!answers[Number(qid)]) setAnswers(Number(qid), a);
    });
    es.onerror = () => setState("connected", false);
    onCleanup(() => es.close());
  });

  const run = async (fn: () => Promise<{ ok: true } | Fail>) => {
    setBusy(true);
    setActionError(null);
    const r = await fn();
    if ("error" in r) setActionError(r.error.message);
    setBusy(false);
  };

  const onChange = (questionId: number, value: AnswerValue, isText: boolean) => {
    setAnswers(questionId, value);
    const prev = timers.get(questionId);
    if (prev) clearTimeout(prev);
    const send = () => run(() => saveFn(roomId(), questionId, value.choiceIds.length ? { choiceIds: value.choiceIds } : { text: value.text }));
    if (isText) timers.set(questionId, setTimeout(() => void send(), 500));
    else void send();
  };

  const room = () => state.room;
  const answeredCount = () => (room()?.questions ?? []).filter((q) => {
    const a = answers[q.id];
    return a && (a.choiceIds.length > 0 || a.text.trim().length > 0);
  }).length;

  return (
    <>
      <TopBar
        title={`${props.entry.examTitle} · ${props.entry.roundNo}차시 협력`}
        right={
          <Show when={room()?.started && !room()?.submitted && room()?.deadlineAt}>
            <Countdown deadlineAt={room()!.deadlineAt!} serverNow={room()!.serverNow} />
          </Show>
        }
      />
      <main class={page}>
        <Show when={state.error}><p class={errorText}>{state.error}</p></Show>
        <Show when={!state.connected}><p class={muted}>연결 중…</p></Show>
        <Show when={room()}>
          {(r) => (
            <>
              <div class={card}>
                <div class={stack}>
                  <div class={rowBetween}>
                    <span class={badgePrimary}>{r().me.memberNo}번 {r().me.nickname}{r().me.isLeader ? " 👑 방장" : ""}</span>
                    <span class={muted}>{r().members.length}명 참가</span>
                  </div>
                  <div class={rowWrap}>
                    <For each={r().members}>
                      {(m) => (
                        <span class={m.memberNo === r().leaderMemberNo ? badgePrimary : badge} style={{ opacity: m.online ? "1" : "0.45" }}>
                          {m.memberNo}번 {m.nickname}{m.memberNo === r().leaderMemberNo ? " 👑" : ""}
                        </span>
                      )}
                    </For>
                  </div>
                  <Show when={r().me.isLeader && !r().submitted && r().members.length > 1}>
                    <details>
                      <summary class={muted} style={{ cursor: "pointer" }}>방장 넘겨주기</summary>
                      <div class={rowWrap} style={{ "margin-top": "0.5rem" }}>
                        <For each={r().members.filter((m) => m.participantId !== r().me.participantId)}>
                          {(m) => (
                            <button class={buttonSmall} disabled={busy()} onClick={() => run(() => transferFn(roomId(), m.memberNo))}>
                              {m.memberNo}번 {m.nickname}에게
                            </button>
                          )}
                        </For>
                      </div>
                    </details>
                  </Show>
                </div>
              </div>

              <Show when={!r().started}>
                <div class={card} style={{ "text-align": "center" }}>
                  <div class={stack}>
                    <div class={cardTitle}>개인풀이 완료 대기</div>
                    <div style={{ "font-size": "2rem", "font-weight": "800" }}>{r().solo.done} / {r().solo.total}</div>
                    <p class={muted}>
                      {r().solo.total === 0
                        ? "개인풀이 응시자가 없어 바로 시작할 수 있어요."
                        : r().canStart ? "모두 제출했어요. 방장이 시작할 수 있어요." : "개인풀이가 모두 끝나면 시작할 수 있어요."}
                    </p>
                    <Show when={r().me.isLeader} fallback={<p class={muted}>방장({r().leaderMemberNo}번)이 시작하면 문제가 보여요.</p>}>
                      <button class={`${buttonPrimary} ${buttonBlock}`} disabled={!r().canStart || busy()} onClick={() => run(() => startFn(roomId()))}>
                        협력풀이 시작
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={r().started}>
                <Show when={r().submitted && r().result}>
                  <div class={card} style={{ "text-align": "center" }}>
                    <div class={stack}>
                      <span class={muted}>우리 팀 점수</span>
                      <div style={{ "font-size": "2.4rem", "font-weight": "800", color: "var(--som-theme-primary)" }}>{r().result!.scorePct}점</div>
                      <span class={muted}>{r().result!.correct} / {r().result!.total} 정답
                        <Show when={r().submitKind === "TIMEOUT"}> · 시간 초과로 자동 제출</Show>
                        <Show when={r().submitKind === "LINK_CLOSED"}> · 링크가 닫혀 자동 제출</Show>
                      </span>
                    </div>
                  </div>
                </Show>
                <Show when={!r().submitted}>
                  <div class={rowBetween}>
                    <span class={r().me.isLeader ? badgeSuccess : badge}>{r().me.isLeader ? "내가 입력합니다" : `${r().leaderMemberNo}번 방장이 입력 중`}</span>
                    <span class={muted}>{answeredCount()} / {r().questions.length} 답함</span>
                  </div>
                </Show>
                <For each={r().questions}>
                  {(q) => (
                    <QuestionCard
                      question={q}
                      answer={answers[q.id]}
                      disabled={!r().me.isLeader || r().submitted}
                      onChange={(v) => onChange(q.id, v, q.type === "SHORT")}
                      result={r().result?.perQuestion.find((p) => p.questionId === q.id)}
                      soloStat={r().soloStats[q.id]}
                    />
                  )}
                </For>
                <Show when={actionError()}><p class={errorText}>{actionError()}</p></Show>
                <Show when={r().me.isLeader && !r().submitted}>
                  <div class={divider} />
                  <button class={`${buttonPrimary} ${buttonBlock}`} disabled={busy()} onClick={() => {
                    const left = r().questions.length - answeredCount();
                    if (left > 0 && !confirm(`아직 ${left}문제를 답하지 않았어요. 그래도 제출할까요?`)) return;
                    void run(() => submitFn(roomId()));
                  }}>
                    제출하고 채점하기
                  </button>
                </Show>
                <Show when={r().submitted}>
                  <p class={muted} style={{ "text-align": "center" }}>수고했어요! 모두 같은 결과를 보고 있어요.</p>
                </Show>
              </Show>
            </>
          )}
        </Show>
        <Show when={!room() && !state.error}>
          <div class={centerBox}><button class={buttonSecondary} onClick={() => location.reload()}>다시 연결</button></div>
        </Show>
      </main>
    </>
  );
}
