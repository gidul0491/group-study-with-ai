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

async function signupFn(form: FormData): Promise<{ ok: true } | { error: string }> {
  "use server";
  const { signup } = await import("@modules/auth/auth.controller");
  try {
    signup({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      passwordConfirm: String(form.get("passwordConfirm") ?? ""),
      recoveryQuestion: String(form.get("recoveryQuestion") ?? ""),
      recoveryAnswer: String(form.get("recoveryAnswer") ?? ""),
    });
    return { ok: true };
  } catch (e) {
    return { error: describeError(e).message };
  }
}

export default function SignupPage() {
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await signupFn(new FormData(e.currentTarget as HTMLFormElement));
    if ("error" in r) {
      setError(r.error);
      setPending(false);
      return;
    }
    location.assign("/admin");
  };

  return (
    <main class={centerBox}>
      <Title>회원가입</Title>
      <div class={stack} style={{ width: "100%", "max-width": "22rem" }}>
        <h1 class={heading}>회원가입</h1>
        <p class={muted}>관리자 계정을 만듭니다. 시험지는 만든 사람만 관리할 수 있어요.</p>
        <form onSubmit={onSubmit} class={card}>
          <div class={stack}>
            <div class={field}>
              <label class={fieldLabel} for="username">
                아이디
              </label>
              <input id="username" name="username" class={textInput} autocomplete="username" required
                pattern="[a-zA-Z0-9_.\-]{3,30}" title="영문·숫자·._- 3~30자" />
            </div>
            <div class={field}>
              <label class={fieldLabel} for="password">
                비밀번호 (6자 이상)
              </label>
              <input id="password" name="password" type="password" class={textInput} autocomplete="new-password" required minLength={6} />
            </div>
            <div class={field}>
              <label class={fieldLabel} for="passwordConfirm">
                비밀번호 확인
              </label>
              <input id="passwordConfirm" name="passwordConfirm" type="password" class={textInput} autocomplete="new-password" required minLength={6} />
            </div>
            <div class={field}>
              <label class={fieldLabel} for="recoveryQuestion">
                비밀번호 찾기 질문
              </label>
              <input id="recoveryQuestion" name="recoveryQuestion" class={textInput} required maxLength={200}
                placeholder="예: 처음 키운 반려동물 이름은?" />
            </div>
            <div class={field}>
              <label class={fieldLabel} for="recoveryAnswer">
                답변
              </label>
              <input id="recoveryAnswer" name="recoveryAnswer" class={textInput} required maxLength={100} autocomplete="off" />
              <p class={muted} style={{ "font-size": "0.8rem" }}>띄어쓰기·대소문자·문장부호는 구분하지 않아요.</p>
            </div>
            <Show when={error()}>
              <p class={errorText}>{error()}</p>
            </Show>
            <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={pending()}>
              가입하고 시작
            </button>
          </div>
        </form>
        <A href="/" class={muted} style={{ "text-align": "center" }}>
          로그인으로 돌아가기
        </A>
      </div>
    </main>
  );
}
