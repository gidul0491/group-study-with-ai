import { getRequestEvent } from "solid-js/web";
import { getCookie, setCookie, deleteCookie } from "@solidjs/start/http";
import { unauthorized } from "@shared/lib/errors";
import * as service from "./auth.service";

/**
 * 컨트롤러: 쿠키·요청을 다루고 서비스를 부른다 (가이드 5-3).
 * 서버 함수("use server")와 API 라우트 양쪽에서 쓴다.
 */

function cookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

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

export function authState(): { hasAdmin: boolean; loggedIn: boolean } {
  return { hasAdmin: service.hasAdmin(), loggedIn: currentAdminId() !== null };
}

export function setup(username: string, password: string): void {
  const s = service.setupAdmin(username, password);
  setCookie(service.SESSION_COOKIE, s.sessionId, cookieOptions(s.expiresAt));
}

export function login(username: string, password: string): void {
  const s = service.login(username, password);
  setCookie(service.SESSION_COOKIE, s.sessionId, cookieOptions(s.expiresAt));
}

export function logout(): void {
  service.logout(getCookie(service.SESSION_COOKIE));
  deleteCookie(service.SESSION_COOKIE, { path: "/" });
}

export function changePassword(current: string, next: string): void {
  const id = requireAdmin();
  service.changePassword(id, current, next);
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
