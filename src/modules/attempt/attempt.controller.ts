import { getCookie, setCookie } from "@solidjs/start/http";
import { isAppError } from "@shared/lib/errors";
import * as examRepo from "@modules/exam/exam.repository";
import * as service from "./attempt.service";

/** 개인풀이 컨트롤러: 응시자 쿠키를 다루고 서비스를 부른다. */

function cookieName(roundId: number): string {
  return `gs_solo_${roundId}`;
}

function roundIdOfToken(token: string): number | null {
  const link = examRepo.findLinkByToken(token);
  return link && link.mode === "SOLO" ? link.round_id : null;
}

export type SoloPage =
  | { kind: "state"; state: service.SoloState }
  | { kind: "denied"; reason: string; message: string; info: ReturnType<typeof service.describeSoloLink> };

/** 입장 또는 이어하기. 새 응시자면 쿠키를 심는다. */
export function enter(token: string): SoloPage {
  const roundId = roundIdOfToken(token);
  if (roundId === null) return { kind: "denied", reason: "NOT_FOUND", message: "링크를 찾을 수 없습니다.", info: null };
  try {
    const { state, newParticipant } = service.enterSolo(token, getCookie(cookieName(roundId)));
    if (newParticipant) {
      const round = examRepo.findRound(roundId)!;
      setCookie(cookieName(roundId), newParticipant.secret, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(new Date(round.ends_at).getTime() + 24 * 3_600_000),
      });
    }
    return { kind: "state", state };
  } catch (e) {
    if (isAppError(e)) {
      return { kind: "denied", reason: e.code, message: e.message, info: service.describeSoloLink(token) };
    }
    throw e;
  }
}

export function saveAnswer(token: string, questionId: number, answer: { choiceIds?: number[]; text?: string }): void {
  const roundId = roundIdOfToken(token);
  if (roundId === null) return;
  service.saveSoloAnswer(token, getCookie(cookieName(roundId)), questionId, answer);
}

export function submit(token: string): service.SoloState {
  const roundId = roundIdOfToken(token);
  if (roundId === null) throw new Error("링크를 찾을 수 없습니다.");
  return service.submitSolo(token, getCookie(cookieName(roundId)));
}
