import { transaction } from "@shared/db/db";
import { forbidden, notFound, conflict } from "@shared/lib/errors";
import { publish } from "@shared/lib/event-bus";
import { addMinutes, minIso, nowIso } from "@shared/lib/time";
import * as examRepo from "@modules/exam/exam.repository";
import { getRoundQuestions, toPublic, type PublicQuestion } from "@modules/exam/question.view";
import * as participantService from "@modules/participant/participant.service";
import * as attemptService from "@modules/attempt/attempt.service";
import { grade, parseChoiceIds, type AnswerMap } from "@modules/attempt/grading";
import { normalizeAnswerInput, buildResult, toAnswerRecord, type AnswerView, type ResultView } from "@modules/attempt/attempt.service";
import * as repo from "./room.repository";

export function roomChannel(roomId: number): string {
  return `room:${roomId}`;
}

// ---------- 접속 상태 (메모리) ----------
const LEADER_GRACE_MS = 30_000;
const presence = new Map<number, Map<number, number>>(); // roomId -> participantId -> 연결 수
const leaderTimers = new Map<number, NodeJS.Timeout>();

function online(roomId: number, participantId: number): boolean {
  return (presence.get(roomId)?.get(participantId) ?? 0) > 0;
}

export function connect(roomId: number, participantId: number): void {
  let m = presence.get(roomId);
  if (!m) {
    m = new Map();
    presence.set(roomId, m);
  }
  m.set(participantId, (m.get(participantId) ?? 0) + 1);
  repo.touchMember(participantId, nowIso());
  const t = leaderTimers.get(roomId);
  const room = repo.findRoom(roomId);
  if (t && room?.leader_participant_id === participantId) {
    clearTimeout(t);
    leaderTimers.delete(roomId);
  }
  publishRoom(roomId);
}

export function disconnect(roomId: number, participantId: number): void {
  const m = presence.get(roomId);
  if (m) {
    const n = (m.get(participantId) ?? 1) - 1;
    if (n <= 0) m.delete(participantId);
    else m.set(participantId, n);
  }
  const room = repo.findRoom(roomId);
  if (room && room.leader_participant_id === participantId && !online(roomId, participantId)) {
    const t = setTimeout(() => {
      leaderTimers.delete(roomId);
      reassignLeaderIfAbsent(roomId);
    }, LEADER_GRACE_MS);
    leaderTimers.set(roomId, t);
  }
  publishRoom(roomId);
}

function reassignLeaderIfAbsent(roomId: number): void {
  const room = repo.findRoom(roomId);
  if (!room || room.submitted_at) return;
  if (room.leader_participant_id && online(roomId, room.leader_participant_id)) return;
  const next = repo.listMembers(roomId).find((m) => online(roomId, m.participant_id));
  if (next) {
    repo.updateLeader(roomId, next.participant_id, nowIso());
    publishRoom(roomId);
  }
}

function publishRoom(roomId: number): void {
  publish(roomChannel(roomId), { type: "room" });
}

// ---------- 입장 ----------

export type Entry = { roomId: number; participant: participantService.Participant; isNew: boolean };

export function enterGroup(token: string, secret: string | undefined): Entry {
  const link = examRepo.findLinkByToken(token);
  if (!link || link.mode !== "GROUP") throw notFound("링크를 찾을 수 없습니다.");
  const round = examRepo.findRound(link.round_id)!;
  const at = nowIso();

  const existing = participantService.findParticipant(secret, round.id, "GROUP");
  if (existing) {
    const member = repo.findMemberByParticipant(existing.id);
    if (member) return { roomId: member.room_id, participant: existing, isNew: false };
  }

  if (!link.is_open) throw forbidden("닫힌 링크입니다.", "LINK_CLOSED");
  if (at < round.starts_at) throw forbidden("아직 시험 시작 전입니다.", "NOT_STARTED");
  if (at >= round.ends_at) throw forbidden("시험이 종료되었습니다.", "ENDED");

  return transaction(() => {
    let room = repo.findRoomByRound(round.id);
    if (!room) {
      repo.insertRoom(round.id, at);
      room = repo.findRoomByRound(round.id)!;
    }
    if (room.submitted_at) throw forbidden("이미 협력풀이가 끝난 차시입니다.", "ROOM_FINISHED");
    const participant = existing ?? participantService.createParticipant(round.id, "GROUP");
    const memberNo = repo.maxMemberNo(room.id) + 1;
    repo.insertMember(room.id, participant.id, memberNo, at);
    if (!room.leader_participant_id) repo.updateLeader(room.id, participant.id, at);
    publishRoom(room.id);
    return { roomId: room.id, participant, isNew: !existing };
  });
}

// ---------- 상태 ----------

