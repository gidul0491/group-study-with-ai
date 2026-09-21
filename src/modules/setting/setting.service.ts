import { badRequest } from "@shared/lib/errors";
import { nowIso } from "@shared/lib/time";
import * as repo from "./setting.repository";

export const PUBLIC_BASE_URL = "PUBLIC_BASE_URL";

export function publicBaseUrl(): string {
  return repo.findSetting(PUBLIC_BASE_URL) ?? "";
}

/** 비어 있으면 지운다. 값이 있으면 http(s) 주소여야 하고 끝의 /는 뗀다. */
export function savePublicBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw badRequest("공개 주소는 http:// 또는 https:// 로 시작하는 주소여야 합니다.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw badRequest("공개 주소는 http:// 또는 https:// 로 시작해야 합니다.");
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      throw badRequest("공개 주소는 경로 없이 호스트(와 포트)까지만 적습니다.");
    }
  }
  repo.upsertSetting(PUBLIC_BASE_URL, trimmed, nowIso());
  return trimmed;
}

export const DEFAULT_PROMPT = "DEFAULT_PROMPT";
const MAX_PROMPT_CHARS = 5000;

/** 새 시험지의 공통 프롬프트 칸에 미리 채워지는 기본 프롬프트. */
export function defaultPrompt(): string {
  return repo.findSetting(DEFAULT_PROMPT) ?? "";
}

export function saveDefaultPrompt(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length > MAX_PROMPT_CHARS) {
    throw badRequest(`기본 프롬프트는 ${MAX_PROMPT_CHARS.toLocaleString()}자까지 저장할 수 있습니다.`);
  }
  repo.upsertSetting(DEFAULT_PROMPT, trimmed, nowIso());
  return trimmed;
}

/** 링크에 쓸 기준 주소. 설정이 비어 있으면 요청 Origin. */
export function baseUrlFor(requestOrigin: string): string {
  return publicBaseUrl() || requestOrigin;
}
