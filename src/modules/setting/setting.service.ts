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

/** 링크에 쓸 기준 주소. 설정이 비어 있으면 요청 Origin. */
export function baseUrlFor(requestOrigin: string): string {
  return publicBaseUrl() || requestOrigin;
}
