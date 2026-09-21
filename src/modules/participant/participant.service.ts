import { nowIso } from "@shared/lib/time";
import { randomToken } from "@shared/lib/random";
import { uniqueNickname } from "./nickname";
import * as repo from "./participant.repository";

export type Participant = {
  id: number;
  roundId: number;
  mode: "SOLO" | "GROUP";
  secret: string;
  nickname: string;
};

function toParticipant(row: repo.ParticipantRow): Participant {
  return {
    id: row.id,
    roundId: row.round_id,
    mode: row.mode,
    secret: row.secret,
    nickname: row.nickname,
  };
}

/** 차시·모드에 새 응시자를 만든다. 닉네임은 그 차시 안에서 겹치지 않게. */
export function createParticipant(roundId: number, mode: "SOLO" | "GROUP"): Participant {
  const taken = new Set(repo.listNicknamesInRound(roundId));
  const nickname = uniqueNickname(taken);
  const secret = randomToken(24);
  const id = repo.insertParticipant(roundId, mode, secret, nickname, nowIso());
  return { id, roundId, mode, secret, nickname };
}

/** 쿠키 값으로 응시자를 찾는다. 다른 차시·모드의 응시자면 null. */
export function findParticipant(
  secret: string | undefined,
  roundId: number,
  mode: "SOLO" | "GROUP",
): Participant | null {
  if (!secret) return null;
  const row = repo.findParticipantBySecret(secret);
  if (!row || row.round_id !== roundId || row.mode !== mode) return null;
  return toParticipant(row);
}

export function getParticipant(id: number): Participant | null {
  const row = repo.findParticipantById(id);
  return row ? toParticipant(row) : null;
}
