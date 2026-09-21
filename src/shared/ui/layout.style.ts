import { style } from "som-style/solid";
import { theme } from "@style/theme.js";

/** 화면 전체. PC에서는 모바일 폭 컬럼을 가운데 두고 양옆은 배경색. */
export const shell = style({
  base: {
    minHeight: "100dvh",
    display: "flex",
    justifyContent: "center",
    background: theme.bg,
  },
});

export const shellColumn = style({
  base: {
    width: "100%",
    maxWidth: "30rem",
    minHeight: "100dvh",
    background: theme.bg,
  },
  pc: {
    borderLeft: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    boxShadow: `0 0 40px ${theme.shadow}`,
  },
});

export const page = style({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem 1rem 3rem",
  },
});

export const topBar = style({
  base: {
    position: "sticky",
    top: "0",
    zIndex: "10",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    background: `color-mix(in oklch, ${theme.bg} 88%, transparent)`,
    backdropFilter: "blur(10px)",
    borderBottom: `1px solid ${theme.border}`,
  },
});

export const topBarTitle = style({
  base: {
    flex: "1",
    minWidth: "0",
    fontSize: "1.05rem",
    fontWeight: "700",
    color: theme.textHeading,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

export const card = style({
  base: {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: "0.875rem",
    padding: "1rem",
    boxShadow: `0 1px 2px ${theme.shadow}`,
  },
});

export const cardTitle = style({
  base: {
    fontSize: "1rem",
    fontWeight: "700",
    color: theme.textHeading,
    marginBottom: "0.5rem",
  },
});

export const field = style({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
});

export const fieldLabel = style({
  base: {
    fontSize: "0.85rem",
    fontWeight: "600",
    color: theme.textMuted,
  },
});

export const textInput = style({
  base: {
    width: "100%",
    minHeight: "44px",
    padding: "0.6rem 0.8rem",
    borderRadius: "0.65rem",
    border: `1px solid ${theme.borderStrong}`,
    background: theme.surface,
    color: theme.text,
    fontSize: "1rem",
    outline: "none",
    "&:focus": {
      borderColor: theme.primary,
      boxShadow: `0 0 0 3px ${theme.primaryFocus}`,
    },
  },
});

export const textArea = textInput.extend({
  base: {
    minHeight: "6rem",
    resize: "vertical",
    lineHeight: "1.5",
  },
});

export const buttonPrimary = style({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    minHeight: "44px",
    padding: "0.6rem 1.1rem",
    borderRadius: "0.75rem",
    border: "1px solid transparent",
    background: theme.primary,
    color: theme.onPrimary,
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
    textDecoration: "none",
    "&:hover": { background: theme.primaryHover },
    "&:disabled": { opacity: "0.5", cursor: "not-allowed" },
    "&:focus-visible": {
      outline: `2px solid ${theme.primaryFocus}`,
      outlineOffset: "2px",
    },
  },
});

export const buttonSecondary = buttonPrimary.extend({
  base: {
    background: theme.surfaceMuted,
    color: theme.textHeading,
    border: `1px solid ${theme.borderStrong}`,
    "&:hover": { background: theme.mark },
  },
});

export const buttonDanger = buttonPrimary.extend({
  base: {
    background: theme.danger,
    "&:hover": { background: theme.danger, filter: "brightness(0.95)" },
  },
});

export const buttonSmall = style({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "36px",
    padding: "0.35rem 0.75rem",
    borderRadius: "0.6rem",
    border: `1px solid ${theme.borderStrong}`,
    background: theme.surface,
    color: theme.textHeading,
    fontWeight: "600",
    fontSize: "0.9rem",
    cursor: "pointer",
    textDecoration: "none",
    "&:hover": { background: theme.surfaceMuted },
    "&:disabled": { opacity: "0.5", cursor: "not-allowed" },
  },
});

export const buttonBlock = style({
  base: { width: "100%" },
});

export const rowBetween = style({
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
  },
});

export const rowWrap = style({
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
  },
});

export const stack = style({
  base: { display: "flex", flexDirection: "column", gap: "0.75rem" },
});

export const muted = style({
  base: { color: theme.textMuted, fontSize: "0.9rem" },
});

export const errorText = style({
  base: { color: theme.danger, fontSize: "0.9rem", fontWeight: "600" },
});

export const badge = style({
  base: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.15rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.78rem",
    fontWeight: "700",
    background: theme.surfaceMuted,
    color: theme.textMuted,
    border: `1px solid ${theme.border}`,
  },
});

export const badgePrimary = badge.extend({
  base: {
    background: theme.mark,
    color: theme.primaryHover,
    borderColor: theme.primary,
  },
});

export const badgeSuccess = badge.extend({
  base: {
    background: "oklch(0.95 0.04 145)",
    color: theme.success,
    borderColor: theme.success,
  },
});

export const badgeDanger = badge.extend({
  base: {
    background: "oklch(0.95 0.04 28)",
    color: theme.danger,
    borderColor: theme.danger,
  },
});

export const centerBox = style({
  base: {
    minHeight: "70dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "2rem 1rem",
    textAlign: "center",
  },
});

export const heading = style({
  base: {
    fontSize: "1.6rem",
    fontWeight: "800",
    color: theme.textHeading,
    letterSpacing: "-0.02em",
  },
});

export const subheading = style({
  base: {
    fontSize: "1.1rem",
    fontWeight: "700",
    color: theme.textHeading,
  },
});

export const listItem = style({
  base: {
    display: "block",
    padding: "0.9rem 1rem",
    borderRadius: "0.8rem",
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    textDecoration: "none",
    "&:hover": { borderColor: theme.borderStrong, background: theme.surfaceMuted },
  },
});

export const divider = style({
  base: { height: "1px", background: theme.border, margin: "0.25rem 0" },
});

export const tabs = style({
  base: {
    display: "flex",
    gap: "0.25rem",
    padding: "0.25rem",
    borderRadius: "0.75rem",
    background: theme.surfaceMuted,
  },
});

export const tab = style({
  base: {
    flex: "1",
    minHeight: "38px",
    borderRadius: "0.6rem",
    border: "1px solid transparent",
    background: "transparent",
    color: theme.textMuted,
    fontWeight: "600",
    cursor: "pointer",
  },
});

export const tabActive = tab.extend({
  base: {
    background: theme.surface,
    color: theme.textHeading,
    borderColor: theme.border,
    boxShadow: `0 1px 2px ${theme.shadow}`,
  },
});
