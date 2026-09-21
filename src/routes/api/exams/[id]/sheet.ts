import type { APIEvent } from "@solidjs/start/server";
import { currentAdminId } from "@modules/auth/auth.controller";
import { getExamDetail } from "@modules/exam/exam.service";
import { buildMarkdown, sheetFileName } from "@modules/export/markdown";
import { buildPdf } from "@modules/export/pdf";
import { describeError } from "@shared/lib/errors";

/**
 * GET /api/exams/:id/sheet?format=md|pdf&answers=0|1
 * 최신 차시의 문제지/답안지를 내려준다.
 */
export async function GET(event: APIEvent): Promise<Response> {
  if (currentAdminId() === null) return new Response("Unauthorized", { status: 401 });
  const url = new URL(event.request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "md";
  const withAnswers = url.searchParams.get("answers") === "1";
  try {
    const detail = getExamDetail(Number(event.params.id));
    const input = {
      title: detail.title,
      roundNo: detail.latestRound.roundNo,
      questions: detail.questions,
      withAnswers,
    };
    const fileName = sheetFileName(detail.title, detail.latestRound.roundNo, withAnswers, format);
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    if (format === "pdf") {
      const pdf = await buildPdf(input);
      return new Response(new Uint8Array(pdf), {
        headers: { "content-type": "application/pdf", "content-disposition": disposition },
      });
    }
    return new Response(buildMarkdown(input), {
      headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": disposition },
    });
  } catch (e) {
    const err = describeError(e);
    return new Response(err.message, { status: 400 });
  }
}
