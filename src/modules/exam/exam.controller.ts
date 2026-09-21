import { requireAdmin, requestOrigin } from "@modules/auth/auth.controller";
import { baseUrlFor } from "@modules/setting/setting.service";
import * as service from "./exam.service";
import * as attemptService from "@modules/attempt/attempt.service";
import * as roomService from "@modules/room/room.service";
import * as generation from "@modules/generation/generation.service";
import { getRoundQuestions } from "./question.view";
import { localInputToIso } from "@shared/lib/time";
import { badRequest } from "@shared/lib/errors";
import { qrSvg } from "@modules/export/qr";

/** 관리자 서버 함수들이 부르는 컨트롤러. 모두 requireAdmin()을 거친다. */

export function listExams() {
  requireAdmin();
  return service.listExamSummaries();
}

export function examDetail(examId: number) {
  requireAdmin();
  return service.getExamDetail(examId);
}

export function generationJob(examId: number) {
  requireAdmin();
  return generation.getJob(examId);
}

export function parseTimes(form: FormData): service.RoundTimesInput {
  const startsRaw = String(form.get("startsAt") ?? "");
  const endsRaw = String(form.get("endsAt") ?? "");
  if (!startsRaw || !endsRaw) throw badRequest("시작 시각과 종료 시각을 입력하세요.");
  return {
    startsAt: localInputToIso(startsRaw),
    endsAt: localInputToIso(endsRaw),
    soloLimitMin: Number(form.get("soloLimitMin")),
    groupLimitMin: Number(form.get("groupLimitMin")),
  };
}

export function createExam(input: service.CreateExamInput) {
  requireAdmin();
  return service.createExam(input);
}

export function deleteExam(examId: number) {
  requireAdmin();
  service.deleteExam(examId);
}

export function createRound(examId: number, times: service.RoundTimesInput) {
  requireAdmin();
  return service.createRound(examId, times);
}

export function deleteRound(roundId: number) {
  requireAdmin();
  return service.deleteRound(roundId);
}

export function updateRoundTimes(examId: number, times: service.RoundTimesInput) {
  requireAdmin();
  return service.updateRoundTimes(examId, times);
}

export function deleteSource(examId: number, sourceId: number) {
  requireAdmin();
  service.deleteSourceFromExam(examId, sourceId);
}

export function deleteQuestion(examId: number, questionId: number) {
  requireAdmin();
  service.deleteQuestionFromExam(examId, questionId);
}

export async function regenerateSource(examId: number, sourceId: number) {
  requireAdmin();
  await service.regenerateSourceInExam(examId, sourceId);
}

export async function regenerateQuestion(examId: number, questionId: number) {
  requireAdmin();
  await service.regenerateQuestionInExam(examId, questionId);
}

export function setLinkOpen(linkId: number, open: boolean) {
  requireAdmin();
  return service.setLinkOpen(linkId, open);
}

export function regenerateLink(linkId: number) {
  requireAdmin();
  return service.regenerateLinkToken(linkId);
}

/** 차시의 링크 두 개를 URL·QR과 함께. */
export async function roundLinks(roundId: number) {
  requireAdmin();
  const base = baseUrlFor(requestOrigin());
  const round = service.getRound(roundId);
  const view = service.roundView(round);
  const links = [];
  for (const l of view.links) {
    const url = `${base}${service.linkPath(l.mode, l.token)}`;
    links.push({ ...l, url, qr: await qrSvg(url) });
  }
  return { roundId, roundNo: round.round_no, links };
}

export type RoundResults = {
  roundId: number;
  roundNo: number;
  questions: ReturnType<typeof getRoundQuestions>;
  scores: attemptService.ParticipantScore[];
  stats: attemptService.QuestionStat[];
  group: roomService.GroupResultView | null;
};

export function roundResults(roundId: number): RoundResults {
  requireAdmin();
  const round = service.getRound(roundId);
  return {
    roundId,
    roundNo: round.round_no,
    questions: getRoundQuestions(roundId),
    scores: attemptService.participantScores(roundId),
    stats: attemptService.roundStats(roundId),
    group: roomService.groupResult(roundId),
  };
}
