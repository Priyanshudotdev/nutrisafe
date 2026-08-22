// ─── AI Food Safety Check — Design Token System ──────────────────────────────
//
// SOURCE OF TRUTH: /DESIGN_RULES.md — read before changing any visual value.
// Colors communicate state only; chrome stays neutral. Similar components share
// identical geometry. When in doubt, reuse an existing token — never invent one.

import { Platform } from "react-native";

export const colors = {
  // ─── Core Brand (Clinical Teal) ──────────────────────────────────────────────
  primary: "#0D9488",
  primaryDark: "#0F766E",
  primaryDeep: "#115E59",
  primaryLight: "#CCFBF1",
  primaryMuted: "#F0FDFA",

  // ─── Secondary Accent (Warm Amber) ───────────────────────────────────────────
  secondary: "#F59E0B",
  secondaryLight: "#FEF3C7",
  secondaryDark: "#D97706",

  // ─── Dark Tones (Slate) ──────────────────────────────────────────────────────
  dark: "#0F172A",
  darkTeal: "#115E59",
  slateDark: "#1E293B",
  slateMedium: "#334155",
  slateLight: "#64748B",
  slateMuted: "#94A3B8",

  // ─── Surfaces & Backgrounds ──────────────────────────────────────────────────
  background: "#F8FAFC",
  bgSubtle: "#F1F5F9",
  cardBg: "#FFFFFF",
  cardBorder: "#E2E8F0",
  cardBorderSubtle: "#F1F5F9",
  white: "#FFFFFF",

  // ─── Safety Status: SAFE ─────────────────────────────────────────────────────
  safeText: "#065F46",
  safeBg: "#D1FAE5",
  safeBorder: "#10B981",
  safeIcon: "#059669",

  // ─── Safety Status: MODERATION ───────────────────────────────────────────────
  moderationText: "#92400E",
  moderationBg: "#FEF3C7",
  moderationBorder: "#F59E0B",
  moderationIcon: "#D97706",

  // ─── Safety Status: NOT RECOMMENDED ──────────────────────────────────────────
  dangerText: "#991B1B",
  dangerBg: "#FEE2E2",
  dangerBorder: "#EF4444",
  dangerIcon: "#DC2626",
  danger: "#DC2626",

  // ─── Condition Badge Colors ──────────────────────────────────────────────────
  diabetesColor: "#2563EB",
  diabetesBg: "#EFF6FF",
  ckdColor: "#0D9488",
  ckdBg: "#F0FDFA",
  heartColor: "#DC2626",
  heartBg: "#FEF2F2",
  celiacColor: "#D97706",
  celiacBg: "#FFFBEB",
  allergyColor: "#7C3AED",
  allergyBg: "#F5F3FF",

  // ─── Neutral Scale ───────────────────────────────────────────────────────────
  gray1: "#F1F5F9",
  gray2: "#E2E8F0",
  gray3: "#CBD5E1",
  gray4: "#94A3B8",
  gray5: "#64748B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

// ─── Typography Scale ─────────────────────────────────────────────────────────
// Fixed scale. Never introduce a new fontSize — pick the nearest tier.
// Every screen has ONE display element; everything else steps down.
export const typography = {
  // Page title (one per screen: "Can I eat this?", "History", "Account", "Scan Food")
  display: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  // Hero content titles: food name in result card, auth screen headings, app wordmark
  heading: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  // Modal/sheet titles, empty-state titles, prominent section heads
  subheading: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  // Row/card/list-item titles
  title: { fontSize: 15, fontWeight: "700" },
  // Default reading text
  body: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  // Supporting copy under a body line
  bodySmall: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  // Metadata: timestamps, hints, quiet labels
  caption: { fontSize: 12, fontWeight: "500" },
  // Badges, chips, tiny uppercase section labels
  micro: { fontSize: 11, fontWeight: "600" },
} as const;

/** Uppercase section label used to open grouped sections (e.g. "PRIVACY & DATA"). */
export const sectionLabel = {
  fontSize: typography.caption.fontSize,
  fontWeight: "700",
  color: colors.slateLight,
  textTransform: "uppercase",
  letterSpacing: 0.5,
} as const;

// ─── Control Heights ──────────────────────────────────────────────────────────
// All interactive controls snap to one of these heights.
export const controlHeight = {
  sm: 40,
  md: 48,
  lg: 52,
};

// ─── Shadows (restrained) ─────────────────────────────────────────────────────
// The only sanctioned shadow. Use for floating/active elements only — never on
// static cards (they are separated by borders, not shadows).
export const shadow = {
  subtle: Platform.select({
    ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    android: { elevation: 1 },
    default: {},
  }),
};

// ─── Status Helpers ────────────────────────────────────────────────────────────
export function getStatusColors(status: "safe" | "moderation" | "not_recommended") {
  switch (status) {
    case "safe":
      return { text: colors.safeText, bg: colors.safeBg, border: colors.safeBorder, icon: colors.safeIcon };
    case "moderation":
      return { text: colors.moderationText, bg: colors.moderationBg, border: colors.moderationBorder, icon: colors.moderationIcon };
    case "not_recommended":
      return { text: colors.dangerText, bg: colors.dangerBg, border: colors.dangerBorder, icon: colors.dangerIcon };
  }
}

export function getConditionColor(conditionId: string): { accent: string; bg: string } {
  switch (conditionId) {
    case "diabetes":
      return { accent: colors.diabetesColor, bg: colors.diabetesBg };
    case "ckd":
      return { accent: colors.ckdColor, bg: colors.ckdBg };
    case "hypertension":
      return { accent: colors.heartColor, bg: colors.heartBg };
    case "celiac":
      return { accent: colors.celiacColor, bg: colors.celiacBg };
    case "allergy":
      return { accent: colors.allergyColor, bg: colors.allergyBg };
    default:
      return { accent: colors.primary, bg: colors.primaryMuted };
  }
}
