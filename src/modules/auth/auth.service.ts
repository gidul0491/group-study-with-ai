import crypto from "node:crypto";
import { badRequest, unauthorized, conflict, forbidden } from "@shared/lib/errors";
import { nowIso, addMinutes } from "@shared/lib/time";
import { randomToken } from "@shared/lib/random";
import { normalizeAnswer } from "@shared/lib/normalize";
import * as repo from "./auth.repository";

export const SESSION_COOKIE = "gs_admin";
/** 서버 세션 만료. 쿠키는 브라우저를 닫으면 사라지므로 들어올 때마다 로그인한다. */
const SESSION_HOURS = 12;

/** scrypt 해시. 저장 형식: salt$hash (hex). */
export function hashSecret(value: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return `${salt}$${hash}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(value, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export const hashPassword = hashSecret;
export const verifyPassword = verifySecret;

export function hasAdmin(): boolean {
  return repo.countAdmins() > 0;
}

function validateUsername(username: string): void {
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
    throw badRequest("아이디는 영문·숫자·._- 3~30자로 입력하세요.");
  }
}

function validatePassword(password: string): void {
  if (password.length < 6 || password.length > 100) {
    throw badRequest("비밀번호는 6자 이상으로 입력하세요.");
  }
}

function validateRecovery(question: string, answer: string): void {
  if (question.trim().length < 2 || question.length > 200) {
    throw badRequest("비밀번호 찾기 질문은 2~200자로 입력하세요.");
  }
  if (normalizeAnswer(answer).length < 1 || answer.length > 100) {
    throw badRequest("비밀번호 찾기 답변을 입력하세요 (100자 이내).");
  }
}

export type SignupInput = {
  username: string;
  password: string;
  passwordConfirm: string;
  recoveryQuestion: string;
  recoveryAnswer: string;
};

/** 회원가입. 관리자는 여러 명일 수 있다. 가입 직후 세션을 만든다. */
export function signup(input: SignupInput): { sessionId: string; expiresAt: string } {
  const username = input.username.trim();
  validateUsername(username);
  validatePassword(input.password);
  if (input.password !== input.passwordConfirm) throw badRequest("비밀번호 확인이 일치하지 않습니다.");
  validateRecovery(input.recoveryQuestion, input.recoveryAnswer);
  if (repo.findAdminByUsername(username)) throw conflict("이미 쓰고 있는 아이디입니다.", "USERNAME_TAKEN");
  const at = nowIso();
  const id = repo.insertAdmin(
    username,
    hashSecret(input.password),
    input.recoveryQuestion.trim(),
    hashSecret(normalizeAnswer(input.recoveryAnswer)),
    at,
  );
  return createSession(id);
}

export function login(username: string, password: string): { sessionId: string; expiresAt: string } {
  const admin = repo.findAdminByUsername(username.trim());
  if (!admin || !verifySecret(password, admin.password_hash)) {
    throw unauthorized("아이디 또는 비밀번호가 맞지 않습니다.");
  }
  return createSession(admin.id);
}

function createSession(adminId: number): { sessionId: string; expiresAt: string } {
  const at = nowIso();
  repo.deleteExpiredSessions(at);
  const sessionId = randomToken(32);
  const expiresAt = addMinutes(at, SESSION_HOURS * 60);
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

export function currentAdmin(adminId: number): { id: number; username: string; hasRecovery: boolean } {
  const admin = repo.findAdminById(adminId);
  if (!admin) throw unauthorized();
  return { id: admin.id, username: admin.username, hasRecovery: admin.recovery_answer_hash !== "" };
}

export function changePassword(adminId: number, current: string, next: string): void {
  const admin = repo.findAdminById(adminId);
  if (!admin) throw unauthorized();
  if (!verifySecret(current, admin.password_hash)) throw badRequest("현재 비밀번호가 맞지 않습니다.");
  validatePassword(next);
  repo.updateAdminPassword(adminId, hashSecret(next), nowIso());
}

/** 비밀번호 찾기 질문·답변 등록/변경. 현재 비밀번호로 본인 확인. */
export function updateRecovery(adminId: number, currentPassword: string, question: string, answer: string): void {
  const admin = repo.findAdminById(adminId);
  if (!admin) throw unauthorized();
  if (!verifySecret(currentPassword, admin.password_hash)) throw badRequest("현재 비밀번호가 맞지 않습니다.");
  validateRecovery(question, answer);
  repo.updateAdminRecovery(adminId, question.trim(), hashSecret(normalizeAnswer(answer)), nowIso());
}

// ---------- 비밀번호 찾기 ----------

const MAX_RECOVERY_FAILURES = 5;
const RECOVERY_LOCK_MINUTES = 10;
const recoveryFailures = new Map<string, { count: number; lockedUntil: string | null }>();

function checkRecoveryLock(username: string): void {
  const f = recoveryFailures.get(username);
  if (f?.lockedUntil && f.lockedUntil > nowIso()) {
    throw forbidden("답변을 여러 번 틀려 잠시 잠겼습니다. 10분 뒤에 다시 시도하세요.", "RECOVERY_LOCKED");
  }
}

function recordRecoveryFailure(username: string): void {
  const f = recoveryFailures.get(username) ?? { count: 0, lockedUntil: null };
  f.count += 1;
  if (f.count >= MAX_RECOVERY_FAILURES) {
    f.count = 0;
    f.lockedUntil = addMinutes(nowIso(), RECOVERY_LOCK_MINUTES);
  }
  recoveryFailures.set(username, f);
}

/** 1단계: 아이디로 질문을 본다. 없는 아이디나 질문 미등록도 같은 문구로 답한다. */
export function recoveryQuestion(username: string): string {
  const admin = repo.findAdminByUsername(username.trim());
  if (!admin || !admin.recovery_question || !admin.recovery_answer_hash) {
    throw badRequest("그 아이디로는 비밀번호를 찾을 수 없습니다. 아이디를 확인하거나 다른 관리자에게 문의하세요.", "NO_RECOVERY");
  }
  checkRecoveryLock(admin.username);
  return admin.recovery_question;
}

/** 2단계: 답변이 맞으면 새 비밀번호로 바꾸고 기존 세션을 모두 끊는다. */
export function resetPassword(username: string, answer: string, newPassword: string, confirm: string): void {
  const admin = repo.findAdminByUsername(username.trim());
  if (!admin || !admin.recovery_answer_hash) throw badRequest("그 아이디로는 비밀번호를 찾을 수 없습니다.", "NO_RECOVERY");
  checkRecoveryLock(admin.username);
  if (!verifySecret(normalizeAnswer(answer), admin.recovery_answer_hash)) {
    recordRecoveryFailure(admin.username);
    throw badRequest("답변이 맞지 않습니다.", "RECOVERY_WRONG");
  }
  validatePassword(newPassword);
  if (newPassword !== confirm) throw badRequest("비밀번호 확인이 일치하지 않습니다.");
  repo.updateAdminPassword(admin.id, hashSecret(newPassword), nowIso());
  repo.deleteSessionsOfAdmin(admin.id);
  recoveryFailures.delete(admin.username);
}
