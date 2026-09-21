import { Title } from "@solidjs/meta";
import { A, action, createAsync, query, useParams, useSubmission } from "@solidjs/router";
import { For, Show } from "solid-js";
import { TopBar } from "@shared/ui/TopBar";
import {
  page, card, cardTitle, stack, muted, errorText, buttonPrimary, buttonSmall, field, fieldLabel, textInput,
  rowBetween, rowWrap, badge, badgePrimary, divider,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";
import { isoToLocalInput } from "@shared/lib/time";
import { choiceMark } from "@modules/export/markdown";

const getExam = query(async (id: number) => {
  "use server";
  const { examDetail } = await import("@modules/exam/exam.controller");
  return examDetail(id);
}, "examDetail");

const updateTimesAction = action(async (form: FormData) => {
  "use server";
  const { updateRoundTimes, parseTimes } = await import("@modules/exam/exam.controller");
  try {
    updateRoundTimes(Number(form.get("examId")), parseTimes(form));
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "updateTimes");

const deleteSourceAction = action(async (examId: number, sourceId: number) => {
  "use server";
  const { deleteSource } = await import("@modules/exam/exam.controller");
  try { deleteSource(examId, sourceId); return { ok: true as const }; } catch (e) { return { error: describeError(e).message }; }
}, "deleteSource");

const regenerateSourceAction = action(async (examId: number, sourceId: number) => {
  "use server";
  const { regenerateSource } = await import("@modules/exam/exam.controller");
  try { await regenerateSource(examId, sourceId); return { ok: true as const }; } catch (e) { return { error: describeError(e).message }; }
}, "regenerateSource");

const deleteQuestionAction = action(async (examId: number, questionId: number) => {
  "use server";
  const { deleteQuestion } = await import("@modules/exam/exam.controller");
  try { deleteQuestion(examId, questionId); return { ok: true as const }; } catch (e) { return { error: describeError(e).message }; }
}, "deleteQuestion");

const regenerateQuestionAction = action(async (examId: number, questionId: number) => {
  "use server";
  const { regenerateQuestion } = await import("@modules/exam/exam.controller");
  try { await regenerateQuestion(examId, questionId); return { ok: true as const }; } catch (e) { return { error: describeError(e).message }; }
}, "regenerateQuestion");

export const route = { preload: ({ params }: { params: { id: string } }) => getExam(Number(params.id)) };

export default function EditExamPage() {
  const params = useParams();
  const examId = () => Number(params.id);
  const exam = createAsync(() => getExam(examId()));
  const timesSub = useSubmission(updateTimesAction);
  const delSrc = useSubmission(deleteSourceAction);
  const regenSrc = useSubmission(regenerateSourceAction);
  const delQ = useSubmission(deleteQuestionAction);
  const regenQ = useSubmission(regenerateQuestionAction);
  const anyPending = () => delSrc.pending || regenSrc.pending || delQ.pending || regenQ.pending || timesSub.pending;
  const lastError = () => delSrc.result?.error || regenSrc.result?.error || delQ.result?.error || regenQ.result?.error;

  return (
    <>
      <Title>시험지 수정</Title>
      <TopBar title="시험지 수정" back={`/admin/exams/${examId()}`} />
      <main class={page}>
        <Show when={exam()}>
          {(e) => (
            <>
              <Show when={e().latestRound.participantCount > 0}>
                <div class={card} style={{ "border-color": "var(--som-theme-warning)" }}>
                  <p style={{ "line-height": "1.6" }}>
                    <strong>{e().latestRound.roundNo}차시에 응시자가 있어요.</strong> 여기서 무언가를 바꾸면 그 순간 <strong>{e().latestRound.roundNo + 1}차시</strong>가 새로 만들어지고, 바뀐 내용은 새 차시에만 적용됩니다. 이전 차시와 기록은 그대로 남아요.
                  </p>
                </div>
              </Show>
              <Show when={e().generating}>
                <p class={errorText}>출제가 진행 중입니다. 끝난 뒤에 수정할 수 있어요.</p>
              </Show>
              <Show when={anyPending()}>
                <p class={badgePrimary}>처리 중… (재출제는 수십 초 걸릴 수 있어요)</p>
              </Show>
              <Show when={lastError()}><p class={errorText}>{lastError()}</p></Show>

              <form action={updateTimesAction} method="post" class={card}>
                <div class={stack}>
                  <div class={cardTitle}>시험 기간과 제한시간 ({e().latestRound.roundNo}차시)</div>
                  <input type="hidden" name="examId" value={e().id} />
                  <div class={field}>
                    <label class={fieldLabel}>시작 시각</label>
                    <input name="startsAt" type="datetime-local" class={textInput} value={isoToLocalInput(e().latestRound.startsAt)} required />
                  </div>
                  <div class={field}>
                    <label class={fieldLabel}>종료 시각</label>
                    <input name="endsAt" type="datetime-local" class={textInput} value={isoToLocalInput(e().latestRound.endsAt)} required />
                  </div>
                  <div class={rowWrap}>
                    <div class={field} style={{ flex: "1" }}>
                      <label class={fieldLabel}>개인 제한(분)</label>
                      <input name="soloLimitMin" type="number" class={textInput} value={e().latestRound.soloLimitMin} min={1} max={600} required />
                    </div>
                    <div class={field} style={{ flex: "1" }}>
                      <label class={fieldLabel}>협력 제한(분)</label>
                      <input name="groupLimitMin" type="number" class={textInput} value={e().latestRound.groupLimitMin} min={1} max={600} required />
                    </div>
                  </div>
                  <Show when={timesSub.result?.error}><p class={errorText}>{timesSub.result?.error}</p></Show>
                  <Show when={timesSub.result?.ok}><p class={muted}>저장했습니다.</p></Show>
                  <button type="submit" class={buttonPrimary} disabled={anyPending() || e().generating}>기간 저장</button>
                </div>
              </form>

              <For each={e().sources}>
                {(s) => (
                  <div class={card}>
                    <div class={stack}>
                      <div class={rowBetween}>
                        <div>
                          <div style={{ "font-weight": "700" }}>📄 {s.label}</div>
                          <div class={muted}>
                            {s.contentChars.toLocaleString()}자 · 주관식 {s.shortCount} · 객관식 {s.multipleCount}
                            <Show when={s.multipleCount > 0}> (보기 {s.choiceCount}, 최대 정답 {s.maxAnswerCount})</Show>
                          </div>
                        </div>
                      </div>
                      <Show when={s.lastError}><p class={errorText}>출제 실패: {s.lastError}</p></Show>
                      <div class={rowWrap}>
                        <form action={regenerateSourceAction.with(e().id, s.id)} method="post" onSubmit={(ev) => {
                          if (!confirm(`"${s.label}"의 문제 ${s.questionCount}개를 모두 지우고 다시 출제합니다. 계속할까요?`)) ev.preventDefault();
                        }}>
                          <button type="submit" class={buttonSmall} disabled={anyPending() || e().generating}>자료 전체 재출제</button>
                        </form>
                        <form action={deleteSourceAction.with(e().id, s.id)} method="post" onSubmit={(ev) => {
                          if (!confirm(`"${s.label}"와 그 문제 ${s.questionCount}개를 지웁니다. 계속할까요?`)) ev.preventDefault();
                        }}>
                          <button type="submit" class={buttonSmall} style={{ color: "var(--som-theme-danger)" }} disabled={anyPending() || e().generating || e().sources.length <= 1}>자료 삭제</button>
                        </form>
                      </div>
                      <div class={divider} />
                      <For each={e().questions.filter((q) => q.sourceId === s.id)}>
                        {(q) => (
                          <div class={stack} style={{ gap: "0.4rem", padding: "0.5rem 0" }}>
                            <div style={{ "line-height": "1.5" }}>
                              <span class={badge} style={{ "margin-right": "0.4rem" }}>{q.seq}</span>
                              <span class={badge} style={{ "margin-right": "0.4rem" }}>{q.type === "MULTIPLE" ? "객관식" : "주관식"}</span>
                              {q.text}
                            </div>
                            <Show when={q.type === "MULTIPLE"}>
                              <div class={muted} style={{ "font-size": "0.88rem", "line-height": "1.5" }}>
                                <For each={q.choices}>{(c) => <span style={{ "margin-right": "0.6rem", "font-weight": c.isAnswer ? "700" : "400" }}>{choiceMark(c.seq)} {c.text}{c.isAnswer ? " ✓" : ""}</span>}</For>
                              </div>
                            </Show>
                            <Show when={q.type === "SHORT"}>
                              <div class={muted} style={{ "font-size": "0.88rem" }}>정답: {q.answers.join(", ")}</div>
                            </Show>
                            <div class={rowWrap}>
                              <form action={regenerateQuestionAction.with(e().id, q.id)} method="post">
                                <button type="submit" class={buttonSmall} disabled={anyPending() || e().generating}>재출제</button>
                              </form>
                              <form action={deleteQuestionAction.with(e().id, q.id)} method="post" onSubmit={(ev) => {
                                if (!confirm(`${q.seq}번 문제를 지웁니다. 계속할까요?`)) ev.preventDefault();
                              }}>
                                <button type="submit" class={buttonSmall} style={{ color: "var(--som-theme-danger)" }} disabled={anyPending() || e().generating || e().questions.length <= 1}>삭제</button>
                              </form>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
              <A class={buttonSmall} href={`/admin/exams/${e().id}`}>상세로 돌아가기</A>
            </>
          )}
        </Show>
      </main>
    </>
  );
}
