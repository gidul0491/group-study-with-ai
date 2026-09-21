import { defineTheme } from "som-style/solid";

/**
 * 따뜻하고 눈이 편한 라이트 테마 하나만 쓴다 (다크 모드 없음: dark에도 같은 값).
 * hue 60 근처의 크림·갈색·살구 계열. 팔레트 색은 OKLCH 리터럴만.
 * 정적 추출 때문에 light/dark는 객체 리터럴로 직접 적는다.
 */
export const theme = defineTheme({
  defaultTheme: "light",
  light: {
    hue: "60",
    edgeShine: "oklch(1 0 0 / 0.7)",
    edgeShade: "oklch(0.4 0.03 var(--som-theme-hue) / 0.16)",
    softBorder:
      "color-mix(in oklch, var(--som-theme-border-strong) 45%, transparent)",
    softBorderOnFill:
      "color-mix(in oklch, var(--som-theme-on-primary) 32%, transparent)",
    shadow: "oklch(0.3 0.04 var(--som-theme-hue) / 0.12)",
    shadowStrong: "oklch(0.25 0.04 var(--som-theme-hue) / 0.18)",
    primary: "oklch(0.66 0.14 50)",
    primaryHover: "oklch(0.6 0.15 50)",
    primaryFocus: "oklch(0.66 0.14 50 / 0.45)",
    onPrimary: "oklch(0.995 0.005 85)",
    text: "oklch(0.34 0.03 var(--som-theme-hue))",
    textHeading: "oklch(0.27 0.035 55)",
    textMuted: "oklch(0.55 0.03 var(--som-theme-hue))",
    bg: "oklch(0.975 0.014 80)",
    surface: "oklch(0.995 0.008 85)",
    surfaceMuted: "oklch(0.96 0.018 80)",
    border: "oklch(0.9 0.02 75)",
    borderStrong: "oklch(0.8 0.03 70)",
    success: "oklch(0.62 0.13 145)",
    danger: "oklch(0.6 0.17 28)",
    warning: "oklch(0.78 0.13 80)",
    mark: "oklch(0.95 0.05 80)",
  },
  dark: {
    hue: "60",
    edgeShine: "oklch(1 0 0 / 0.7)",
    edgeShade: "oklch(0.4 0.03 var(--som-theme-hue) / 0.16)",
    softBorder:
      "color-mix(in oklch, var(--som-theme-border-strong) 45%, transparent)",
    softBorderOnFill:
      "color-mix(in oklch, var(--som-theme-on-primary) 32%, transparent)",
    shadow: "oklch(0.3 0.04 var(--som-theme-hue) / 0.12)",
    shadowStrong: "oklch(0.25 0.04 var(--som-theme-hue) / 0.18)",
    primary: "oklch(0.66 0.14 50)",
    primaryHover: "oklch(0.6 0.15 50)",
    primaryFocus: "oklch(0.66 0.14 50 / 0.45)",
    onPrimary: "oklch(0.995 0.005 85)",
    text: "oklch(0.34 0.03 var(--som-theme-hue))",
    textHeading: "oklch(0.27 0.035 55)",
    textMuted: "oklch(0.55 0.03 var(--som-theme-hue))",
    bg: "oklch(0.975 0.014 80)",
    surface: "oklch(0.995 0.008 85)",
    surfaceMuted: "oklch(0.96 0.018 80)",
    border: "oklch(0.9 0.02 75)",
    borderStrong: "oklch(0.8 0.03 70)",
    success: "oklch(0.62 0.13 145)",
    danger: "oklch(0.6 0.17 28)",
    warning: "oklch(0.78 0.13 80)",
    mark: "oklch(0.95 0.05 80)",
  },
});
