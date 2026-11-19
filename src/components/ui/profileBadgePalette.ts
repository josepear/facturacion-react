export const PROFILE_BADGE_TEAL = { backgroundColor: "rgba(0,122,120,0.14)", color: "#0a6967" } as const;

export const PROFILE_BADGE_PALETTE: Record<string, { backgroundColor: string; color: string }> = {
  teal: PROFILE_BADGE_TEAL,
  pink: { backgroundColor: "rgba(236,30,99,0.12)", color: "#b0174c" },
  amber: { backgroundColor: "rgba(244,164,58,0.18)", color: "#8c4c00" },
  violet: { backgroundColor: "rgba(123,97,255,0.14)", color: "#5b44d1" },
  lime: { backgroundColor: "rgba(120,185,47,0.18)", color: "#4c7b00" },
  blue: { backgroundColor: "rgba(52,126,246,0.14)", color: "#1959c7" },
  coral: { backgroundColor: "rgba(237,108,77,0.16)", color: "#a73f22" },
};

/** Color de acento (texto del badge) para franjas / previews alineadas con legacy. */
export function getProfileAccentColor(colorKey?: string): string {
  const key = String(colorKey ?? "").trim().toLowerCase();
  return (PROFILE_BADGE_PALETTE[key] ?? PROFILE_BADGE_TEAL).color;
}

export function getProfileBadgePalette(colorKey?: string) {
  const key = String(colorKey ?? "").trim().toLowerCase();
  return PROFILE_BADGE_PALETTE[key] ?? PROFILE_BADGE_TEAL;
}
