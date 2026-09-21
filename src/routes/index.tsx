import { Title } from "@solidjs/meta";
import { A, createAsync, Navigate, query, useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
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
  rowBetween,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";

const getAuthState = query(async () => {
  "use server";
  const { authState } = await import("@modules/auth/auth.controller");
  return authState();
}, "authState");

/**
 * 로그인은 액션 대신 서버 함수 + 전체 페이지 이동으로 처리한다.
 * 액션 리다이렉트와 라우터 캐시가 엇갈려 "/"와 "/admin" 사이를 오가는 문제를 피한다.
 */
async function loginFn(form: FormData): Promise<{ ok: true } | { error: string }> {
  "use server";
  const { login } = await import("@modules/auth/auth.controller");
  try {
    login(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
    return { ok: true };
  } catch (e) {
    return { error: describeError(e).message };
  }
}

export const route = { preload: () => getAuthState() };

export default function Home() {
  const state = createAsync(() => getAuthState());
  const [params] = useSearchParams();
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await loginFn(new FormData(e.currentTarget as HTMLFormElement));
    if ("error" in r) {
      setError(r.error);
      setPending(false);
      return;
    }
    location.assign("/admin");
  };

  return (
    <main class={centerBox}>
      <Title>그룹 스터디</Title>
      <Show when={state()}>
        {(s) => (
          <Show when={!s().loggedIn} fallback={<Navigate href="/admin" />}>
            <div class={stack} style={{ width: "100%", "max-width": "22rem" }}>
              <h1 class={heading}>그룹 스터디</h1>
              <p class={muted}>
                {params.reset ? "비밀번호를 바꿨어요. 새 비밀번호로 로그인하세요." : "관리자 계정으로 로그인하세요."}
              </p>
              <form onSubmit={onSubmit} class={card}>
                <div class={stack}>
                  <div class={field}>
                    <label class={fieldLabel} for="username">
                      아이디
                    </label>
                    <input id="username" name="username" class={textInput} autocomplete="username" required />
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
                      autocomplete="current-password"
                      required
                    />
                  </div>
                  <Show when={error()}>
                    <p class={errorText}>{error()}</p>
                  </Show>
                  <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={pending()}>
                    로그인
                  </button>
                </div>
              </form>
              <div class={rowBetween}>
                <A href="/signup" class={muted}>
                  회원가입
                </A>
                <A href="/recover" class={muted}>
                  비밀번호 찾기
                </A>
              </div>
            </div>
          </Show>
        )}
      </Show>
    </main>
  );
}
