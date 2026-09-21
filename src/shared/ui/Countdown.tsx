import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { badgePrimary, badgeDanger } from "./layout.style";
import { formatDuration } from "@shared/lib/time";

/**
 * 마감까지 남은 시간. serverNow와 클라이언트 시각의 차이를 보정한다.
 * 0이 되면 onExpire를 한 번 부른다.
 */
export function Countdown(props: { deadlineAt: string; serverNow: string; onExpire?: () => void }) {
  const offset = new Date(props.serverNow).getTime() - Date.now();
  const remaining = () => Math.max(0, Math.floor((new Date(props.deadlineAt).getTime() - (Date.now() + offset)) / 1000));
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
  return (
    <Show when={left() > 0} fallback={<span class={badgeDanger}>시간 종료</span>}>
      <span class={left() <= 60 ? badgeDanger : badgePrimary} style={{ "font-variant-numeric": "tabular-nums" }}>
        ⏱ {formatDuration(left())}
      </span>
    </Show>
  );
}
