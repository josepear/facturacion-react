const PROFILE_BADGE_PALETTE: Record<string, { backgroundColor: string; color: string }> = {
  teal: { backgroundColor: "rgba(0,122,120,0.14)", color: "#0a6967" },
  pink: { backgroundColor: "rgba(236,30,99,0.12)", color: "#b0174c" },
  amber: { backgroundColor: "rgba(244,164,58,0.18)", color: "#8c4c00" },
  violet: { backgroundColor: "rgba(123,97,255,0.14)", color: "#5b44d1" },
  lime: { backgroundColor: "rgba(120,185,47,0.18)", color: "#4c7b00" },
  blue: { backgroundColor: "rgba(52,126,246,0.14)", color: "#1959c7" },
  coral: { backgroundColor: "rgba(237,108,77,0.16)", color: "#a73f22" },
};

const TEAL = PROFILE_BADGE_PALETTE.teal;

export function ProfileBadge({ label, colorKey }: { label: string; colorKey?: string }) {
  const key = String(colorKey ?? "").trim().toLowerCase();
  const palette = PROFILE_BADGE_PALETTE[key] ?? TEAL;
  return (
    <span
      style={{
        ...palette,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: "0.78rem",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
