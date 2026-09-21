import crypto from "node:crypto";
import { badRequest, unauthorized, conflict } from "@shared/lib/errors";
import { nowIso, addMinutes } from "@shared/lib/time";
import { randomToken } from "@shared/lib/random";
import * as repo from "./auth.repository";

export const SESSION_COOKIE = "gs_admin";
const SESSION_DAYS = 7;

/** scrypt 해시. 저장 형식: salt$hash (hex). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function hasAdmin(): boolean {
  return repo.countAdmins() > 0;
}

function validateCredentials(username: string, password: string): void {
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    throw badRequest("아이디는 영문·숫자·._- 3~30자로 입력하세요.");
  }
  if (password.length < 6 || password.length > 100) {
    throw badRequest("비밀번호는 6자 이상으로 입력하세요.");
  }
}

/** 최초 관리자 생성. 이미 있으면 거부. 생성 후 바로 세션을 만든다. */
export function setupAdmin(username: string, password: string): { sessionId: string; expiresAt: string } {
  if (hasAdmin()) throw conflict("관리자 계정이 이미 있습니다.", "ADMIN_EXISTS");
  validateCredentials(username, password);
  const at = nowIso();
  const id = repo.insertAdmin(username, hashPassword(password), at);
  return createSession(id);
}

export function login(username: string, password: string): { sessionId: string; expiresAt: string } {
  const admin = repo.findAdminByUsername(username.trim());
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    throw unauthorized("아이디 또는 비밀번호가 맞지 않습니다.");
  }
  return createSession(admin.id);
}

function createSession(adminId: number): { sessionId: string; expiresAt: string } {
  const at = nowIso();
  repo.deleteExpiredSessions(at);
  const sessionId = randomToken(32);
  const expiresAt = addMinutes(at, SESSION_DAYS * 24 * 60);
  repo.insertSession(sessionId, adminId, expiresAt, at);
  return { sessionId, expiresAt };
}

export function logout(sessionId: string | undefined): void {
  if (sessionId) repo.deleteSession(sessionId);
}

/** 세션 쿠키 값으로 관리자 id를 돌려준다. 없거나 만료면 null. */
export function resolveAdminId(sessionId: string | undefined): number | null {
  if (!sessionId) return null;
  const s = repo.findSession(sessionId);
  if (!s) return null;
  if (s.expires_at <= nowIso()) {
    repo.deleteSession(sessionId);
    return null;
  }
  return s.admin_id;
}

export function changePassword(adminId: number, current: string, next: string): void {
  const admin = repo.findAdminById(adminId);
  if (!admin) throw unauthorized();
  if (!verifyPassword(current, admin.password_hash)) {
    throw badRequest("현재 비밀번호가 맞지 않습니다.");
  }
  validateCredentials(admin.username, next);
  repo.updateAdminPassword(adminId, hashPassword(next), nowIso());
}
