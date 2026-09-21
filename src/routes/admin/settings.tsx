import { Title } from "@solidjs/meta";
import { action, createAsync, query, useSubmission } from "@solidjs/router";
import { Show } from "solid-js";
import { TopBar } from "@shared/ui/TopBar";
import {
  page,
  card,
  cardTitle,
  field,
  fieldLabel,
  textInput,
  textArea,
  buttonPrimary,
  buttonSecondary,
  buttonBlock,
  errorText,
  muted,
  stack,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";

const getSettings = query(async () => {
  "use server";
  const { me, requestOrigin } = await import("@modules/auth/auth.controller");
  const { publicBaseUrl, defaultPrompt } = await import("@modules/setting/setting.service");
  const admin = me();
  return {
    username: admin.username,
    hasRecovery: admin.hasRecovery,
    publicBaseUrl: publicBaseUrl(),
    origin: requestOrigin(),
    defaultPrompt: defaultPrompt(),
  };
}, "settings");

const updateRecoveryAction = action(async (form: FormData) => {
  "use server";
  const { updateRecovery } = await import("@modules/auth/auth.controller");
  try {
    updateRecovery(
      String(form.get("currentPassword") ?? ""),
      String(form.get("recoveryQuestion") ?? ""),
      String(form.get("recoveryAnswer") ?? ""),
    );
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "updateRecovery");

const saveDefaultPromptAction = action(async (form: FormData) => {
  "use server";
  const { requireAdmin } = await import("@modules/auth/auth.controller");
  const { saveDefaultPrompt } = await import("@modules/setting/setting.service");
  try {
    requireAdmin();
    saveDefaultPrompt(String(form.get("defaultPrompt") ?? ""));
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "saveDefaultPrompt");

const saveBaseUrl = action(async (form: FormData) => {
  "use server";
  const { requireAdmin } = await import("@modules/auth/auth.controller");
  const { savePublicBaseUrl } = await import("@modules/setting/setting.service");
  try {
    requireAdmin();
    savePublicBaseUrl(String(form.get("publicBaseUrl") ?? ""));
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "saveBaseUrl");

const changePasswordAction = action(async (form: FormData) => {
  "use server";
  const { changePassword } = await import("@modules/auth/auth.controller");
  try {
    changePassword(String(form.get("current") ?? ""), String(form.get("next") ?? ""));
    return { ok: true as const };
  } catch (e) {
    return { error: describeError(e).message };
  }
}, "changePassword");

/** 로그아웃 뒤 전체 페이지 이동으로 라우터 캐시를 비운다. */
async function logoutFn(): Promise<void> {
  "use server";
  const { logout } = await import("@modules/auth/auth.controller");
  logout();
}

export const route = { preload: () => getSettings() };

export default function SettingsPage() {
  const settings = createAsync(() => getSettings());
  const baseUrlSub = useSubmission(saveBaseUrl);
  const promptSub = useSubmission(saveDefaultPromptAction);
  const pwSub = useSubmission(changePasswordAction);
  const recoverySub = useSubmission(updateRecoveryAction);

  return (
    <>
      <Title>설정</Title>
      <TopBar title="설정" back="/admin" />
      <main class={page}>
        <Show when={settings()}>
          {(s) => (
            <p class={muted}>
              <strong>{s().username}</strong> 계정으로 로그인 중. 시험지는 이 계정만 볼 수 있어요.
            </p>
          )}
        </Show>
        <Show when={settings()}>
          {(s) => (
            <form action={saveBaseUrl} method="post" class={card}>
              <div class={stack}>
                <div class={cardTitle}>공개 주소</div>
                <p class={muted}>
                  QR과 임시 링크에 쓰는 주소입니다. 비워 두면 지금 접속한 주소({s().origin})를
                  씁니다. 예: http://192.168.0.10:3000
                </p>
                <div class={field}>
                  <label class={fieldLabel} for="publicBaseUrl">
                    주소
                  </label>
                  <input
                    id="publicBaseUrl"
                    name="publicBaseUrl"
                    class={textInput}
                    value={s().publicBaseUrl}
                    placeholder={s().origin}
                    inputmode="url"
                  />
                </div>
                <Show when={baseUrlSub.result?.error}>
                  <p class={errorText}>{baseUrlSub.result?.error}</p>
                </Show>
                <Show when={baseUrlSub.result?.ok}>
                  <p class={muted}>저장했습니다.</p>
                </Show>
                <button class={buttonPrimary} type="submit" disabled={baseUrlSub.pending}>
                  저장
                </button>
              </div>
            </form>
          )}
        </Show>

        <Show when={settings()}>
          {(s) => (
            <form action={saveDefaultPromptAction} method="post" class={card}>
              <div class={stack}>
                <div class={cardTitle}>기본 프롬프트</div>
                <p class={muted}>
                  새 시험지를 만들 때 공통 프롬프트 칸에 미리 채워집니다. 시험지마다 고쳐 쓸 수 있어요.
                </p>
                <div class={field}>
                  <label class={fieldLabel} for="defaultPrompt">
                    프롬프트
                  </label>
                  <textarea
                    id="defaultPrompt"
                    name="defaultPrompt"
                    class={textArea}
                    maxLength={5000}
                    placeholder="예: 개념의 정의보다 왜 그런지를 묻는 문제 위주로. 용어는 영어 원어를 함께 표기."
                  >
                    {s().defaultPrompt}
                  </textarea>
                </div>
                <Show when={promptSub.result?.error}>
                  <p class={errorText}>{promptSub.result?.error}</p>
                </Show>
                <Show when={promptSub.result?.ok}>
                  <p class={muted}>저장했습니다.</p>
                </Show>
                <button class={buttonPrimary} type="submit" disabled={promptSub.pending}>
                  저장
                </button>
              </div>
            </form>
          )}
        </Show>

        <form action={changePasswordAction} method="post" class={card}>
          <div class={stack}>
            <div class={cardTitle}>비밀번호 변경</div>
            <div class={field}>
              <label class={fieldLabel} for="current">
                현재 비밀번호
              </label>
              <input
                id="current"
                name="current"
                type="password"
                class={textInput}
                autocomplete="current-password"
                required
              />
            </div>
            <div class={field}>
              <label class={fieldLabel} for="next">
                새 비밀번호
              </label>
              <input
                id="next"
                name="next"
                type="password"
                class={textInput}
                autocomplete="new-password"
                required
              />
            </div>
            <Show when={pwSub.result?.error}>
              <p class={errorText}>{pwSub.result?.error}</p>
            </Show>
            <Show when={pwSub.result?.ok}>
              <p class={muted}>변경했습니다.</p>
            </Show>
            <button class={buttonPrimary} type="submit" disabled={pwSub.pending}>
              변경
            </button>
          </div>
        </form>

        <Show when={settings()}>
          {(s) => (
            <form action={updateRecoveryAction} method="post" class={card}>
              <div class={stack}>
                <div class={cardTitle}>비밀번호 찾기 질문</div>
                <p class={muted}>
                  {s().hasRecovery
                    ? "질문이 등록되어 있어요. 바꾸려면 새로 입력하세요."
                    : "아직 질문이 없어요. 등록해 두면 비밀번호를 잊었을 때 찾을 수 있어요."}
                </p>
                <div class={field}>
                  <label class={fieldLabel} for="recoveryQuestion">
                    질문
                  </label>
                  <input id="recoveryQuestion" name="recoveryQuestion" class={textInput} required maxLength={200}
                    placeholder="예: 처음 키운 반려동물 이름은?" />
                </div>
                <div class={field}>
                  <label class={fieldLabel} for="recoveryAnswer">
                    답변
                  </label>
                  <input id="recoveryAnswer" name="recoveryAnswer" class={textInput} required maxLength={100} autocomplete="off" />
                </div>
                <div class={field}>
                  <label class={fieldLabel} for="currentPassword">
                    현재 비밀번호 (본인 확인)
                  </label>
                  <input id="currentPassword" name="currentPassword" type="password" class={textInput} autocomplete="current-password" required />
                </div>
                <Show when={recoverySub.result?.error}>
                  <p class={errorText}>{recoverySub.result?.error}</p>
                </Show>
                <Show when={recoverySub.result?.ok}>
                  <p class={muted}>등록했습니다.</p>
                </Show>
                <button class={buttonPrimary} type="submit" disabled={recoverySub.pending}>
                  등록
                </button>
              </div>
            </form>
          )}
        </Show>

        <button
          class={`${buttonSecondary} ${buttonBlock}`}
          type="button"
          onClick={async () => {
            await logoutFn();
            location.assign("/");
          }}
        >
          로그아웃
        </button>
      </main>
    </>
  );
}
