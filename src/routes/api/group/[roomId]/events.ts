import type { APIEvent } from "@solidjs/start/server";
import { participantOfRoom } from "@modules/room/room.controller";
import { connect, disconnect, getRoomState, roomChannel, roundIdOfRoom } from "@modules/room/room.service";
import { soloChannel } from "@modules/attempt/attempt.service";
import { sseResponse } from "@shared/lib/sse";
import { describeError } from "@shared/lib/errors";

/**
 * GET /api/group/:roomId/events — 협력 방 상태 SSE.
 * 연결이 열려 있는 동안 접속 상태로 잡히고, 끊기면 방장 승계 판단이 시작된다.
 * 방 채널과 개인풀이 채널(대기 화면 갱신) 둘 다 듣는다.
 */
export function GET(event: APIEvent): Response {
  const roomId = Number(event.params.roomId);
  let participantId: number;
  try {
    participantId = participantOfRoom(roomId).id;
  } catch (e) {
    return new Response(describeError(e).message, { status: 403 });
  }
  const roundId = roundIdOfRoom(roomId);
  connect(roomId, participantId);
  event.request.signal.addEventListener("abort", () => disconnect(roomId, participantId));
  const channels = [roomChannel(roomId)];
  if (roundId !== null) channels.push(soloChannel(roundId));
  return sseResponse(
    channels,
    () => safeState(roomId, participantId),
    event.request,
    { onPayload: () => safeState(roomId, participantId) },
  );
}

function safeState(roomId: number, participantId: number) {
  try {
    return getRoomState(roomId, participantId);
  } catch (e) {
    return { error: describeError(e) };
  }
}
