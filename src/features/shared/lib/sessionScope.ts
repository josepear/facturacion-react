import type { SessionResponse } from "@/domain/session/types";

type TemplateProfileLike = { id: string };

export type SessionScope = {
  role: string;
  tenantId: string;
  isAdmin: boolean;
  visibleTemplateProfileIds: string[];
  hasEmitterScope: boolean;
  allowsAllEmitters: boolean;
};

export function resolveSessionScope(
  session: SessionResponse | undefined,
  templateProfiles: readonly TemplateProfileLike[],
): SessionScope {
  const role = session?.authenticated ? String(session.user.role || "").trim().toLowerCase() : "";
  const tenantId = session?.authenticated ? String(session.user.tenantId || "").trim() : "";
  const isAdmin = role === "admin";
  const allProfileIds = templateProfiles.map((profile) => String(profile.id || "").trim()).filter(Boolean);
  if (isAdmin) {
    return {
      role,
      tenantId,
      isAdmin: true,
      visibleTemplateProfileIds: allProfileIds,
      hasEmitterScope: allProfileIds.length > 0,
      allowsAllEmitters: true,
    };
  }

  const allowedRaw =
    session?.authenticated && Array.isArray(session.user.allowedTemplateProfileIds)
      ? session.user.allowedTemplateProfileIds
      : [];
  const allowedIds = allowedRaw.map((id) => String(id || "").trim()).filter(Boolean);
  const allowsAllEmitters = allowedIds.length === 0;
  const allowedSet = new Set(allowedIds);
  const visibleTemplateProfileIds = allowsAllEmitters
    ? allProfileIds
    : allProfileIds.filter((id) => allowedSet.has(id));

  return {
    role,
    tenantId,
    isAdmin: false,
    visibleTemplateProfileIds,
    hasEmitterScope: visibleTemplateProfileIds.length > 0,
    allowsAllEmitters,
  };
}

export function isTemplateProfileInScope(templateProfileId: string, scope: SessionScope): boolean {
  const safeId = String(templateProfileId || "").trim();
  if (!safeId) {
    return true;
  }
  return scope.allowsAllEmitters || scope.visibleTemplateProfileIds.includes(safeId);
}
