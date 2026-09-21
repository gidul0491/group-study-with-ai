import { createMiddleware } from "@solidjs/start/middleware";
import { loadEnvFile } from "@shared/config/env";
import { db } from "@shared/db/db";

/**
 * 모든 요청 전에 환경변수와 DB(마이그레이션)를 준비한다.
 * 관리자 인증은 각 admin 라우트/서버 함수에서 requireAdmin()으로 확인한다.
 */
export default createMiddleware([
  async (_event, next) => {
    loadEnvFile();
    db();
    return next();
  },
]);
