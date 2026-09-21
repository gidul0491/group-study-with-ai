import { createAsync, Navigate, query, type RouteSectionProps } from "@solidjs/router";
import { Show } from "solid-js";

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
          {props.children}
        </Show>
      )}
    </Show>
  );
}
