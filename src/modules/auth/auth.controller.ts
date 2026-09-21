import { getRequestEvent } from "solid-js/web";
import { getCookie, setCookie, deleteCookie } from "@solidjs/start/http";
import { unauthorized } from "@shared/lib/errors";
import * as service from "./auth.service";

/**
 * 컨트롤러: 쿠키·요청을 다루고 서비스를 부른다 (가이드 5-3).
 * 서버 함수("use server")와 API 라우트 양쪽에서 쓴다.
 * 세션 쿠키는 expires 없이 심어 브라우저를 닫으면 사라진다 (들어올 때마다 로그인).
 */

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function currentAdminId(): number | null {
  const sessionId = getCookie(service.SESSION_COOKIE);
  return service.resolveAdminId(sessionId);
}

/** 관리자 세션이 없으면 401을 던진다. */
export function requireAdmin(): number {
  const id = currentAdminId();
  if (id === null) throw unauthorized();
  return id;
}

export function authState(): { loggedIn: boolean } {
  return { loggedIn: currentAdminId() !== null };
}

export function me(): { id: number; username: string; hasRecovery: boolean } {
  return service.currentAdmin(requireAdmin());
}

export function signup(input: service.SignupInput): void {
  const s = service.signup(input);
  setCookie(service.SESSION_COOKIE, s.sessionId, cookieOptions);
}

export function login(username: string, password: string): void {
  const s = service.login(username, password);
  setCookie(service.SESSION_COOKIE, s.sessionId, cookieOptions);
}

export function logout(): void {
  service.logout(getCookie(service.SESSION_COOKIE));
  deleteCookie(service.SESSION_COOKIE, { path: "/" });
}

export function changePassword(current: string, next: string): void {
  service.changePassword(requireAdmin(), current, next);
}

export function updateRecovery(currentPassword: string, question: string, answer: string): void {
  service.updateRecovery(requireAdmin(), currentPassword, question, answer);
}

export function recoveryQuestion(username: string): string {
  return service.recoveryQuestion(username);
}

export function resetPassword(username: string, answer: string, newPassword: string, confirm: string): void {
  service.resetPassword(username, answer, newPassword, confirm);
}

/** 요청 Origin (공개 주소가 비어 있을 때의 기본값). */
export function requestOrigin(): string {
  const event = getRequestEvent();
  if (!event) return "";
  const url = new URL(event.request.url);
  const forwardedProto = event.request.headers.get("x-forwarded-proto");
  const forwardedHost = event.request.headers.get("x-forwarded-host");
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? event.request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
