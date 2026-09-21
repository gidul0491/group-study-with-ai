import { getCookie, setCookie } from "@solidjs/start/http";
import { forbidden, isAppError } from "@shared/lib/errors";
import * as examRepo from "@modules/exam/exam.repository";
import * as participantService from "@modules/participant/participant.service";
import * as service from "./room.service";

/** 협력풀이 컨트롤러: 응시자 쿠키를 다루고 서비스를 부른다. */

function cookieName(roundId: number): string {
  return `gs_group_${roundId}`;
}

export type GroupPage =
  | { kind: "room"; roomId: number; participantId: number; examTitle: string; roundNo: number }
  | { kind: "denied"; reason: string; message: string; examTitle: string | null; startsAt: string | null };

export function enter(token: string): GroupPage {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "GROUP") {
    return { kind: "denied", reason: "NOT_FOUND", message: "링크를 찾을 수 없습니다.", examTitle: null, startsAt: null };
  }
  const round = examRepo.findRound(link.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  try {
    const entry = service.enterGroup(token, getCookie(cookieName(round.id)));
    if (entry.isNew) {
      setCookie(cookieName(round.id), entry.participant.secret, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(new Date(round.ends_at).getTime() + 24 * 3_600_000),
      });
    }
    return { kind: "room", roomId: entry.roomId, participantId: entry.participant.id, examTitle: exam.title, roundNo: round.round_no };
  } catch (e) {
    if (isAppError(e)) {
      return { kind: "denied", reason: e.code, message: e.message, examTitle: exam.title, startsAt: round.starts_at };
    }
    throw e;
  }
}

/** 방 id로 현재 요청의 응시자를 찾는다 (쿠키). */
export function participantOfRoom(roomId: number): participantService.Participant {
  const roundId = service.roundIdOfRoom(roomId);
  if (roundId === null) throw forbidden("방을 찾을 수 없습니다.", "NOT_FOUND");
  const p = participantService.findParticipant(getCookie(cookieName(roundId)), roundId, "GROUP");
  if (!p) throw forbidden("참가 정보가 없습니다. 링크로 다시 들어오세요.", "NO_PARTICIPANT");
  return p;
}

export function state(roomId: number): service.RoomState {
  return service.getRoomState(roomId, participantOfRoom(roomId).id);
}

export function transferLeader(roomId: number, toMemberNo: number): void {
  service.transferLeader(roomId, participantOfRoom(roomId).id, toMemberNo);
}

export function start(roomId: number): void {
  service.startRoom(roomId, participantOfRoom(roomId).id);
}

export function saveAnswer(roomId: number, questionId: number, answer: { choiceIds?: number[]; text?: string }): void {
  service.saveGroupAnswer(roomId, participantOfRoom(roomId).id, questionId, answer);
}

export function submit(roomId: number): void {
  service.submitRoom(roomId, participantOfRoom(roomId).id);
}
