import { subscribe } from "./event-bus";

/**
 * 채널을 구독하는 SSE 응답을 만든다.
 * - 연결 직후 initial()의 결과를 "state" 이벤트로 보낸다.
 * - 이후 채널에 발행되는 페이로드마다 "state" 이벤트를 보낸다.
 * - 25초마다 주석 줄로 연결을 살려 둔다.
 */
export function sseResponse(
  channel: string | string[],
  initial: () => unknown,
  request: Request,
  options: { onPayload?: (payload: unknown) => unknown } = {},
): Response {
  const encoder = new TextEncoder();
  const channels = Array.isArray(channel) ? channel : [channel];
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          cleanup?.();
        }
      };
      send("state", initial());
      const unsubscribers = channels.map((ch) =>
        subscribe(ch, (payload) => {
          const data = options.onPayload ? options.onPayload(payload) : payload;
          if (data !== undefined) send("state", data);
        }),
      );
      const unsubscribe = () => unsubscribers.forEach((u) => u());
      const timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup?.();
        }
      }, 25_000);
      cleanup = () => {
        clearInterval(timer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        cleanup = null;
      };
      request.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
