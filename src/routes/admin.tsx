import { A, createAsync, Navigate, query, type RouteSectionProps } from "@solidjs/router";
import { ErrorBoundary, Show } from "solid-js";
import { centerBox, heading, muted, buttonSecondary } from "@shared/ui/layout.style";

/** /admin 아래 모든 화면의 공통 보호막. 세션이 없으면 로그인으로 보낸다. */
const checkLogin = query(async () => {
  "use server";
  const { currentAdminId } = await import("@modules/auth/auth.controller");
  return { loggedIn: currentAdminId() !== null };
}, "checkLogin");

export const route = { preload: () => checkLogin() };

export default function AdminLayout(props: RouteSectionProps) {
  const auth = createAsync(() => checkLogin());
  return (
    <Show when={auth()}>
      {(a) => (
        <Show when={a().loggedIn} fallback={<Navigate href="/" />}>
          <ErrorBoundary
            fallback={(err) => (
              <main class={centerBox}>
                <h1 class={heading}>열 수 없어요</h1>
                <p class={muted}>{describe(err)}</p>
                <A class={buttonSecondary} href="/admin">
                  내 시험지 목록으로
                </A>
              </main>
            )}
          >
            {props.children}
          </ErrorBoundary>
        </Show>
      )}
    </Show>
  );
}

function describe(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return "요청을 처리하지 못했습니다.";
}
