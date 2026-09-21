/**
 * 업무 오류. 서비스가 던지고 컨트롤러/라우트가 HTTP 상태로 바꾼다 (가이드 6-4).
 * code는 대문자 스네이크, message는 화면에 그대로 보여도 되는 한국어.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") =>
  new AppError(400, code, message);
export const unauthorized = (message = "로그인이 필요합니다.") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message: string, code = "FORBIDDEN") =>
  new AppError(403, code, message);
export const notFound = (message = "찾을 수 없습니다.") =>
  new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string, code = "CONFLICT") =>
  new AppError(409, code, message);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** 서버 함수/라우트에서 오류를 { ok:false, error } 형태로 바꾼다. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function toResult<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

export async function toResultAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

export function describeError(e: unknown): { code: string; message: string } {
  if (isAppError(e)) return { code: e.code, message: e.message };
  console.error(e);
  return { code: "INTERNAL", message: "서버 오류가 발생했습니다." };
}
