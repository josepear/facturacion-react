export type TemplateProfileOption = { id: string; label?: string; colorKey?: string };

export function colorKeyForTemplateProfile(
  profiles: TemplateProfileOption[],
  templateProfileId: string | undefined,
): string | undefined {
  const id = String(templateProfileId || "").trim();
  if (!id) {
    return undefined;
  }
  return profiles.find((p) => p.id === id)?.colorKey;
}
