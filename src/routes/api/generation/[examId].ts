import type { APIEvent } from "@solidjs/start/server";
import { currentAdminId } from "@modules/auth/auth.controller";
import { getJob, jobChannel } from "@modules/generation/generation.service";
import { sseResponse } from "@shared/lib/sse";

/** GET /api/generation/:examId — 출제 진행 상황 SSE. */
export function GET(event: APIEvent): Response {
  if (currentAdminId() === null) return new Response("Unauthorized", { status: 401 });
  const examId = Number(event.params.examId);
  return sseResponse(jobChannel(examId), () => getJob(examId), event.request);
}
