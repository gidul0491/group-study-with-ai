/** 서버 시각. 테스트에서 고정할 수 있게 한 곳에서만 Date를 만든다. */
let override: (() => Date) | null = null;

export function now(): Date {
  return override ? override() : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}

export function setNowForTest(fn: (() => Date) | null): void {
  override = fn;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= now().getTime();
}

const TZ = "Asia/Seoul";

/** 화면 표시용: 2026-09-22 14:30 */
export function formatLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** <input type="datetime-local"> 값(서울 시각) → UTC ISO */
export function localInputToIso(value: string): string {
  // value: "2026-09-22T14:30". 서울은 DST가 없으므로 +09:00 고정.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error("시각 형식이 잘못되었습니다.");
  }
  return new Date(`${value.slice(0, 16)}:00+09:00`).toISOString();
}

/** UTC ISO → <input type="datetime-local"> 값(서울 시각) */
export function isoToLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

/** 남은 초. 음수면 0. */
export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now().getTime()) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
