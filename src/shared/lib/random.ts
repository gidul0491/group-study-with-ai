import crypto from "node:crypto";

/** URL-safe 랜덤 토큰. 24바이트 = 32자. */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomInt(maxExclusive: number): number {
  return crypto.randomInt(maxExclusive);
}

export function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}