export type MemberView = { participantId: number; memberNo: number; nickname: string; online: boolean };

export type SoloStatView = {
  submitted: number;
  unanswered: number;
  choiceCounts: { choiceId: number; count: number }[];
  shortAnswers: { text: string; count: number }[];
};

export type RoomState = {
  examTitle: string;
  roundNo: number;
  roomId: number;
  me: { participantId: number; memberNo: number; nickname: string; isLeader: boolean };
  leaderMemberNo: number | null;
  members: MemberView[];
  solo: { total: number; done: number };
  canStart: boolean;
  started: boolean;
  startedAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  questions: PublicQuestion[];
  soloStats: Record<number, SoloStatView>;
  answers: Record<number, AnswerView>;
  submitted: boolean;
  submitKind: repo.GroupSubmitKind | null;
  result: ResultView | null;
};

export function deadlineOf(round: examRepo.RoundRow, startedAt: string): string {
  return minIso(addMinutes(startedAt, round.group_limit_min), round.ends_at);
}

export function getRoomState(roomId: number, participantId: number): RoomState {
  const room = repo.findRoom(roomId);
  if (!room) throw notFound("방을 찾을 수 없습니다.");
  const member = repo.findMemberByParticipant(participantId);
  if (!member || member.room_id !== roomId) throw forbidden("이 방의 참가자가 아닙니다.", "NOT_MEMBER");
  const round = examRepo.findRound(room.round_id)!;
  const exam = examRepo.findExam(round.exam_id)!;
  finalizeDueRoom(room, round);
  const fresh = repo.findRoom(roomId)!;

  const progress = attemptService.soloProgress(round);
  const members = repo.listMembers(roomId);
  const leaderNo = members.find((m) => m.participant_id === fresh.leader_participant_id)?.member_no ?? null;
  const questions = getRoundQuestions(round.id);
  const answers = answerMapOf(roomId);
  const started = fresh.started_at !== null;
  const submitted = fresh.submitted_at !== null;
  const stats = started ? attemptService.roundStats(round.id) : [];
  const soloStats: Record<number, SoloStatView> = {};
  for (const s of stats) {
    soloStats[s.questionId] = {
      submitted: s.submitted,
      unanswered: s.unanswered,
      choiceCounts: s.choiceCounts,
      shortAnswers: s.shortAnswers.map((x) => ({ text: x.text, count: x.count })),
    };
  }
  return {
    examTitle: exam.title,
    roundNo: round.round_no,
    roomId,
    me: {
      participantId,
      memberNo: member.member_no,
      nickname: members.find((m) => m.participant_id === participantId)?.nickname ?? "",
      isLeader: fresh.leader_participant_id === participantId,
    },
    leaderMemberNo: leaderNo,
    members: members.map((m) => ({
      participantId: m.participant_id,
      memberNo: m.member_no,
      nickname: m.nickname,
      online: online(roomId, m.participant_id),
    })),
    solo: { total: progress.total, done: progress.done },
    canStart: progress.allDone && nowIso() < round.ends_at,
    started,
    startedAt: fresh.started_at,
    deadlineAt: fresh.started_at ? deadlineOf(round, fresh.started_at) : null,
    serverNow: nowIso(),
    questions: started ? questions.map(toPublic) : [],
    soloStats,
    answers: toAnswerRecord(answers),
    submitted,
    submitKind: fresh.submit_kind,
    result: submitted ? buildResult(questions, answers, fresh.correct_count, fresh.question_count) : null,
  };
}

function answerMapOf(roomId: number): AnswerMap {
  const map: AnswerMap = new Map();
  for (const a of repo.listGroupAnswers(roomId)) {
    map.set(a.question_id, { choiceIds: parseChoiceIds(a.choice_ids), text: a.text });
  }
  return map;
}

// ---------- 동작 ----------

function requireLeader(roomId: number, participantId: number): repo.GroupRoomRow {
  const room = repo.findRoom(roomId);
  if (!room) throw notFound("방을 찾을 수 없습니다.");
  if (room.leader_participant_id !== participantId) throw forbidden("방장만 할 수 있습니다.", "NOT_LEADER");
  return room;
}

export function transferLeader(roomId: number, byParticipantId: number, toMemberNo: number): void {
  const room = requireLeader(roomId, byParticipantId);
  if (room.submitted_at) throw conflict("이미 제출된 방입니다.", "ROOM_FINISHED");
  const target = repo.listMembers(roomId).find((m) => m.member_no === toMemberNo);
  if (!target) throw notFound("그 번호의 참가자가 없습니다.");
  repo.updateLeader(roomId, target.participant_id, nowIso());
  publishRoom(roomId);
}

