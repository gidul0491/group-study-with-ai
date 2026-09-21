import fs from "node:fs";
import path from "node:path";

/**
 * `.env.txt`를 읽어 process.env에 넣는다 (이미 있는 키는 덮지 않는다).
 * 개발 서버(vite dev)는 .env.txt를 모르므로 서버 코드가 직접 읽는다.
 * 운영(`npm start`)은 node --env-file-if-exists 로도 읽지만, 여기서도 한 번 더 읽어 두 경로를 같게 한다.
 */
let loaded = false;

export function loadEnvFile(): void {
  if (loaded) return;
  loaded = true;
  const file = path.resolve(process.cwd(), ".env.txt");
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export type AppEnv = {
  geminiApiKey: string;
  geminiModel: string;
  /** GEMINI_MOCK=1 이면 API 대신 모의 출제 (개발·화면 확인용) */
  geminiMock: boolean;
  dbPath: string;
  sessionSecret: string;
  timeZone: string;
};

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (cached) return cached;
  loadEnvFile();
  cached = {
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    geminiMock: process.env.GEMINI_MOCK === "1",
    dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), "data", "app.db"),
    sessionSecret: process.env.SESSION_SECRET ?? "",
    timeZone: "Asia/Seoul",
  };
  return cached;
}
