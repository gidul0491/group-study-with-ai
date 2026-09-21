import { Title } from "@solidjs/meta";
import { action, createAsync, query, redirect, useSubmission } from "@solidjs/router";
import { Show } from "solid-js";
import { TopBar } from "@shared/ui/TopBar";
import {
  page,
  card,
  cardTitle,
  field,
  fieldLabel,
  textInput,
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
  const { requireAdmin, requestOrigin } = await import("@modules/auth/auth.controller");
  const { publicBaseUrl } = await import("@modules/setting/setting.service");
  requireAdmin();
  return { publicBaseUrl: publicBaseUrl(), origin: requestOrigin() };
}, "settings");

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

const logoutAction = action(async () => {
  "use server";
  const { logout } = await import("@modules/auth/auth.controller");
  logout();
  throw redirect("/");
}, "logout");

export const route = { preload: () => getSettings() };

export default function SettingsPage() {
  const settings = createAsync(() => getSettings());
  const baseUrlSub = useSubmission(saveBaseUrl);
  const pwSub = useSubmission(changePasswordAction);

  return (
    <>
      <Title>설정</Title>
      <TopBar title="설정" back="/admin" />
      <main class={page}>
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

        <form action={logoutAction} method="post">
          <button class={`${buttonSecondary} ${buttonBlock}`} type="submit">
            로그아웃
          </button>
        </form>
      </main>
    </>
  );
}
