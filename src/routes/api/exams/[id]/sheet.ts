import type { APIEvent } from "@solidjs/start/server";
import { currentAdminId } from "@modules/auth/auth.controller";
import { assertOwner, assertRoundOwner, getExamDetail, getRound } from "@modules/exam/exam.service";
import { getRoundQuestions } from "@modules/exam/question.view";
import { roundStats } from "@modules/attempt/attempt.service";
import { groupResult } from "@modules/room/room.service";
import { buildGroupMarkdown, buildMarkdown, groupSheetFileName, sheetFileName } from "@modules/export/markdown";
import { buildGroupPdf, buildPdf } from "@modules/export/pdf";
import { describeError, isAppError } from "@shared/lib/errors";

/**
 * GET /api/exams/:id/sheet?format=md|pdf&answers=0|1        문제지 / 답안지 (최신 차시)
 * GET /api/exams/:id/sheet?format=md|pdf&kind=group&round=N 협력 답안 (그룹 선택 + 개인 제출 비율)
 * 시험지 소유자만.
 */
export async function GET(event: APIEvent): Promise<Response> {
  const adminId = currentAdminId();
  if (adminId === null) return new Response("Unauthorized", { status: 401 });
  const url = new URL(event.request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "md";
  const kind = url.searchParams.get("kind") === "group" ? "group" : "sheet";
  try {
    const examId = Number(event.params.id);
    const exam = assertOwner(examId, adminId);

    if (kind === "group") {
      const roundId = Number(url.searchParams.get("round"));
      if (assertRoundOwner(roundId, adminId) !== examId) throw new Error("차시가 이 시험지의 것이 아닙니다.");
      const round = getRound(roundId);
      const group = groupResult(roundId);
      const input = {
        title: exam.title,
        roundNo: round.round_no,
        questions: getRoundQuestions(roundId),
        groupAnswers: group?.answers ?? {},
        groupScore: group?.result ? { correct: group.result.correct, total: group.result.total } : null,
        members: group?.members ?? [],
        stats: roundStats(roundId),
      };
      const fileName = groupSheetFileName(exam.title, round.round_no, format);
      return respond(format, fileName, () => buildGroupMarkdown(input), () => buildGroupPdf(input));
    }

    const withAnswers = url.searchParams.get("answers") === "1";
    const detail = getExamDetail(examId);
    const input = {
      title: detail.title,
      roundNo: detail.latestRound.roundNo,
      questions: detail.questions,
      withAnswers,
    };
    const fileName = sheetFileName(detail.title, detail.latestRound.roundNo, withAnswers, format);
    return respond(format, fileName, () => buildMarkdown(input), () => buildPdf(input));
  } catch (e) {
    const err = describeError(e);
    return new Response(err.message, { status: isAppError(e) ? e.status : 400 });
  }
}

async function respond(
  format: "md" | "pdf",
  fileName: string,
  md: () => string,
  pdf: () => Promise<Buffer>,
): Promise<Response> {
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  if (format === "pdf") {
    return new Response(new Uint8Array(await pdf()), {
      headers: { "content-type": "application/pdf", "content-disposition": disposition },
    });
  }
  return new Response(md(), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": disposition },
  });
}
