import { getProfileBadgePalette } from "@/components/ui/profileBadgePalette";

export function ProfileBadge({
  label,
  colorKey,
  showLeadingDot = true,
}: {
  label: string;
  colorKey?: string;
  /** Punto de acento del emisor (misma paleta que el badge). */
  showLeadingDot?: boolean;
}) {
  const palette = getProfileBadgePalette(colorKey);
  const dotColor = palette.color;
  return (
    <span
      className="inline-flex max-w-full items-center align-middle"
      style={{
        ...palette,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: "0.78rem",
        fontWeight: 500,
      }}
    >
      {showLeadingDot ? (
        <span
          aria-hidden
          className="mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
