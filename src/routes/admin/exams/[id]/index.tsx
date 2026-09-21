import { Title } from "@solidjs/meta";
import { A, action, createAsync, query, redirect, revalidate, useParams, useSubmission } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { TopBar } from "@shared/ui/TopBar";
import {
  page, card, cardTitle, buttonPrimary, buttonSecondary, buttonDanger, buttonSmall, buttonBlock,
  errorText, muted, stack, rowBetween, rowWrap, tabs, tab, tabActive, badge, badgePrimary,
  badgeSuccess, badgeDanger, field, fieldLabel, textInput, divider, subheading,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";
import { formatLocal, isoToLocalInput } from "@shared/lib/time";
import { choiceMark } from "@modules/export/markdown";
import type { ExamDetail, RoundView } from "@modules/exam/exam.service";
import type { GenerationJob } from "@modules/generation/generation.service";
import type { RoundResults } from "@modules/exam/exam.controller";
import { scorePercent } from "@modules/attempt/grading";

const getExam = query(async (id: number) => {
  "use server";
  const { examDetail } = await import("@modules/exam/exam.controller");
  return examDetail(id);
}, "examDetail");

const getRoundLinks = query(async (roundId: number) => {
  "use server";
  const { roundLinks } = await import("@modules/exam/exam.controller");
  return roundLinks(roundId);
}, "roundLinks");

const getRoundResults = query(async (roundId: number) => {
  "use server";
  const { roundResults } = await import("@modules/exam/exam.controller");
  return roundResults(roundId);
}, "roundResults");

const deleteExamAction = action(async (examId: number) => {
  "use server";
  const { deleteExam } = await import("@modules/exam/exam.controller");
  try {
    deleteExam(examId);
  } catch (e) {
    return { error: describeError(e).message };
  }
  throw redirect("/admin");
}, "deleteExam");

const createRoundAction = action(async (form: FormData) => {
  "use server";
  const { createRound, parseTimes } = await import("@modules/exam/exam.controller");
  try {
    createRound(Number(form.get("examId")), parseTimes(form));
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "createRound");

const deleteRoundAction = action(async (roundId: number) => {
  "use server";
  const { deleteRound } = await import("@modules/exam/exam.controller");
  try {
    deleteRound(roundId);
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "deleteRound");

const setLinkOpenAction = action(async (linkId: number, open: boolean) => {
  "use server";
  const { setLinkOpen } = await import("@modules/exam/exam.controller");
  try {
    setLinkOpen(linkId, open);
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "setLinkOpen");

const regenerateLinkAction = action(async (linkId: number) => {
  "use server";
  const { regenerateLink } = await import("@modules/exam/exam.controller");
  try {
    regenerateLink(linkId);
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "regenerateLink");

export const route = { preload: ({ params }: { params: { id: string } }) => getExam(Number(params.id)) };

const statusLabel: Record<string, string> = { SCHEDULED: "예정", OPEN: "진행 중", ENDED: "종료" };

export default function ExamDetailPage() {
  const params = useParams();
  const examId = () => Number(params.id);
  const exam = createAsync(() => getExam(examId()));
  const [view, setView] = createSignal<"questions" | "rounds" | "results">("questions");

  return (
    <>
      <Title>{exam()?.title ?? "시험지"}</Title>
      <TopBar
        title={exam()?.title ?? "시험지"}
        back="/admin"
        right={
          <Show when={exam() && !exam()!.generating}>
            <A class={buttonSmall} href={`/admin/exams/${examId()}/edit`}>
              수정
            </A>
          </Show>
        }
      />
      <main class={page}>
        <Show when={exam()}>
          {(e) => (
            <>
              <Show when={e().generating}>
                <GenerationProgress examId={examId()} />
              </Show>
              <div class={tabs}>
                <button class={view() === "questions" ? tabActive : tab} onClick={() => setView("questions")}>문제</button>
                <button class={view() === "rounds" ? tabActive : tab} onClick={() => setView("rounds")}>차시·링크</button>
                <button class={view() === "results" ? tabActive : tab} onClick={() => setView("results")}>결과</button>
              </div>
              <Show when={view() === "questions"}>
                <QuestionsView exam={e()} />
              </Show>
              <Show when={view() === "rounds"}>
                <RoundsView exam={e()} />
              </Show>
              <Show when={view() === "results"}>
                <ResultsView exam={e()} />
              </Show>
            </>
          )}
        </Show>
      </main>
    </>
  );
}

function GenerationProgress(props: { examId: number }) {
  const [job, setJob] = createSignal<GenerationJob | null>(null);
  createEffect(() => {
    const es = new EventSource(`/api/generation/${props.examId}`);
    es.addEventListener("state", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as GenerationJob | null;
      setJob(data);
      if (!data || data.finished) {
        es.close();
        void revalidate(getExam.keyFor(props.examId));
      }
    });
    es.onerror = () => { /* 브라우저가 자동 재접속 */ };
    onCleanup(() => es.close());
  });
  return (
    <div class={card} style={{ "border-color": "var(--som-theme-primary)" }}>
      <div class={stack}>
        <div class={rowBetween}>
          <span class={cardTitle} style={{ "margin-bottom": "0" }}>출제 중</span>
          <span class={badgePrimary}>{job()?.done ?? 0} / {job()?.total ?? "?"}</span>
        </div>
        <Show when={job()?.current}>
          <p class={muted}>지금: {job()!.current!.label}</p>
        </Show>
        <div style={{ height: "8px", "border-radius": "999px", background: "var(--som-theme-surface-muted)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${job() && job()!.total ? (job()!.done / job()!.total) * 100 : 0}%`,
            background: "var(--som-theme-primary)",
            transition: "width 300ms",
          }} />
        </div>
        <Show when={job()?.errors.length}>
          <For each={job()!.errors}>{(err) => <p class={errorText}>{err.label}: {err.message}</p>}</For>
        </Show>
      </div>
    </div>
  );
}

function QuestionsView(props: { exam: ExamDetail }) {
  const [showAnswers, setShowAnswers] = createSignal(false);
  const sourceLabel = (sourceId: number) => props.exam.sources.find((s) => s.id === sourceId)?.label ?? "";
  return (
    <div class={stack}>
      <div class={rowBetween}>
        <span class={muted}>{props.exam.latestRound.roundNo}차시 기준 · {props.exam.questions.length}문제</span>
        <button class={showAnswers() ? buttonPrimary : buttonSecondary} style={{ "min-height": "36px", padding: "0.3rem 0.8rem" }} onClick={() => setShowAnswers(!showAnswers())}>
          {showAnswers() ? "해설 숨기기" : "해설 보기"}
        </button>
      </div>
      <div class={rowWrap}>
        <a class={buttonSmall} href={`/api/exams/${props.exam.id}/sheet?format=md&answers=0`} download="">문제지 md</a>
        <a class={buttonSmall} href={`/api/exams/${props.exam.id}/sheet?format=pdf&answers=0`} download="">문제지 pdf</a>
        <a class={buttonSmall} href={`/api/exams/${props.exam.id}/sheet?format=md&answers=1`} download="">답안지 md</a>
        <a class={buttonSmall} href={`/api/exams/${props.exam.id}/sheet?format=pdf&answers=1`} download="">답안지 pdf</a>
      </div>
      <For each={props.exam.sources}>
        {(s) => (
          <Show when={s.lastError}>
            <p class={errorText}>{s.label}: {s.lastError} — 수정 화면에서 재출제할 수 있습니다.</p>
          </Show>
        )}
      </For>
      <For each={props.exam.questions}>
        {(q, i) => (
          <>
            <Show when={i() === 0 || props.exam.questions[i() - 1].sourceId !== q.sourceId}>
              <div class={muted} style={{ "margin-top": "0.5rem", "font-weight": "600" }}>📄 {sourceLabel(q.sourceId)}</div>
            </Show>
            <div class={card}>
              <div class={stack}>
                <div style={{ "font-weight": "600", "line-height": "1.5" }}>
                  <span class={badge} style={{ "margin-right": "0.4rem" }}>{q.seq}</span>
                  {q.text}
                </div>
                <Show when={q.type === "MULTIPLE"}>
                  <ul class={stack} style={{ gap: "0.35rem" }}>
                    <For each={q.choices}>
                      {(c) => (
                        <li style={{
                          padding: "0.4rem 0.6rem",
                          "border-radius": "0.5rem",
                          background: showAnswers() && c.isAnswer ? "var(--som-theme-mark)" : "transparent",
                          "font-weight": showAnswers() && c.isAnswer ? "700" : "400",
                        }}>
                          {choiceMark(c.seq)} {c.text}
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
                <Show when={showAnswers()}>
                  <div class={divider} />
                  <Show when={q.type === "SHORT"}>
                    <p><strong>정답:</strong> {q.answers[0]}</p>
                    <Show when={q.answers.length > 1}>
                      <p class={muted}>인정 답안: {q.answers.slice(1).join(", ")}</p>
                    </Show>
                  </Show>
                  <p style={{ "line-height": "1.6" }}><strong>해설:</strong> {q.explanation}</p>
                </Show>
              </div>
            </div>
          </>
        )}
      </For>
    </div>
  );
}

function RoundsView(props: { exam: ExamDetail }) {
  const createSub = useSubmission(createRoundAction);
  const deleteExamSub = useSubmission(deleteExamAction);
  const [showNew, setShowNew] = createSignal(false);
  const latest = () => props.exam.latestRound;
  return (
    <div class={stack}>
      <For each={[...props.exam.rounds].reverse()}>{(r) => <RoundCard round={r} />}</For>

      <Show when={showNew()} fallback={
        <button class={`${buttonSecondary} ${buttonBlock}`} onClick={() => setShowNew(true)} disabled={props.exam.generating}>
          + 같은 문제로 새 차시 만들기
        </button>
      }>
        <form action={createRoundAction} method="post" class={card}>
          <div class={stack}>
            <div class={cardTitle}>새 차시 ({props.exam.rounds.length + 1}차시)</div>
            <input type="hidden" name="examId" value={props.exam.id} />
            <div class={field}>
              <label class={fieldLabel}>시작 시각</label>
              <input name="startsAt" type="datetime-local" class={textInput} value={isoToLocalInput(latest().startsAt)} required />
            </div>
            <div class={field}>
              <label class={fieldLabel}>종료 시각</label>
              <input name="endsAt" type="datetime-local" class={textInput} value={isoToLocalInput(latest().endsAt)} required />
            </div>
            <div class={rowWrap}>
              <div class={field} style={{ flex: "1" }}>
                <label class={fieldLabel}>개인 제한(분)</label>
                <input name="soloLimitMin" type="number" class={textInput} value={latest().soloLimitMin} min={1} max={600} required />
              </div>
              <div class={field} style={{ flex: "1" }}>
                <label class={fieldLabel}>협력 제한(분)</label>
                <input name="groupLimitMin" type="number" class={textInput} value={latest().groupLimitMin} min={1} max={600} required />
              </div>
            </div>
            <Show when={createSub.result?.error}><p class={errorText}>{createSub.result?.error}</p></Show>
            <div class={rowWrap}>
              <button type="submit" class={buttonPrimary} disabled={createSub.pending}>만들기</button>
              <button type="button" class={buttonSecondary} onClick={() => setShowNew(false)}>취소</button>
            </div>
          </div>
        </form>
      </Show>

      <div class={divider} />
      <Show when={deleteExamSub.result?.error}><p class={errorText}>{deleteExamSub.result?.error}</p></Show>
      <form action={deleteExamAction.with(props.exam.id)} method="post" onSubmit={(e) => {
        if (!confirm("시험지와 모든 차시·응시 기록을 완전히 삭제합니다. 계속할까요?")) e.preventDefault();
      }}>
        <button type="submit" class={`${buttonDanger} ${buttonBlock}`} disabled={deleteExamSub.pending}>시험지 완전 삭제</button>
      </form>
    </div>
  );
}

function RoundCard(props: { round: RoundView }) {
  const [open, setOpen] = createSignal(false);
  const links = createAsync(() => (open() ? getRoundLinks(props.round.id) : Promise.resolve(null)));
  const deleteSub = useSubmission(deleteRoundAction);
  const linkSub = useSubmission(setLinkOpenAction);
  const regenSub = useSubmission(regenerateLinkAction);
  const [copied, setCopied] = createSignal<number | null>(null);
  const copy = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("링크를 복사하세요", url);
    }
  };
  return (
    <div class={card}>
      <div class={stack}>
        <div class={rowBetween}>
          <span class={subheading}>{props.round.roundNo}차시</span>
          <span class={props.round.status === "OPEN" ? badgeSuccess : badge}>{statusLabel[props.round.status]}</span>
        </div>
        <p class={muted}>{formatLocal(props.round.startsAt)} ~ {formatLocal(props.round.endsAt)}</p>
        <div class={rowWrap}>
          <span class={badge}>개인 {props.round.soloLimitMin}분</span>
          <span class={badge}>협력 {props.round.groupLimitMin}분</span>
          <span class={badge}>개인풀이 {props.round.soloDone}/{props.round.soloAttempts}명 완료</span>
          <span class={props.round.groupSubmitted ? badgeSuccess : props.round.groupStarted ? badgePrimary : badge}>
            협력 {props.round.groupSubmitted ? "완료" : props.round.groupStarted ? "진행 중" : "대기"}
          </span>
        </div>
        <button class={buttonSecondary} onClick={() => setOpen(!open())}>{open() ? "링크 닫기" : "QR·링크 보기"}</button>
        <Show when={open() && links()}>
          {(l) => (
            <For each={l().links}>
              {(link) => (
                <div class={stack} style={{ padding: "0.75rem", "border-radius": "0.75rem", background: "var(--som-theme-surface-muted)" }}>
                  <div class={rowBetween}>
                    <strong>{link.mode === "SOLO" ? "개인풀이" : "협력풀이"}</strong>
                    <span class={link.isOpen ? badgeSuccess : badgeDanger}>{link.isOpen ? "열림" : "닫힘"}</span>
                  </div>
                  <div style={{ width: "160px", margin: "0 auto", opacity: link.isOpen ? "1" : "0.35" }} innerHTML={link.qr} />
                  <div class={muted} style={{ "word-break": "break-all", "font-size": "0.8rem" }}>{link.url}</div>
                  <div class={rowWrap}>
                    <button class={buttonSmall} onClick={() => copy(link.id, link.url)}>{copied() === link.id ? "복사됨" : "링크 복사"}</button>
                    <form action={setLinkOpenAction.with(link.id, !link.isOpen)} method="post" onSubmit={(e) => {
                      if (link.isOpen && link.mode === "SOLO" && !confirm("개인 링크를 닫으면 풀고 있던 사람은 그 자리에서 제출 처리됩니다. 닫을까요?")) e.preventDefault();
                    }}>
                      <button type="submit" class={buttonSmall} disabled={linkSub.pending}>{link.isOpen ? "닫기" : "열기"}</button>
                    </form>
                    <form action={regenerateLinkAction.with(link.id)} method="post" onSubmit={(e) => {
                      if (!confirm("링크를 재발급하면 이전 링크와 QR은 더 이상 쓸 수 없습니다.")) e.preventDefault();
                    }}>
                      <button type="submit" class={buttonSmall} disabled={regenSub.pending}>재발급</button>
                    </form>
                  </div>
                </div>
              )}
            </For>
          )}
        </Show>
        <Show when={linkSub.result?.error}><p class={errorText}>{linkSub.result?.error}</p></Show>
        <Show when={deleteSub.result?.error}><p class={errorText}>{deleteSub.result?.error}</p></Show>
        <form action={deleteRoundAction.with(props.round.id)} method="post" onSubmit={(e) => {
          if (!confirm(`${props.round.roundNo}차시와 그 응시 기록을 삭제합니다. 계속할까요?`)) e.preventDefault();
        }}>
          <button type="submit" class={buttonSmall} style={{ color: "var(--som-theme-danger)" }} disabled={deleteSub.pending}>차시 삭제</button>
        </form>
      </div>
    </div>
  );
}

function ResultsView(props: { exam: ExamDetail }) {
  const [roundId, setRoundId] = createSignal(props.exam.latestRound.id);
  const [mode, setMode] = createSignal<"solo" | "group">("solo");
  const [showAnswers, setShowAnswers] = createSignal(false);
  const results = createAsync(() => getRoundResults(roundId()));
  return (
    <div class={stack}>
      <div class={rowWrap}>
        <For each={props.exam.rounds}>
          {(r) => (
            <button class={roundId() === r.id ? buttonPrimary : buttonSmall} style={{ "min-height": "36px", padding: "0.3rem 0.8rem" }} onClick={() => setRoundId(r.id)}>
              {r.roundNo}차시
            </button>
          )}
        </For>
      </div>
      <div class={tabs}>
        <button class={mode() === "solo" ? tabActive : tab} onClick={() => setMode("solo")}>개인</button>
        <button class={mode() === "group" ? tabActive : tab} onClick={() => setMode("group")}>단체</button>
      </div>
      <div class={rowBetween}>
        <span class={muted}>{results()?.roundNo}차시 결과</span>
        <button class={showAnswers() ? buttonPrimary : buttonSecondary} style={{ "min-height": "36px", padding: "0.3rem 0.8rem" }} onClick={() => setShowAnswers(!showAnswers())}>
          {showAnswers() ? "정답 숨김" : "정답 표시"}
        </button>
      </div>
      <Show when={results()}>
        {(r) => (
          <Show when={mode() === "solo"} fallback={<GroupResults results={r()} showAnswers={showAnswers()} />}>
            <SoloResults results={r()} showAnswers={showAnswers()} />
          </Show>
        )}
      </Show>
    </div>
  );
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : "-";
}

function SoloResults(props: { results: RoundResults; showAnswers: boolean }) {
  const kindLabel: Record<string, string> = { MANUAL: "", TIMEOUT: "시간 초과", LINK_CLOSED: "링크 닫힘", GROUP_STARTED: "협력 시작" };
  return (
    <div class={stack}>
      <div class={card}>
        <div class={cardTitle}>응시자별 점수 ({props.results.scores.length}명)</div>
        <Show when={props.results.scores.length > 0} fallback={<p class={muted}>아직 응시자가 없습니다.</p>}>
          <table style={{ width: "100%", "border-collapse": "collapse", "font-size": "0.92rem" }}>
            <thead>
              <tr style={{ color: "var(--som-theme-text-muted)", "text-align": "left" }}>
                <th style={{ padding: "0.3rem 0" }}>닉네임</th><th>점수</th><th>제출</th>
              </tr>
            </thead>
            <tbody>
              <For each={props.results.scores}>
                {(s) => (
                  <tr style={{ "border-top": "1px solid var(--som-theme-border)" }}>
                    <td style={{ padding: "0.4rem 0" }}>{s.nickname}</td>
                    <td><strong>{s.scorePct === null ? "풀이 중" : `${s.scorePct}점`}</strong>
                      <Show when={s.total !== null}><span class={muted}> ({s.correct}/{s.total})</span></Show></td>
                    <td class={muted}>{s.submittedAt ? formatLocal(s.submittedAt).slice(5) : "-"}
                      <Show when={s.submitKind && kindLabel[s.submitKind]}> <span class={badge}>{kindLabel[s.submitKind!]}</span></Show></td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
      <For each={props.results.questions}>
        {(q) => {
          const stat = () => props.results.stats.find((s) => s.questionId === q.id)!;
          return (
            <div class={card}>
              <div class={stack}>
                <div style={{ "font-weight": "600" }}><span class={badge} style={{ "margin-right": "0.4rem" }}>{q.seq}</span>{q.text}</div>
                <div class={rowWrap}>
                  <span class={badgePrimary}>정답률 {pct(stat().correct, stat().submitted)}</span>
                  <span class={badge}>미선택 {pct(stat().unanswered, stat().submitted)}</span>
                  <span class={muted}>제출 {stat().submitted}명</span>
                </div>
                <Show when={q.type === "MULTIPLE"}>
                  <For each={q.choices}>
                    {(c) => {
                      const count = () => stat().choiceCounts.find((x) => x.choiceId === c.id)?.count ?? 0;
                      const isAns = () => props.showAnswers && c.isAnswer;
                      return (
                        <div>
                          <div class={rowBetween} style={{ "font-size": "0.92rem", "font-weight": isAns() ? "700" : "400" }}>
                            <span>{choiceMark(c.seq)} {c.text}{isAns() ? " ✓" : ""}</span>
                            <span class={muted}>{pct(count(), stat().submitted)}</span>
                          </div>
                          <Bar ratio={stat().submitted ? count() / stat().submitted : 0} highlight={isAns()} />
                        </div>
                      );
                    }}
                  </For>
                </Show>
                <Show when={q.type === "SHORT"}>
                  <Show when={props.showAnswers}><p><strong>정답:</strong> {q.answers.join(", ")}</p></Show>
                  <Show when={stat().shortAnswers.length > 0} fallback={<p class={muted}>제출된 답안이 없습니다.</p>}>
                    <For each={stat().shortAnswers}>
                      {(a) => (
                        <div>
                          <div class={rowBetween} style={{ "font-size": "0.92rem" }}>
                            <span style={{ "font-weight": props.showAnswers && a.correct ? "700" : "400" }}>{a.text}{props.showAnswers && a.correct ? " ✓" : ""}</span>
                            <span class={muted}>{a.count}명 · {pct(a.count, stat().submitted)}</span>
                          </div>
                          <Bar ratio={stat().submitted ? a.count / stat().submitted : 0} highlight={props.showAnswers && a.correct} />
                        </div>
                      )}
                    </For>
                  </Show>
                </Show>
                <Show when={props.showAnswers}><p class={muted} style={{ "line-height": "1.6" }}>해설: {q.explanation}</p></Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function GroupResults(props: { results: RoundResults; showAnswers: boolean }) {
  const g = () => props.results.group;
  return (
    <div class={stack}>
      <Show when={g()} fallback={<div class={card}><p class={muted}>아직 협력풀이 방이 열리지 않았습니다.</p></div>}>
        {(room) => (
          <>
            <div class={card}>
              <div class={stack}>
                <div class={rowBetween}>
                  <span class={cardTitle} style={{ "margin-bottom": "0" }}>협력풀이</span>
                  <span class={room().submitted ? badgeSuccess : room().started ? badgePrimary : badge}>
                    {room().submitted ? "완료" : room().started ? "진행 중" : "대기"}
                  </span>
                </div>
                <Show when={room().result}>
                  <p style={{ "font-size": "1.4rem", "font-weight": "800" }}>{scorePercent(room().result!.correct, room().result!.total)}점
                    <span class={muted} style={{ "font-size": "0.9rem" }}> ({room().result!.correct}/{room().result!.total})</span></p>
                </Show>
                <div class={rowWrap}>
                  <For each={room().members}>
                    {(m) => <span class={m.memberNo === room().leaderMemberNo ? badgePrimary : badge}>{m.memberNo}번 {m.nickname}{m.memberNo === room().leaderMemberNo ? " 👑" : ""}</span>}
                  </For>
                </div>
              </div>
            </div>
            <For each={props.results.questions}>
              {(q) => {
                const ans = () => room().answers[q.id];
                const pq = () => room().result?.perQuestion.find((p) => p.questionId === q.id);
                return (
                  <div class={card}>
                    <div class={stack}>
                      <div style={{ "font-weight": "600" }}>
                        <span class={badge} style={{ "margin-right": "0.4rem" }}>{q.seq}</span>{q.text}
                        <Show when={pq()}><span class={pq()!.correct ? badgeSuccess : badgeDanger} style={{ "margin-left": "0.4rem" }}>{pq()!.correct ? "정답" : pq()!.answered ? "오답" : "미선택"}</span></Show>
                      </div>
                      <Show when={q.type === "MULTIPLE"}>
                        <For each={q.choices}>
                          {(c) => {
                            const chosen = () => ans()?.choiceIds.includes(c.id);
                            const isAns = () => props.showAnswers && c.isAnswer;
                            return (
                              <div style={{ padding: "0.3rem 0.5rem", "border-radius": "0.5rem", background: isAns() ? "var(--som-theme-mark)" : "transparent", "font-weight": chosen() ? "700" : "400" }}>
                                {chosen() ? "☑" : "☐"} {choiceMark(c.seq)} {c.text}{isAns() ? " ✓" : ""}
                              </div>
                            );
                          }}
                        </For>
                      </Show>
                      <Show when={q.type === "SHORT"}>
                        <p>제출 답: <strong>{ans()?.text || "(미선택)"}</strong></p>
                        <Show when={props.showAnswers}><p class={muted}>정답: {q.answers.join(", ")}</p></Show>
                      </Show>
                      <Show when={props.showAnswers}><p class={muted} style={{ "line-height": "1.6" }}>해설: {q.explanation}</p></Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </>
        )}
      </Show>
    </div>
  );
}

function Bar(props: { ratio: number; highlight?: boolean }) {
  return (
    <div style={{ height: "6px", "border-radius": "999px", background: "var(--som-theme-surface-muted)", overflow: "hidden", "margin-top": "2px" }}>
      <div style={{ height: "100%", width: `${Math.round(props.ratio * 100)}%`, background: props.highlight ? "var(--som-theme-success)" : "var(--som-theme-primary)" }} />
    </div>
  );
}
