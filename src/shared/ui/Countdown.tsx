import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { style } from "som-style/solid";
import { theme } from "@style/theme.js";
import { badgePrimary, badgeDanger } from "./layout.style";
import { formatDuration } from "@shared/lib/time";

const WARN_SECONDS = 60;

const warnBanner = style({
  base: {
    position: "fixed",
    left: "50%",
    bottom: "1rem",
    transform: "translateX(-50%)",
    width: "min(100% - 2rem, 28rem)",
    zIndex: "50",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.8rem 1rem",
    borderRadius: "0.9rem",
    background: theme.danger,
    color: theme.onPrimary,
    boxShadow: `0 8px 24px ${theme.shadowStrong}`,
    fontWeight: "600",
    lineHeight: "1.4",
  },
});

const warnTime = style({
  base: {
    fontSize: "1.4rem",
    fontWeight: "800",
    fontVariantNumeric: "tabular-nums",
    flexShrink: "0",
  },
});

/**
 * 마감까지 남은 시간. serverNow와 클라이언트 시각의 차이를 보정한다.
 * 마지막 1분에는 화면 하단에 고정 경고 배너를 띄운다.
 * 0이 되면 onExpire를 한 번 부른다.
 */
export function Countdown(props: {
  deadlineAt: string;
  serverNow: string;
  onExpire?: () => void;
  /** 기본 true. 마지막 1분 경고 배너 */
  warn?: boolean;
}) {
  const offset = new Date(props.serverNow).getTime() - Date.now();
  const remaining = () =>
    Math.max(0, Math.floor((new Date(props.deadlineAt).getTime() - (Date.now() + offset)) / 1000));
  const [left, setLeft] = createSignal(remaining());
  let fired = false;
  onMount(() => {
    const t = setInterval(() => {
      const r = remaining();
      setLeft(r);
      if (r === 0 && !fired) {
        fired = true;
        props.onExpire?.();
      }
    }, 500);
    onCleanup(() => clearInterval(t));
  });
  const showWarn = () => props.warn !== false && left() > 0 && left() <= WARN_SECONDS;
  return (
    <>
      <Show when={left() > 0} fallback={<span class={badgeDanger}>시간 종료</span>}>
        <span
          class={left() <= WARN_SECONDS ? badgeDanger : badgePrimary}
          style={{ "font-variant-numeric": "tabular-nums" }}
        >
          ⏱ {formatDuration(left())}
        </span>
      </Show>
      <Show when={showWarn()}>
        <Portal>
          <div class={warnBanner} role="alert">
            <span class={warnTime}>{formatDuration(left())}</span>
            <span>곧 시험이 끝나요. 시간이 되면 지금까지 답한 내용으로 자동 제출됩니다.</span>
          </div>
        </Portal>
      </Show>
    </>
  );
}
