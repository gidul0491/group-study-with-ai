import { Title } from "@solidjs/meta";
import { action, createAsync, Navigate, query, redirect, useSubmission } from "@solidjs/router";
import { Show } from "solid-js";
import {
  centerBox,
  heading,
  muted,
  card,
  field,
  fieldLabel,
  textInput,
  buttonPrimary,
  buttonBlock,
  errorText,
  stack,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";

const getAuthState = query(async () => {
  "use server";
  const { authState } = await import("@modules/auth/auth.controller");
  return authState();
}, "authState");

const submitAuth = action(async (form: FormData) => {
  "use server";
  const { setup, login } = await import("@modules/auth/auth.controller");
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const mode = String(form.get("mode") ?? "login");
  try {
    if (mode === "setup") setup(username, password);
    else login(username, password);
  } catch (e) {
    return { error: describeError(e).message };
  }
  throw redirect("/admin");
}, "submitAuth");

export const route = { preload: () => getAuthState() };

export default function Home() {
  const state = createAsync(() => getAuthState());
  const submission = useSubmission(submitAuth);

  return (
    <main class={centerBox}>
      <Title>그룹 스터디</Title>
      <Show when={state()}>
        {(s) => (
          <Show when={!s().loggedIn} fallback={<Navigate href="/admin" />}>
            <div class={stack} style={{ width: "100%", "max-width": "22rem" }}>
              <h1 class={heading}>그룹 스터디</h1>
              <p class={muted}>
                {s().hasAdmin
                  ? "관리자 계정으로 로그인하세요."
                  : "처음 실행입니다. 관리자 계정을 만드세요."}
              </p>
              <form action={submitAuth} method="post" class={card}>
                <div class={stack}>
                  <input type="hidden" name="mode" value={s().hasAdmin ? "login" : "setup"} />
                  <div class={field}>
                    <label class={fieldLabel} for="username">
                      아이디
                    </label>
                    <input
                      id="username"
                      name="username"
                      class={textInput}
                      autocomplete="username"
                      required
                    />
                  </div>
                  <div class={field}>
                    <label class={fieldLabel} for="password">
                      비밀번호
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      class={textInput}
                      autocomplete={s().hasAdmin ? "current-password" : "new-password"}
                      required
                    />
                  </div>
                  <Show when={submission.result?.error}>
                    <p class={errorText}>{submission.result?.error}</p>
                  </Show>
                  <button
                    type="submit"
                    class={`${buttonPrimary} ${buttonBlock}`}
                    disabled={submission.pending}
                  >
                    {s().hasAdmin ? "로그인" : "계정 만들고 시작"}
                  </button>
                </div>
              </form>
            </div>
          </Show>
        )}
      </Show>
    </main>
  );
}
