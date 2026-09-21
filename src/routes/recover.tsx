import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
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
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";

type Fail = { error: { code: string; message: string } };

async function questionFn(username: string): Promise<{ question: string } | Fail> {
  "use server";
  const { recoveryQuestion } = await import("@modules/auth/auth.controller");
  try {
    return { question: recoveryQuestion(username) };
  } catch (e) {
    return { error: describeError(e) };
  }
}

async function resetFn(form: FormData): Promise<{ ok: true } | Fail> {
  "use server";
  const { resetPassword } = await import("@modules/auth/auth.controller");
  try {
    resetPassword(
      String(form.get("username") ?? ""),
      String(form.get("answer") ?? ""),
      String(form.get("newPassword") ?? ""),
      String(form.get("confirm") ?? ""),
    );
    return { ok: true };
  } catch (e) {
    return { error: describeError(e) };
  }
}

/** 1단계: 아이디 → 질문. 2단계: 답변 + 새 비밀번호. */
export default function RecoverPage() {
  const [username, setUsername] = createSignal("");
  const [question, setQuestion] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const askQuestion = async (e: SubmitEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await questionFn(username().trim());
    if ("error" in r) setError(r.error.message);
    else setQuestion(r.question);
    setPending(false);
  };

  const reset = async (e: SubmitEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await resetFn(new FormData(e.currentTarget as HTMLFormElement));
    if ("error" in r) {
      setError(r.error.message);
      if (r.error.code === "RECOVERY_LOCKED" || r.error.code === "NO_RECOVERY") setQuestion(null);
      setPending(false);
      return;
    }
    location.assign("/?reset=1");
  };

  return (
    <main class={centerBox}>
      <Title>비밀번호 찾기</Title>
      <div class={stack} style={{ width: "100%", "max-width": "22rem" }}>
        <h1 class={heading}>비밀번호 찾기</h1>
        <p class={muted}>가입할 때 등록한 질문에 답하면 새 비밀번호를 정할 수 있어요.</p>

        <Show
          when={question() !== null}
          fallback={
            <form onSubmit={askQuestion} class={card}>
              <div class={stack}>
                <div class={field}>
                  <label class={fieldLabel} for="username">
                    아이디
                  </label>
                  <input
                    id="username"
                    name="username"
                    class={textInput}
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    autocomplete="username"
                    required
                  />
                </div>
                <Show when={error()}>
                  <p class={errorText}>{error()}</p>
                </Show>
                <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={pending()}>
                  질문 보기
                </button>
              </div>
            </form>
          }
        >
          <form onSubmit={reset} class={card}>
            <div class={stack}>
              <input type="hidden" name="username" value={username()} />
              <p class={muted}>
                아이디: <strong>{username()}</strong>
              </p>
              <div class={field}>
                <label class={fieldLabel}>질문</label>
                <p style={{ "font-weight": "600" }}>{question()}</p>
              </div>
              <div class={field}>
                <label class={fieldLabel} for="answer">
                  답변
                </label>
                <input id="answer" name="answer" class={textInput} required autocomplete="off" />
              </div>
              <div class={field}>
                <label class={fieldLabel} for="newPassword">
                  새 비밀번호 (6자 이상)
                </label>
                <input id="newPassword" name="newPassword" type="password" class={textInput} autocomplete="new-password" required minLength={6} />
              </div>
              <div class={field}>
                <label class={fieldLabel} for="confirm">
                  새 비밀번호 확인
                </label>
                <input id="confirm" name="confirm" type="password" class={textInput} autocomplete="new-password" required minLength={6} />
              </div>
              <Show when={error()}>
                <p class={errorText}>{error()}</p>
              </Show>
              <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={pending()}>
                비밀번호 바꾸기
              </button>
              <button type="button" class={muted} style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setQuestion(null)}>
                다른 아이디로
              </button>
            </div>
          </form>
        </Show>

        <A href="/" class={muted} style={{ "text-align": "center" }}>
          로그인으로 돌아가기
        </A>
      </div>
    </main>
  );
}
