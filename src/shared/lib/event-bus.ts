/**
 * 프로세스 안 이벤트 버스. SSE 연결이 채널을 구독하고, 서비스가 발행한다.
 * 채널 이름 예: room:12, round:7:solo, generation:3
 * 단일 프로세스 전제 (요구사항 8장).
 */
type Listener = (payload: unknown) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(channel: string, listener: Listener): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) channels.delete(channel);
  };
}

export function publish(channel: string, payload: unknown): void {
  const set = channels.get(channel);
  if (!set) return;
  for (const l of [...set]) {
    try {
      l(payload);
    } catch (e) {
      console.error("event listener failed", channel, e);
    }
  }
}

export function subscriberCount(channel: string): number {
  return channels.get(channel)?.size ?? 0;
}
