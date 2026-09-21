import type { APIEvent } from "@solidjs/start/server";
import { currentAdminId } from "@modules/auth/auth.controller";
import { assertOwner } from "@modules/exam/exam.service";
import { getJob, jobChannel } from "@modules/generation/generation.service";
import { sseResponse } from "@shared/lib/sse";

/** GET /api/generation/:examId — 출제 진행 상황 SSE. 시험지 소유자만. */
export function GET(event: APIEvent): Response {
  const adminId = currentAdminId();
  if (adminId === null) return new Response("Unauthorized", { status: 401 });
  const examId = Number(event.params.examId);
  try {
    assertOwner(examId, adminId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return sseResponse(jobChannel(examId), () => getJob(examId), event.request);
}
