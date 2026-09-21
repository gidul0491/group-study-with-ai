import { Title } from "@solidjs/meta";
import { A, createAsync, query } from "@solidjs/router";
import { For, Show } from "solid-js";
import { TopBar } from "@shared/ui/TopBar";
import {
  page,
  listItem,
  rowBetween,
  rowWrap,
  badge,
  badgePrimary,
  badgeSuccess,
  buttonPrimary,
  buttonSmall,
  buttonBlock,
  muted,
  centerBox,
  subheading,
} from "@shared/ui/layout.style";
import { formatLocal } from "@shared/lib/time";

const getExams = query(async () => {
  "use server";
  const { listExams } = await import("@modules/exam/exam.controller");
  return listExams();
}, "exams");

export const route = { preload: () => getExams() };

const statusLabel: Record<string, string> = {
  SCHEDULED: "예정",
  OPEN: "진행 중",
  ENDED: "종료",
};

export default function AdminIndex() {
  const exams = createAsync(() => getExams());
  return (
    <>
      <Title>시험지 목록</Title>
      <TopBar
        title="시험지"
        right={
          <A class={buttonSmall} href="/admin/settings">
            설정
          </A>
        }
      />
      <main class={page}>
        <A class={`${buttonPrimary} ${buttonBlock}`} href="/admin/new">
          + 새 시험지 만들기
        </A>
        <Show when={exams()}>
          {(list) => (
            <Show
              when={list().length > 0}
              fallback={
                <div class={centerBox}>
                  <p class={subheading}>아직 시험지가 없어요</p>
                  <p class={muted}>자료를 넣고 첫 시험지를 만들어 보세요.</p>
                </div>
              }
            >
              <ul style={{ display: "flex", "flex-direction": "column", gap: "0.6rem" }}>
                <For each={list()}>
                  {(e) => (
                    <li>
                      <A class={listItem} href={`/admin/exams/${e.id}`}>
                        <div class={rowBetween}>
                          <strong style={{ "font-size": "1.02rem" }}>{e.title}</strong>
                          <Show when={e.generating}>
                            <span class={badgePrimary}>출제 중</span>
                          </Show>
                        </div>
                        <div class={rowWrap} style={{ "margin-top": "0.4rem" }}>
                          <span class={badge}>{e.questionCount}문제</span>
                          <span class={badge}>{e.roundCount}차시</span>
                          <Show when={e.latestStatus}>
                            <span class={e.latestStatus === "OPEN" ? badgeSuccess : badge}>
                              {e.latestRoundNo}차시 {statusLabel[e.latestStatus!]}
                            </span>
                          </Show>
                          <span class={muted}>{formatLocal(e.createdAt)}</span>
                        </div>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          )}
        </Show>
      </main>
    </>
  );
}