export function startRoom(roomId: number, byParticipantId: number): void {
  const room = requireLeader(roomId, byParticipantId);
  if (room.started_at) return;
  const round = examRepo.findRound(room.round_id)!;
  const link = examRepo.findLinkByRoundMode(round.id, "GROUP");
  if (!link?.is_open) throw forbidden("닫힌 링크입니다.", "LINK_CLOSED");
  const at = nowIso();
  if (at >= round.ends_at) throw forbidden("시험이 종료되었습니다.", "ENDED");
  const progress = attemptService.soloProgress(round);
  if (!progress.allDone) {
    throw conflict(`개인풀이가 아직 진행 중입니다 (${progress.done}/${progress.total}).`, "SOLO_IN_PROGRESS");
  }
  repo.markStarted(roomId, at);
  attemptService.finalizeSoloAttempts(round.id, "GROUP_STARTED");
  publishRoom(roomId);
}

export function saveGroupAnswer(
  roomId: number,
  byParticipantId: number,
  questionId: number,
  answer: { choiceIds?: number[]; text?: string },
): void {
  const room = requireLeader(roomId, byParticipantId);
  const round = examRepo.findRound(room.round_id)!;
  finalizeDueRoom(room, round);
  const fresh = repo.findRoom(roomId)!;
  if (!fresh.started_at) throw conflict("아직 시작하지 않았습니다.", "NOT_STARTED");
  if (fresh.submitted_at) throw forbidden("이미 제출되었습니다.", "ALREADY_SUBMITTED");
  const link = examRepo.findLinkByRoundMode(round.id, "GROUP");
  if (!link?.is_open) throw forbidden("닫힌 링크입니다.", "LINK_CLOSED");
  const q = examRepo.findQuestion(questionId);
  if (!q || q.round_id !== round.id) throw notFound("문제를 찾을 수 없습니다.");
  const n = normalizeAnswerInput(q, answer);
  repo.upsertGroupAnswer(roomId, q.id, n.choiceIds, n.text, nowIso());
  publishRoom(roomId);
}

export function submitRoom(roomId: number, byParticipantId: number): void {
  const room = requireLeader(roomId, byParticipantId);
  if (!room.started_at) throw conflict("아직 시작하지 않았습니다.", "NOT_STARTED");
  if (room.submitted_at) return;
  finalizeRoom(room, "MANUAL");
}

function finalizeRoom(room: repo.GroupRoomRow, kind: repo.GroupSubmitKind): void {
  const questions = getRoundQuestions(room.round_id);
  const g = grade(questions, answerMapOf(room.id));
  repo.markRoomSubmitted(room.id, kind, g.correct, g.total, nowIso());
  publishRoom(room.id);
}

function finalizeDueRoom(room: repo.GroupRoomRow, round: examRepo.RoundRow): void {
  if (!room.started_at || room.submitted_at) return;
  if (deadlineOf(round, room.started_at) <= nowIso()) finalizeRoom(room, "TIMEOUT");
}

/** 협력 링크가 닫힐 때: 진행 중이면 즉시 제출. */
export function closeRoomForRound(roundId: number): void {
  const room = repo.findRoomByRound(roundId);
  if (!room) return;
  if (room.started_at && !room.submitted_at) finalizeRoom(room, "LINK_CLOSED");
  else publishRoom(room.id);
}

/** 관리자 결과 화면용. */
export type GroupResultView = {
  started: boolean;
  submitted: boolean;
  submitKind: repo.GroupSubmitKind | null;
  members: { memberNo: number; nickname: string }[];
  leaderMemberNo: number | null;
  answers: Record<number, AnswerView>;
  result: ResultView | null;
};

export function groupResult(roundId: number): GroupResultView | null {
  const room = repo.findRoomByRound(roundId);
  if (!room) return null;
  const round = examRepo.findRound(roundId)!;
  finalizeDueRoom(room, round);
  const fresh = repo.findRoom(room.id)!;
  const members = repo.listMembers(room.id);
  const answers = answerMapOf(room.id);
  return {
    started: fresh.started_at !== null,
    submitted: fresh.submitted_at !== null,
    submitKind: fresh.submit_kind,
    members: members.map((m) => ({ memberNo: m.member_no, nickname: m.nickname })),
    leaderMemberNo: members.find((m) => m.participant_id === fresh.leader_participant_id)?.member_no ?? null,
    answers: toAnswerRecord(answers),
    result: fresh.submitted_at
      ? buildResult(getRoundQuestions(roundId), answers, fresh.correct_count, fresh.question_count)
      : null,
  };
}

/** 대기 화면·관리자 화면에서 개인풀이 진행 이벤트를 방 채널로 옮겨 준다. */
export function roundIdOfRoom(roomId: number): number | null {
  return repo.findRoom(roomId)?.round_id ?? null;
}
