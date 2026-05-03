import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateProfileConfig } from "@/domain/document/types";
import { fetchExpenseOptions, saveExpenseOptions } from "@/infrastructure/api/expensesApi";
import {
  fetchFontsCatalog,
  fetchRuntimeConfig,
  propagateTemplateProfile,
  saveTemplateProfilesConfig,
} from "@/infrastructure/api/documentsApi";
import { fetchGmailOAuthStartUrl, fetchGmailProfiles, type GmailProfileItem } from "@/infrastructure/api/gmailApi";
import { openGmailOAuthPopupAndWait } from "@/infrastructure/gmail/oauthPopup";
import { fetchHistoryInvoices } from "@/infrastructure/api/historyApi";
import { ApiError, getErrorMessageFromUnknown } from "@/infrastructure/api/httpClient";
import { deleteTrashEntries, emptyTrash, fetchTrash, type TrashItem } from "@/infrastructure/api/trashApi";
import { type SystemUser, type UpsertUserInput, deleteSystemUser, fetchSystemUsers, upsertSystemUser } from "@/infrastructure/api/usersApi";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { toNumber } from "@/lib/utils";

/** Misma secuencia que legacy `PROFILE_COLOR_SEQUENCE` en `public/app.js`. */
const PROFILE_COLOR_KEYS = ["teal", "pink", "amber", "violet", "lime", "blue", "coral"] as const;

/** Mismas etiquetas que legacy `PROFILE_COLOR_LABELS`. */
const PROFILE_COLOR_LABELS: Record<(typeof PROFILE_COLOR_KEYS)[number], string> = {
  teal: "Turquesa",
  pink: "Rosa",
  amber: "Ámbar",
  violet: "Violeta",
  lime: "Lima",
  blue: "Azul",
  coral: "Coral",
};

const LAYOUT_OPTIONS = [
  { value: "pear", label: "Pear&co. clásica" },
  { value: "editorial", label: "Editorial / Nacho" },
  { value: "voulita", label: "Eventos / La Jaulita" },
] as const;

function buildClientProfileId(label: string, usedIds: Set<string>): string {
  const baseText =
    String(label || "perfil")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "perfil";
  let nextId = baseText;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseText}-${suffix}`;
    suffix += 1;
  }
  return nextId;
}

/** Prefijo de numeración único (3–5 letras), alineado con validación legacy del servidor. */
function suggestUniqueInvoiceNumberTag(newProfileId: string, existingProfiles: TemplateProfileConfig[]): string {
  const taken = new Set(
    existingProfiles.map((p) => String(p.invoiceNumberTag || "").trim().toUpperCase()).filter(Boolean),
  );
  const lettersOnly = newProfileId.replace(/[^A-Za-z]/g, "").toUpperCase();
  let base = lettersOnly.length >= 3 ? lettersOnly.slice(0, 5) : `${lettersOnly}NEW`.replace(/[^A-Z]/g, "").slice(0, 5);
  if (base.length < 3) {
    base = "USR";
  }
  base = base.slice(0, 5);
  for (let len = Math.min(5, base.length); len >= 3; len -= 1) {
    const candidate = base.slice(0, len);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  const alphabet = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 26 * 26 * 8; i += 1) {
    const a = alphabet[i % 26] ?? "X";
    const b = alphabet[Math.floor(i / 26) % 26] ?? "X";
    const candidate = `${base.slice(0, 3)}${a}${b}`.slice(0, 5);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${base.slice(0, 2)}ZZZ`.slice(0, 5);
}

/** Igual que legacy `getNextProfileColorKey()` (menos usado primero). */
function getNextProfileColorKey(list: TemplateProfileConfig[]): (typeof PROFILE_COLOR_KEYS)[number] {
  const counts = new Map<(typeof PROFILE_COLOR_KEYS)[number], number>(PROFILE_COLOR_KEYS.map((k) => [k, 0]));
  list.forEach((profile, index) => {
    const raw = String(profile.colorKey || "").trim().toLowerCase();
    const key: (typeof PROFILE_COLOR_KEYS)[number] = PROFILE_COLOR_KEYS.includes(raw as (typeof PROFILE_COLOR_KEYS)[number])
      ? (raw as (typeof PROFILE_COLOR_KEYS)[number])
      : (PROFILE_COLOR_KEYS[index % PROFILE_COLOR_KEYS.length] || PROFILE_COLOR_KEYS[0]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
  return (sorted[0]?.[0] as (typeof PROFILE_COLOR_KEYS)[number]) || PROFILE_COLOR_KEYS[0];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Solo lectura" },
];

const EMPTY_USER_FORM: UpsertUserInput = {
  email: "",
  name: "",
  password: "",
  role: "editor",
  allowedTemplateProfileIds: [],
};

function MembersSection({
  canEdit,
  profiles,
  currentUserId,
}: {
  canEdit: boolean;
  profiles: TemplateProfileConfig[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["system-users"],
    queryFn: fetchSystemUsers,
  });

  const [editingUser, setEditingUser] = useState<(UpsertUserInput & { isNew: boolean }) | null>(null);
  const [memberStatus, setMemberStatus] = useState("");
  const [memberStatusTone, setMemberStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  const upsertMutation = useMutation({
    mutationFn: (user: UpsertUserInput) => upsertSystemUser(user),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-users"] });
      setEditingUser(null);
      setMemberStatus("Miembro guardado.");
      setMemberStatusTone("success");
    },
    onError: (error) => {
      setMemberStatus((error as Error).message || "No se pudo guardar el miembro.");
      setMemberStatusTone("error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSystemUser(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-users"] });
      setMemberStatus("Miembro eliminado.");
      setMemberStatusTone("success");
    },
    onError: (error) => {
      setMemberStatus((error as Error).message || "No se pudo eliminar el miembro.");
      setMemberStatusTone("error");
    },
  });

  const handleDelete = (user: SystemUser) => {
    if (!window.confirm(`¿Eliminar al miembro «${user.name || user.email}»? Esta acción no se puede deshacer.`)) {
      return;
    }
    deleteMutation.mutate(user.id);
  };

  const handleEdit = (user: SystemUser) => {
    setEditingUser({
      isNew: false,
      id: user.id,
      email: user.email,
      name: user.name,
      password: "",
      role: user.role || "editor",
      allowedTemplateProfileIds: user.allowedTemplateProfileIds ?? [],
    });
    setMemberStatus("");
  };

  const handleNew = () => {
    setEditingUser({ isNew: true, ...EMPTY_USER_FORM });
    setMemberStatus("");
  };

  const toggleAllowedProfile = (profileId: string) => {
    if (!editingUser) {
      return;
    }
    const current = editingUser.allowedTemplateProfileIds;
    const next = current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId];
    setEditingUser({ ...editingUser, allowedTemplateProfileIds: next });
  };

  const handleSubmit = () => {
    if (!editingUser) {
      return;
    }
    const { isNew, ...payload } = editingUser;
    if (!payload.email.trim()) {
      setMemberStatus("El email es obligatorio.");
      setMemberStatusTone("error");
      return;
    }
    if (isNew && !payload.password?.trim()) {
      setMemberStatus("La contraseña es obligatoria para miembros nuevos.");
      setMemberStatusTone("error");
      return;
    }
    const toSend: UpsertUserInput = {
      ...payload,
      password: payload.password?.trim() || undefined,
    };
    upsertMutation.mutate(toSend);
  };

  const items = usersQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros del sistema</CardTitle>
        <CardDescription>
          Usuarios con acceso a la aplicación. Solo visible para administradores.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando miembros...</p>
        ) : usersQuery.isError ? (
          <p className="text-sm text-red-600">{(usersQuery.error as Error)?.message || "No se pudo cargar la lista de miembros."}</p>
        ) : (
          <div className="grid gap-2">
            {items.map((user) => {
              const isEditing = editingUser !== null && !editingUser.isNew && editingUser.id === user.id;
              return (
                <div key={user.id} className="grid gap-0">
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.name || user.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email} · {user.role}</p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant={isEditing ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => isEditing ? setEditingUser(null) : handleEdit(user)}
                        >
                          {isEditing ? "Cerrar" : "Editar"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={user.id === currentUserId}
                          onClick={() => handleDelete(user)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing && editingUser && (
                    <div className="grid gap-3 rounded-b-md border border-t-0 border-dashed px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Email">
                          <Input
                            type="email"
                            value={editingUser.email}
                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                            autoComplete="off"
                          />
                        </Field>
                        <Field label="Nombre">
                          <Input
                            value={editingUser.name}
                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          />
                        </Field>
                        <Field label="Nueva contraseña (vacío = sin cambio)">
                          <Input
                            type="password"
                            value={editingUser.password ?? ""}
                            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                            autoComplete="new-password"
                          />
                        </Field>
                        <Field label="Rol">
                          <select
                            aria-label="Rol del miembro"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      {profiles.length > 0 && (
                        <Field label="Perfiles permitidos (vacío = todos)">
                          <div className="flex flex-wrap gap-2 pt-1">
                            {profiles.map((profile) => {
                              const checked = editingUser.allowedTemplateProfileIds.includes(profile.id);
                              return (
                                <label key={profile.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAllowedProfile(profile.id)}
                                    className="h-4 w-4 rounded border-input"
                                  />
                                  <ProfileBadge label={profile.label || profile.id} colorKey={profile.colorKey} />
                                </label>
                              );
                            })}
                          </div>
                        </Field>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" onClick={handleSubmit} disabled={upsertMutation.isPending}>
                          {upsertMutation.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay miembros registrados.</p>
            )}
          </div>
        )}

        {canEdit && !editingUser && (
          <Button type="button" variant="outline" onClick={handleNew} className="self-start">
            Nuevo miembro
          </Button>
        )}

        {editingUser?.isNew && (
          <div className="grid gap-3 rounded-md border border-dashed p-4">
            <p className="text-sm font-medium">Nuevo miembro</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field label="Nombre">
                <Input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </Field>
              <Field label="Contraseña">
                <Input
                  type="password"
                  value={editingUser.password ?? ""}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Rol">
                <select
                  aria-label="Rol del miembro"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {profiles.length > 0 && (
              <Field label="Perfiles permitidos (vacío = todos)">
                <div className="flex flex-wrap gap-2 pt-1">
                  {profiles.map((profile) => {
                    const checked = editingUser.allowedTemplateProfileIds.includes(profile.id);
                    return (
                      <label key={profile.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAllowedProfile(profile.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <ProfileBadge label={profile.label || profile.id} colorKey={profile.colorKey} />
                      </label>
                    );
                  })}
                </div>
              </Field>
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSubmit} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Guardando..." : "Guardar miembro"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {memberStatus && (
          <p className={`text-sm ${memberStatusTone === "error" ? "text-red-600" : memberStatusTone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
            {memberStatus}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseOptionsSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const optionsQuery = useQuery({
    queryKey: ["expense-options"],
    queryFn: fetchExpenseOptions,
  });
  const [vendorsDraft, setVendorsDraft] = useState<string | null>(null);
  const [categoriesDraft, setCategoriesDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" | "neutral" } | null>(null);

  const serverVendors = (optionsQuery.data?.vendors ?? []).join("\n");
  const serverCategories = (optionsQuery.data?.categories ?? []).join("\n");

  const toList = (raw: string) =>
    raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveExpenseOptions({
        vendors: toList(vendorsDraft ?? serverVendors),
        categories: toList(categoriesDraft ?? serverCategories),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["expense-options"] });
      setVendorsDraft(null);
      setCategoriesDraft(null);
      setStatus({ text: `Guardado: ${(data.vendors ?? []).length} proveedores, ${(data.categories ?? []).length} categorías.`, tone: "success" });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err);
      setStatus({ text: `Error al guardar: ${msg}`, tone: "error" });
    },
  });

  const hasPendingChanges = vendorsDraft !== null || categoriesDraft !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de gastos</CardTitle>
        <CardDescription>
          Proveedores y categorías disponibles en el formulario de gastos.{" "}
          {canEdit ? "Solo administradores." : "Solo lectura."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {optionsQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando catálogo...</p>}
        {optionsQuery.isError && (
          <p className="text-sm text-red-600">No se pudo cargar el catálogo de gastos.</p>
        )}
        {optionsQuery.isSuccess && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Proveedores ({toList(vendorsDraft ?? serverVendors).length})
                </label>
                <textarea
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  readOnly={!canEdit}
                  value={vendorsDraft ?? serverVendors}
                  onChange={(e) => setVendorsDraft(e.target.value)}
                  aria-label="Lista de proveedores, uno por línea"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Categorías ({toList(categoriesDraft ?? serverCategories).length})
                </label>
                <textarea
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  readOnly={!canEdit}
                  value={categoriesDraft ?? serverCategories}
                  onChange={(e) => setCategoriesDraft(e.target.value)}
                  aria-label="Lista de categorías, uno por línea"
                />
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  disabled={!hasPendingChanges || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Guardando..." : "Guardar catálogo"}
                </Button>
                {hasPendingChanges && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setVendorsDraft(null); setCategoriesDraft(null); setStatus(null); }}
                  >
                    Descartar cambios
                  </Button>
                )}
                {status && (
                  <p className={`text-sm ${status.tone === "error" ? "text-red-600" : status.tone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {status.text}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrashSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const trashQuery = useQuery({
    queryKey: ["trash"],
    queryFn: fetchTrash,
    enabled: canEdit,
  });
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [status, setStatus] = useState<{ text: string; tone: "success" | "error" | "neutral" } | null>(null);

  const items = trashQuery.data?.items ?? [];
  const summary = trashQuery.data?.summary ?? {
    total: 0,
    totalGroups: 0,
    byCategory: {},
    byFileType: {},
  };

  useEffect(() => {
    if (!items.length) {
      setSelectedPaths([]);
      return;
    }
    const available = new Set(items.map((item) => item.path));
    setSelectedPaths((prev) => prev.filter((path) => available.has(path)));
  }, [items]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, TrashItem[]> = {
      documentos: [],
      gastos: [],
      clientes: [],
      otros: [],
    };
    items.forEach((item) => {
      groups[item.category] = [...(groups[item.category] ?? []), item];
    });
    return groups;
  }, [items]);

  const emptyMutation = useMutation({
    mutationFn: emptyTrash,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setSelectedPaths([]);
      setStatus({
        text: `Papelera vaciada. Elementos eliminados: ${Number(data.removedEntries ?? 0)}.`,
        tone: "success",
      });
    },
    onError: (error) => {
      setStatus({ text: `Error al vaciar: ${getErrorMessageFromUnknown(error)}`, tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paths: string[]) => deleteTrashEntries(paths),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      setSelectedPaths([]);
      setStatus({ text: "Elementos seleccionados borrados.", tone: "success" });
    },
    onError: (error) => {
      setStatus({ text: `Error al borrar: ${getErrorMessageFromUnknown(error)}`, tone: "error" });
    },
  });

  if (!canEdit) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Papelera</CardTitle>
        <CardDescription>Gestión de archivos archivados. Solo administradores.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {trashQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando papelera...</p>
        ) : trashQuery.isError ? (
          <p className="text-sm text-red-600">{getErrorMessageFromUnknown(trashQuery.error)}</p>
        ) : (
          <>
            <div className="grid gap-1 rounded-md border p-3 text-sm">
              <p><strong>Total:</strong> {summary.total}</p>
              <p><strong>Documentos:</strong> {Number(summary.byCategory.documentos ?? 0)}</p>
              <p><strong>Gastos:</strong> {Number(summary.byCategory.gastos ?? 0)}</p>
              <p><strong>Clientes:</strong> {Number(summary.byCategory.clientes ?? 0)}</p>
              <p><strong>Otros:</strong> {Number(summary.byCategory.otros ?? 0)}</p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
            ) : (
              <div className="grid gap-3">
                {(["documentos", "gastos", "clientes", "otros"] as const).map((category) => {
                  const categoryItems = groupedItems[category] ?? [];
                  if (categoryItems.length === 0) {
                    return null;
                  }
                  return (
                    <div key={category} className="grid gap-2 rounded-md border p-3">
                      <p className="text-sm font-medium capitalize">{category}</p>
                      <ul className="grid gap-1">
                        {categoryItems.map((item) => (
                          <li key={item.path} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-input"
                              checked={selectedPaths.includes(item.path)}
                              onChange={(event) => {
                                setSelectedPaths((prev) =>
                                  event.target.checked
                                    ? [...prev, item.path]
                                    : prev.filter((path) => path !== item.path),
                                );
                              }}
                            />
                            <span className="min-w-0 flex-1 break-all">{item.path}</span>
                            <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{item.fileType}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={emptyMutation.isPending || deleteMutation.isPending || items.length === 0}
                onClick={() => {
                  const confirmed = window.confirm("Se borrará todo el contenido de la papelera. ¿Continuar?");
                  if (!confirmed) {
                    return;
                  }
                  emptyMutation.mutate();
                }}
              >
                {emptyMutation.isPending ? "Vaciando..." : "Vaciar papelera"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={deleteMutation.isPending || emptyMutation.isPending || selectedPaths.length === 0}
                onClick={() => {
                  const confirmed = window.confirm(`Se borrarán ${selectedPaths.length} elementos seleccionados. ¿Continuar?`);
                  if (!confirmed) {
                    return;
                  }
                  deleteMutation.mutate(selectedPaths);
                }}
              >
                {deleteMutation.isPending ? "Borrando..." : "Borrar seleccionados"}
              </Button>
            </div>
          </>
        )}
        {status ? (
          <p className={`text-sm ${status.tone === "error" ? "text-red-600" : status.tone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
            {status.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function safeValue(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized || "-";
}

type ProfileDraft = {
  label: string;
  invoiceNumberTag: string;
  colorKey: string;
  paymentMethod: string;
  taxRate: number;
  withholdingRate: number;
  currency: string;
  bankAccount: string;
  bankBrand: string;
  layout: string;
  fontFamily: string;
  brand: string;
  contactName: string;
  headline: string;
  taxId: string;
  email: string;
  address: string;
  phone: string;
  website: string;
  brandImage: string;
  signatureImage: string;
};

function toProfileDraft(profile: TemplateProfileConfig | null): ProfileDraft {
  const rawColor = String(profile?.colorKey || "").trim().toLowerCase();
  const colorKey = PROFILE_COLOR_KEYS.includes(rawColor as (typeof PROFILE_COLOR_KEYS)[number]) ? rawColor : PROFILE_COLOR_KEYS[0];
  return {
    label: String(profile?.label || profile?.id || "").trim(),
    invoiceNumberTag: String(profile?.invoiceNumberTag || "").trim(),
    colorKey,
    paymentMethod:
      String(profile?.defaults?.paymentMethod || "").trim() || "Transferencia bancaria",
    taxRate: toNumber(profile?.defaults?.taxRate),
    withholdingRate: toNumber(profile?.defaults?.withholdingRate),
    currency: String(profile?.defaults?.currency || "EUR").trim(),
    bankAccount: String(profile?.business?.bankAccount || "").trim(),
    bankBrand: String(profile?.business?.bankBrand || "").trim(),
    layout: String(profile?.design?.layout || "").trim(),
    fontFamily: String(profile?.design?.fontFamily || "").trim(),
    brand: String(profile?.business?.brand || "").trim(),
    contactName: String(profile?.business?.contactName || "").trim(),
    headline: String(profile?.business?.headline || "").trim(),
    taxId: String(profile?.business?.taxId || "").trim(),
    email: String(profile?.business?.email || "").trim(),
    address: String(profile?.business?.address || "").trim(),
    phone: String(profile?.business?.phone || "").trim(),
    website: String(profile?.business?.website || "").trim(),
    brandImage: String(profile?.business?.brandImage || "").trim(),
    signatureImage: String(profile?.business?.signatureImage || "").trim(),
  };
}

function SettingsConfigLoadError({ error }: { error: unknown }) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return (
      <div role="alert" className="space-y-2">
        <p className="font-medium text-red-600">No se pudo cargar la configuración (HTTP {error.status})</p>
        <p className="text-muted-foreground">
          Una petición a <code className="text-xs">GET /api/config</code> o <code className="text-xs">GET /api/session</code>{" "}
          fue rechazada: <span className="text-foreground">{error.message}</span>. Suele indicar sesión caducada, ausencia de
          token en este origen o credenciales no aceptadas por el servidor.
        </p>
        <p className="text-muted-foreground">
          Esto no es el modo solo lectura por rol: si la configuración cargara y tu rol en{" "}
          <code className="text-xs">GET /api/session</code> no fuera <code className="text-xs">admin</code>, verías el
          formulario con campos deshabilitados y el aviso «Modo solo lectura».
        </p>
      </div>
    );
  }
  return (
    <p role="alert" className="text-red-600">
      {(error as Error)?.message || "No se pudo leer la configuración."}
    </p>
  );
}

function mergeProfileWithDraft(profile: TemplateProfileConfig, draft: ProfileDraft): TemplateProfileConfig {
  const tag = draft.invoiceNumberTag.trim().toUpperCase();
  const color = draft.colorKey.trim().toLowerCase();
  return {
    ...profile,
    label: draft.label || profile.id,
    invoiceNumberTag: tag || undefined,
    colorKey: PROFILE_COLOR_KEYS.includes(color as (typeof PROFILE_COLOR_KEYS)[number]) ? color : PROFILE_COLOR_KEYS[0],
    defaults: {
      ...(profile.defaults || {}),
      paymentMethod: draft.paymentMethod,
      taxRate: draft.taxRate,
      withholdingRate: draft.withholdingRate,
      currency: draft.currency.trim() || undefined,
    },
    business: {
      ...(profile.business || {}),
      bankAccount: draft.bankAccount,
      bankBrand: draft.bankBrand.trim() || undefined,
      brand: draft.brand,
      contactName: draft.contactName.trim() || undefined,
      headline: draft.headline.trim() || undefined,
      taxId: draft.taxId,
      email: draft.email,
      address: draft.address,
      phone: draft.phone,
      website: draft.website,
      brandImage: draft.brandImage.trim() || undefined,
      signatureImage: draft.signatureImage.trim() || undefined,
    },
    design: (() => {
      const next: NonNullable<TemplateProfileConfig["design"]> = {
        ...(profile.design || {}),
        layout: draft.layout.trim() || profile.design?.layout,
      };
      const ff = String(draft.fontFamily ?? "").trim();
      if (ff) {
        next.fontFamily = ff;
      } else {
        delete next.fontFamily;
      }
      return next;
    })(),
  };
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["runtime-config"],
    queryFn: fetchRuntimeConfig,
  });
  const fontsCatalogQuery = useQuery({
    queryKey: ["fonts-catalog"],
    queryFn: fetchFontsCatalog,
    staleTime: 3_600_000,
  });
  const fontFamilies: string[] = fontsCatalogQuery.data?.families ?? [];
  const sessionQuery = useSessionQuery();
  const [activeProfileIdDraft, setActiveProfileIdDraft] = useState("");
  const [editingProfileId, setEditingProfileId] = useState("");
  const [draftByProfileId, setDraftByProfileId] = useState<Record<string, ProfileDraft>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [profileListOverride, setProfileListOverride] = useState<TemplateProfileConfig[] | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileLabelDraft, setNewProfileLabelDraft] = useState("");
  const [newProfileSourceId, setNewProfileSourceId] = useState("");
  const brandImageFileInputRef = useRef<HTMLInputElement>(null);
  const [brandImageFileError, setBrandImageFileError] = useState("");
  const [invoiceTagSuggestions, setInvoiceTagSuggestions] = useState<string[]>([]);
  const newBaseDialogRef = useRef<HTMLDialogElement>(null);
  const [newBaseOpen, setNewBaseOpen] = useState(false);
  const [newBaseLabel, setNewBaseLabel] = useState("");
  const [newBaseLayout, setNewBaseLayout] = useState<(typeof LAYOUT_OPTIONS)[number]["value"]>("pear");
  const [gmailOAuthSectionError, setGmailOAuthSectionError] = useState("");

  const serverProfiles = useMemo(
    () => configQuery.data?.templateProfiles ?? [],
    [configQuery.data?.templateProfiles],
  );
  const profiles = profileListOverride ?? serverProfiles;
  const urlTemplateProfileId = String(searchParams.get("templateProfileId") || "").trim();
  const sessionRole = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role || "").trim().toLowerCase()
    : "";
  const sessionReady = !sessionQuery.isLoading && !sessionQuery.error;
  const canEdit = sessionReady && sessionRole === "admin";
  const isAdmin = canEdit;
  const configuredRoleLabel = sessionQuery.data?.authenticated
    ? String(sessionQuery.data.user.role ?? "").trim()
    : "";

  const gmailProfilesQuery = useQuery({
    queryKey: ["gmail-profiles"],
    queryFn: fetchGmailProfiles,
    staleTime: 60_000,
  });

  const serverActiveProfileId = String(configQuery.data?.activeTemplateProfileId || "").trim();
  const effectiveActiveProfileId = activeProfileIdDraft || serverActiveProfileId;

  const effectiveEditingProfileId = useMemo(() => {
    const selected = String(editingProfileId || "").trim();
    if (selected) {
      return selected;
    }
    if (effectiveActiveProfileId) {
      return effectiveActiveProfileId;
    }
    return String(profiles[0]?.id || "").trim();
  }, [editingProfileId, effectiveActiveProfileId, profiles]);

  /** Perfil marcado como activo en el último JSON de servidor (no incluye borradores locales). */
  const serverActiveProfile = useMemo(() => {
    const id = String(serverActiveProfileId || "").trim();
    if (!id) {
      return null;
    }
    return serverProfiles.find((profile) => profile.id === id) || null;
  }, [serverActiveProfileId, serverProfiles]);

  const historyForSummaryQuery = useQuery({
    queryKey: ["history-invoices"],
    queryFn: fetchHistoryInvoices,
    staleTime: 120_000,
    enabled: Boolean(serverActiveProfileId),
  });

  const activeProfileStats = useMemo(() => {
    const items = historyForSummaryQuery.data ?? [];
    const forProfile = items.filter((i) => i.templateProfileId === serverActiveProfileId && i.type === "factura");
    const total = forProfile.reduce((s, i) => s + Number(i.total || 0), 0);
    const lastIssueDate = forProfile.map((i) => String(i.issueDate || "")).sort().reverse()[0] ?? "";
    return { count: forProfile.length, total, lastIssueDate };
  }, [historyForSummaryQuery.data, serverActiveProfileId]);

  const activeProfileForNextSave = useMemo(() => {
    if (!effectiveActiveProfileId) {
      return null;
    }
    return profiles.find((profile) => profile.id === effectiveActiveProfileId) || null;
  }, [effectiveActiveProfileId, profiles]);

  const hasUnsavedLocalChanges = Boolean(
    profileListOverride !== null
    || Object.keys(draftByProfileId).length > 0
    || String(serverActiveProfileId || "").trim() !== String(effectiveActiveProfileId || "").trim(),
  );

  useEffect(() => {
    if (configQuery.isLoading || !configQuery.data || !urlTemplateProfileId) {
      return;
    }
    /** Incluye `profileListOverride` (perfiles solo en memoria), no solo el último JSON del servidor. */
    if (!profiles.some((p) => p.id === urlTemplateProfileId)) {
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setActiveProfileIdDraft(urlTemplateProfileId);
      setEditingProfileId(urlTemplateProfileId);
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [configQuery.data, configQuery.isLoading, urlTemplateProfileId, profiles]);

  const editingProfile = useMemo(() => {
    if (!effectiveEditingProfileId) {
      return null;
    }
    return profiles.find((profile) => profile.id === effectiveEditingProfileId) || null;
  }, [effectiveEditingProfileId, profiles]);

  const editingDraft = useMemo(() => {
    if (!effectiveEditingProfileId) {
      return toProfileDraft(null);
    }
    return draftByProfileId[effectiveEditingProfileId] ?? toProfileDraft(editingProfile);
  }, [draftByProfileId, editingProfile, effectiveEditingProfileId]);

  const brandImageSummary = useMemo(() => {
    const bi = String(editingDraft.brandImage || "").trim();
    if (bi.startsWith("data:")) {
      return "Logo embebido en el perfil (base64)";
    }
    if (bi.startsWith("/") || bi.startsWith("http")) {
      return bi;
    }
    return "Sin logo";
  }, [editingDraft.brandImage]);

  useEffect(() => {
    setBrandImageFileError("");
    if (brandImageFileInputRef.current) {
      brandImageFileInputRef.current.value = "";
    }
  }, [effectiveEditingProfileId]);

  useEffect(() => {
    const el = newBaseDialogRef.current;
    if (!el) {
      return;
    }
    if (newBaseOpen) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [newBaseOpen]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const safeActiveProfileId = String(effectiveActiveProfileId || "").trim();
      if (!safeActiveProfileId) {
        throw new Error("Selecciona un perfil activo.");
      }
      if (!profiles.length) {
        throw new Error("No hay perfiles disponibles para guardar.");
      }
      const nextProfiles = profiles.map((profile) =>
        profile.id === effectiveEditingProfileId
          ? mergeProfileWithDraft(profile, editingDraft)
          : profile,
      );

      return saveTemplateProfilesConfig({
        activeTemplateProfileId: safeActiveProfileId,
        templateProfiles: nextProfiles,
      });
    },
    onSuccess: async (savedConfig) => {
      queryClient.setQueryData(["runtime-config"], savedConfig);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runtime-config"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      ]);
      setDraftByProfileId({});
      setActiveProfileIdDraft("");
      setProfileListOverride(null);
      const savedActiveId = String(savedConfig.activeTemplateProfileId || "").trim();
      if (savedActiveId) {
        const next = new URLSearchParams(searchParams);
        next.set("templateProfileId", savedActiveId);
        if (next.toString() !== searchParams.toString()) {
          setSearchParams(next, { replace: true });
        }
      }
      setStatusMessage("Datos del emisor guardados.");
      setStatusTone("success");
      setInvoiceTagSuggestions([]);
    },
    onError: (error) => {
      setStatusMessage(getErrorMessageFromUnknown(error));
      setStatusTone("error");
      if (error instanceof ApiError && error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
        const raw = (error.payload as Record<string, unknown>).suggestions;
        setInvoiceTagSuggestions(Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : []);
      } else {
        setInvoiceTagSuggestions([]);
      }
    },
  });

  const propagateMutation = useMutation({
    mutationFn: (templateProfileId: string) => propagateTemplateProfile(templateProfileId),
    onSuccess: (result) => {
      const label = result.templateProfileLabel ? ` (${result.templateProfileLabel})` : "";
      setStatusMessage(
        `Diseño propagado${label}: ${result.updated} documento${result.updated === 1 ? "" : "s"} actualizados, ${result.skipped} sin cambios.`,
      );
      setStatusTone("success");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : String(err);
      setStatusMessage(`Error al propagar: ${msg}`);
      setStatusTone("error");
    },
  });

  const updateDraft = (patch: Partial<ProfileDraft>) => {
    if (!effectiveEditingProfileId) {
      return;
    }
    setDraftByProfileId((prev) => ({
      ...prev,
      [effectiveEditingProfileId]: {
        ...editingDraft,
        ...patch,
      },
    }));
  };

  const handleBrandImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setBrandImageFileError("El logo tiene que ser un SVG o una imagen válida.");
      event.target.value = "";
      return;
    }
    setBrandImageFileError("");
    const profileId = String(effectiveEditingProfileId || "").trim();
    if (!profileId) {
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return;
      }
      setDraftByProfileId((prev) => {
        const current = prev[profileId];
        if (!current) {
          return prev;
        }
        return { ...prev, [profileId]: { ...current, brandImage: dataUrl } };
      });
    };
    reader.readAsDataURL(file);
  };

  const syncLauncherSelection = (profileId: string) => {
    const id = String(profileId || "").trim();
    if (!id) {
      return;
    }
    setActiveProfileIdDraft(id);
    setEditingProfileId(id);
    const next = new URLSearchParams(searchParams);
    next.set("templateProfileId", id);
    setSearchParams(next, { replace: true });
  };

  const startNewTemplateProfile = () => {
    if (!canEdit) {
      return;
    }
    const source =
      profiles.find((p) => p.id === effectiveActiveProfileId) || profiles.find((p) => p.id === effectiveEditingProfileId) || profiles[0];
    if (!source) {
      return;
    }
    const suggestedLabel = `${String(source.label || source.id || "Perfil").trim()} copia`;
    setNewProfileSourceId(source.id);
    setNewProfileLabelDraft(suggestedLabel);
    setIsCreatingProfile(true);
    setStatusMessage("Indica el nombre del nuevo perfil y confirma para crearlo en memoria.");
    setStatusTone("neutral");
  };

  const cancelNewTemplateProfile = () => {
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
  };

  const confirmNewTemplateProfile = () => {
    if (!canEdit) {
      return;
    }
    const sourceBase =
      profiles.find((p) => p.id === newProfileSourceId)
      || profiles.find((p) => p.id === effectiveActiveProfileId)
      || profiles.find((p) => p.id === effectiveEditingProfileId)
      || profiles[0];
    if (!sourceBase) {
      return;
    }
    /** Copiar lo que el usuario ve en el formulario del origen, no solo el objeto servidor sin borrador. */
    const sourceDraft = draftByProfileId[sourceBase.id];
    const source = sourceDraft ? mergeProfileWithDraft(sourceBase, sourceDraft) : sourceBase;
    const nextLabel = String(newProfileLabelDraft || "").trim();
    if (!nextLabel) {
      setStatusMessage("Indica un nombre para el nuevo perfil.");
      setStatusTone("error");
      return;
    }
    const used = new Set(profiles.map((p) => p.id));
    const newId = buildClientProfileId(nextLabel, used);
    const clone = JSON.parse(JSON.stringify(source)) as TemplateProfileConfig;
    const invoiceNumberTag = suggestUniqueInvoiceNumberTag(newId, profiles);
    const nextProfile: TemplateProfileConfig = {
      ...clone,
      id: newId,
      label: nextLabel,
      colorKey: getNextProfileColorKey(profiles),
      invoiceNumberTag,
    };
    const nextList = [...profiles, nextProfile];
    setProfileListOverride(nextList);
    syncLauncherSelection(newId);
    setIsCreatingProfile(false);
    setNewProfileLabelDraft("");
    setNewProfileSourceId("");
    setStatusMessage("Perfil nuevo en memoria. Pulsa «Guardar datos del emisor» para fijarlo en el servidor.");
    setStatusTone("neutral");
  };

  const confirmNewProfileFromBase = () => {
    if (!canEdit) {
      return;
    }
    const nextLabel = String(newBaseLabel || "").trim();
    if (!nextLabel) {
      setStatusMessage("Indica un nombre para el nuevo perfil.");
      setStatusTone("error");
      return;
    }
    const first = profiles[0];
    if (!first) {
      setStatusMessage("No hay perfiles de referencia en configuración.");
      setStatusTone("error");
      return;
    }
    const used = new Set(profiles.map((p) => p.id));
    const newId = buildClientProfileId(nextLabel, used);
    const nextProfile: TemplateProfileConfig = {
      id: newId,
      label: nextLabel,
      tenantId: String(first.tenantId || "default").trim() || "default",
      colorKey: getNextProfileColorKey(profiles),
      invoiceNumberTag: suggestUniqueInvoiceNumberTag(newId, profiles),
      defaults: first.defaults ? { ...first.defaults } : undefined,
      design: { layout: newBaseLayout },
      business: {},
    };
    setProfileListOverride([...profiles, nextProfile]);
    syncLauncherSelection(newId);
    setNewBaseOpen(false);
    setNewBaseLabel("");
    setNewBaseLayout("pear");
    newBaseDialogRef.current?.close();
    setStatusMessage("Perfil nuevo desde plantilla en memoria. Pulsa «Guardar datos del emisor» para fijarlo en el servidor.");
    setStatusTone("neutral");
  };

  const handleDeleteTemplateProfile = () => {
    if (!canEdit || profiles.length <= 1) {
      return;
    }
    const idToRemove = String(effectiveActiveProfileId || "").trim();
    const victim = profiles.find((p) => p.id === idToRemove);
    if (
      !window.confirm(
        `Se borrará el perfil «${victim?.label || idToRemove}». ¿Seguimos? (Igual que legacy: se elimina el perfil activo.)`,
      )
    ) {
      return;
    }
    const idx = profiles.findIndex((p) => p.id === idToRemove);
    const nextList = profiles.filter((p) => p.id !== idToRemove);
    const fallback = nextList[Math.max(0, idx - 1)] || nextList[0];
    if (!fallback) {
      return;
    }
    setProfileListOverride(nextList);
    setDraftByProfileId({});
    syncLauncherSelection(fallback.id);
    setStatusMessage("Perfil eliminado en memoria. Pulsa «Guardar datos del emisor» para fijarlo en el servidor.");
    setStatusTone("neutral");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Miembros / Emisor</h1>
        <p className="text-sm text-muted-foreground">
          Datos fiscales, logo y textos por defecto del <strong>emisor activo</strong>. Al pulsar «Guardar datos del emisor» se
          guardan en el servidor (legacy pestaña Emisor). Es independiente de «Guardar documento» en Facturar.
        </p>
      </header>

      {configQuery.isLoading || sessionQuery.isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Cargando configuración...</CardContent>
        </Card>
      ) : configQuery.error || sessionQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />
          </CardContent>
        </Card>
      ) : (
        <>
          {serverActiveProfile ? (
            <Card>
              <div className="grid gap-3 p-4">
                <div className="flex items-center gap-3">
                  <ProfileBadge
                    label={serverActiveProfile.label || serverActiveProfile.id}
                    colorKey={serverActiveProfile.colorKey}
                  />
                  <span className="text-sm font-medium text-muted-foreground">Perfil activo</span>
                </div>

                {serverActiveProfile.business?.brandImage ? (
                  <img
                    src={serverActiveProfile.business.brandImage}
                    alt="Logo del emisor"
                    style={{ maxHeight: 40, maxWidth: 120, objectFit: "contain" }}
                  />
                ) : null}

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">{activeProfileStats.count}</p>
                    <p className="text-xs text-muted-foreground">Facturas</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">
                      {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
                        activeProfileStats.total,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Facturado</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-lg font-semibold">
                      {activeProfileStats.lastIssueDate ? activeProfileStats.lastIssueDate.slice(0, 10) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Última factura</p>
                  </div>
                </div>

                {serverActiveProfile.business?.brand || serverActiveProfile.business?.taxId ? (
                  <p className="text-sm text-muted-foreground">
                    {[serverActiveProfile.business?.brand, serverActiveProfile.business?.taxId].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Perfil activo (servidor)</CardTitle>
                <CardDescription>
                  El que publica <code className="text-xs">/api/config</code> como <code className="text-xs">activeTemplateProfileId</code>{" "}
                  en el <strong>último guardado</strong>. La selección para el próximo guardado se hace en «Emisor activo»; el parámetro de URL{" "}
                  <code className="text-xs">templateProfileId</code> usa la misma clave que Facturar.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p><strong>Id (servidor):</strong> {safeValue(serverActiveProfile?.id)}</p>
                <p className="flex flex-wrap items-center gap-2">
                  <strong>Nombre del usuario:</strong>
                  {serverActiveProfile ? (
                    <ProfileBadge
                      label={String(serverActiveProfile.label || serverActiveProfile.id)}
                      colorKey={serverActiveProfile.colorKey}
                    />
                  ) : (
                    safeValue(undefined)
                  )}
                </p>
                <p><strong>Forma de pago:</strong> {safeValue(serverActiveProfile?.defaults?.paymentMethod)}</p>
                <p><strong>Cuenta:</strong> {safeValue(serverActiveProfile?.business?.bankAccount)}</p>
                <p><strong>Plantilla PDF:</strong> {safeValue(serverActiveProfile?.design?.layout)}</p>
                <p><strong>IGIC:</strong> {safeValue(serverActiveProfile?.defaults?.taxRate)}</p>
                <p><strong>IRPF:</strong> {safeValue(serverActiveProfile?.defaults?.withholdingRate)}</p>
                {String(effectiveActiveProfileId || "").trim()
                && String(effectiveActiveProfileId || "").trim() !== String(serverActiveProfileId || "").trim() ? (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
                    La selección de perfil activo en el formulario (
                    <strong>{safeValue(activeProfileForNextSave?.label || effectiveActiveProfileId)}</strong>
                    ) aún no está guardada en el servidor; pulsa «Guardar datos del emisor» para fijarla.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() =>
                      navigate(`/facturar?templateProfileId=${encodeURIComponent(String(effectiveActiveProfileId || ""))}`)
                    }
                    disabled={!effectiveActiveProfileId}
                  >
                    Abrir Facturar con este perfil
                  </Button>
                </div>
                {!canEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Solo lectura: el contrato exige usuario administrador para persistir perfiles.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Defaults runtime</CardTitle>
                <CardDescription>Valores efectivos publicados por `/api/config`.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p><strong>Tenant:</strong> {safeValue(sessionQuery.data?.authenticated ? sessionQuery.data.user.tenantId : "")}</p>
                <p><strong>Rol usuario:</strong> {safeValue(sessionQuery.data?.authenticated ? sessionQuery.data.user.role : "")}</p>
                <p><strong>Forma de pago:</strong> {safeValue(configQuery.data?.defaults?.paymentMethod)}</p>
                <p><strong>IGIC:</strong> {safeValue(configQuery.data?.defaults?.taxRate)}</p>
                <p><strong>IRPF:</strong> {safeValue(configQuery.data?.defaults?.withholdingRate)}</p>
                <p className="pt-2 text-xs text-muted-foreground">
                  La numeración en Facturar se calcula con el perfil activo/seleccionado vía `/api/next-number`.
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emisor y PDF</p>
              <CardTitle>Emisor activo</CardTitle>
              <CardDescription>
                Orden habitual en legacy: primero guarda aquí el emisor; el constructor fino de módulos PDF sigue en la app legacy
                (pestaña Plantilla). Puedes abrir directamente un perfil con{" "}
                <code className="text-xs">/configuracion?templateProfileId=…</code> (mismo nombre de parámetro que en Facturar).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hasUnsavedLocalChanges ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-foreground"
                >
                  <p className="font-medium">Cambios locales pendientes de guardar</p>
                  <p className="mt-1 text-muted-foreground">
                    Hay ediciones o un perfil activo distinto del último guardado en servidor; nada de esto se aplica en el backend
                    hasta pulsar «Guardar datos del emisor».
                  </p>
                </div>
              ) : null}
              {!canEdit ? (
                <div
                  role="status"
                  className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">Modo solo lectura</p>
                  <p className="mt-1 text-muted-foreground">
                    Editar datos del emisor, crear un usuario nuevo y guardar en el servidor solo están habilitados para la
                    sesión cuyo rol en <code className="rounded bg-muted px-1 text-xs">GET /api/session</code> es{" "}
                    <strong>admin</strong>.
                    {configuredRoleLabel ? (
                      <>
                        {" "}
                        Tu sesión publica el rol: <strong>{configuredRoleLabel}</strong>.
                      </>
                    ) : (
                      <> En esta carga no figura un valor de rol en la sesión.</>
                    )}
                  </p>
                </div>
              ) : null}
              {profiles.length ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Plantilla de emisor">
                      <select
                        aria-label="Plantilla de emisor"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={effectiveEditingProfileId}
                        onChange={(event) => syncLauncherSelection(event.target.value)}
                      >
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.label || profile.id}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Plantilla">
                      <select
                        aria-label="Plantilla"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={
                          LAYOUT_OPTIONS.some((o) => o.value === editingDraft.layout) ? editingDraft.layout : ""
                        }
                        onChange={(event) => updateDraft({ layout: event.target.value })}
                        disabled={!canEdit}
                      >
                        <option value="">Plantilla...</option>
                        {LAYOUT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit || isCreatingProfile}
                      onClick={startNewTemplateProfile}
                    >
                      Nuevo usuario
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit || isCreatingProfile || newBaseOpen}
                      onClick={() => {
                        setNewBaseLabel("");
                        setNewBaseLayout("pear");
                        setNewBaseOpen(true);
                      }}
                    >
                      Nueva base de diseño
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={!canEdit || profiles.length <= 1}
                      onClick={handleDeleteTemplateProfile}
                    >
                      Borrar usuario
                    </Button>
                    <Button
                      type="button"
                      disabled={!canEdit || saveConfigMutation.isPending || !profiles.length}
                      onClick={() => saveConfigMutation.mutate()}
                    >
                      {saveConfigMutation.isPending ? "Guardando..." : "Guardar datos del emisor"}
                    </Button>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={propagateMutation.isPending || saveConfigMutation.isPending}
                        onClick={() => {
                          const profileId = String(effectiveActiveProfileId || "").trim();
                          if (!profileId) {
                            setStatusMessage("Selecciona un perfil activo antes de propagar.");
                            setStatusTone("error");
                            return;
                          }
                          propagateMutation.mutate(profileId);
                        }}
                      >
                        {propagateMutation.isPending
                          ? "Propagando..."
                          : "Guardar diseño y actualizar facturas anteriores"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(`/facturar?templateProfileId=${encodeURIComponent(String(effectiveEditingProfileId || ""))}`)
                      }
                      disabled={!effectiveEditingProfileId}
                    >
                      Abrir Facturar
                    </Button>
                  </div>
                  {isCreatingProfile ? (
                    <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_auto_auto]">
                      <Input
                        aria-label="Nombre del nuevo perfil"
                        placeholder="Nombre del nuevo perfil"
                        value={newProfileLabelDraft}
                        onChange={(event) => setNewProfileLabelDraft(event.target.value)}
                        disabled={!canEdit}
                      />
                      <Button type="button" onClick={confirmNewTemplateProfile} disabled={!canEdit}>
                        Crear perfil
                      </Button>
                      <Button type="button" variant="outline" onClick={cancelNewTemplateProfile}>
                        Cancelar
                      </Button>
                    </div>
                  ) : null}

                  <details className="group rounded-md border border-dashed p-3" open>
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                      Básico del usuario
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Nombre del usuario">
                        <Input
                          placeholder="Ejemplo: Pear&co."
                          value={editingDraft.label}
                          onChange={(event) => updateDraft({ label: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field
                        label="ID en el número de factura"
                        hint="Obligatorio en legacy: 3 a 5 letras (sin tilde, sin números en el prefijo). Distinto en cada usuario."
                      >
                        <Input
                          placeholder="Ej. JOS → JOS_1-2026"
                          value={editingDraft.invoiceNumberTag}
                          onChange={(event) => {
                            setInvoiceTagSuggestions([]);
                            updateDraft({ invoiceNumberTag: event.target.value.toUpperCase() });
                          }}
                          maxLength={5}
                          autoComplete="off"
                          spellCheck={false}
                          disabled={!canEdit}
                        />
                        {invoiceTagSuggestions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <p className="w-full text-xs text-muted-foreground">Prefijos sugeridos (elige uno):</p>
                            {invoiceTagSuggestions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="rounded-full border border-input bg-background px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
                                onClick={() => {
                                  updateDraft({ invoiceNumberTag: tag });
                                  setInvoiceTagSuggestions([]);
                                }}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </Field>
                      <Field label="Color en listados y vista previa">
                        <select
                          aria-label="Color del usuario"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editingDraft.colorKey}
                          onChange={(event) => updateDraft({ colorKey: event.target.value })}
                          disabled={!canEdit}
                        >
                          {PROFILE_COLOR_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {PROFILE_COLOR_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Fuente del documento">
                        <select
                          value={String(editingDraft.fontFamily ?? "")}
                          onChange={(event) => updateDraft({ fontFamily: event.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          disabled={!canEdit}
                        >
                          <option value="">— Por defecto —</option>
                          {fontFamilies.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Marca / empresa">
                        <Input
                          placeholder="Nombre comercial"
                          value={editingDraft.brand}
                          onChange={(event) => updateDraft({ brand: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="lg:col-span-2">
                        <Field label="Nombre completo / responsable">
                          <Input
                            placeholder="Persona que emite la factura"
                            value={editingDraft.contactName}
                            onChange={(event) => updateDraft({ contactName: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Descripcion corta">
                          <Input
                            placeholder="Linea descriptiva de la empresa"
                            value={editingDraft.headline}
                            onChange={(event) => updateDraft({ headline: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="DNI / NIF / CIF">
                        <Input
                          value={editingDraft.taxId}
                          onChange={(event) => updateDraft({ taxId: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Email">
                        <Input
                          type="email"
                          value={editingDraft.email}
                          onChange={(event) => updateDraft({ email: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Telefono">
                        <Input
                          value={editingDraft.phone}
                          onChange={(event) => updateDraft({ phone: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Web">
                        <Input
                          placeholder="dominio.com"
                          value={editingDraft.website}
                          onChange={(event) => updateDraft({ website: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Direccion fiscal / postal">
                          <Input
                            value={editingDraft.address}
                            onChange={(event) => updateDraft({ address: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                    </div>
                  </details>

                  <details className="group rounded-md border border-dashed p-3">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                      Avanzado del usuario
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Logo / imagen de marca">
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={brandImageFileInputRef}
                                type="file"
                                accept=".svg,image/svg+xml,image/png,image/webp,image/jpeg"
                                disabled={!canEdit}
                                onChange={handleBrandImageFileChange}
                                className="max-w-full text-sm file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canEdit}
                                onClick={() => {
                                  updateDraft({ brandImage: "" });
                                  setBrandImageFileError("");
                                  if (brandImageFileInputRef.current) {
                                    brandImageFileInputRef.current.value = "";
                                  }
                                }}
                              >
                                Quitar logo
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">{brandImageSummary}</p>
                            {brandImageFileError ? (
                              <p className="text-xs text-red-600">{brandImageFileError}</p>
                            ) : null}
                            <Input
                              placeholder="/assets/logo.svg o ruta absoluta (opcional)"
                              value={editingDraft.brandImage}
                              onChange={(event) => {
                                setBrandImageFileError("");
                                updateDraft({ brandImage: event.target.value });
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Ruta firma">
                          <Input
                            placeholder="/assets/firma.png o ruta absoluta"
                            value={editingDraft.signatureImage}
                            onChange={(event) => updateDraft({ signatureImage: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="Banco">
                        <Input
                          placeholder="ING, CaixaBank..."
                          value={editingDraft.bankBrand}
                          onChange={(event) => updateDraft({ bankBrand: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Cuenta bancaria / IBAN">
                          <Input
                            value={editingDraft.bankAccount}
                            onChange={(event) => updateDraft({ bankAccount: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Forma de pago por defecto">
                          <Input
                            placeholder="Transferencia bancaria"
                            value={editingDraft.paymentMethod}
                            onChange={(event) => updateDraft({ paymentMethod: event.target.value })}
                            disabled={!canEdit}
                          />
                        </Field>
                      </div>
                      <Field label="Moneda">
                        <Input
                          placeholder="EUR"
                          value={editingDraft.currency}
                          onChange={(event) => updateDraft({ currency: event.target.value })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="IGIC / IVA por defecto">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={String(editingDraft.taxRate)}
                          onChange={(event) => updateDraft({ taxRate: toNumber(event.target.value) })}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="IRPF por defecto">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={String(editingDraft.withholdingRate)}
                          onChange={(event) => updateDraft({ withholdingRate: toNumber(event.target.value) })}
                          disabled={!canEdit}
                        />
                      </Field>
                    </div>
                  </details>

                  <div className="grid gap-1 rounded-md border p-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>id perfil: {safeValue(editingProfile?.id)}</span>
                    <span>tenantId: {safeValue(editingProfile?.tenantId)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No hay perfiles de emisor disponibles.</p>
              )}

              {statusMessage ? (
                <p className={`text-sm ${statusTone === "error" ? "text-red-600" : statusTone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {statusMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <ExpenseOptionsSection canEdit={canEdit} />

          {isAdmin ? (
            <Card>
              <div className="grid gap-4 p-4">
                <h2 className="text-base font-semibold">Integración Gmail</h2>

                {gmailOAuthSectionError ? <p className="text-sm text-red-600">{gmailOAuthSectionError}</p> : null}

                {gmailProfilesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando estado de Gmail...</p>
                ) : null}

                {!gmailProfilesQuery.isLoading && !gmailProfilesQuery.data?.configured ? (
                  <p className="text-sm text-muted-foreground">
                    Gmail no está configurado en el servidor (faltan credenciales OAuth).
                  </p>
                ) : null}

                {gmailProfilesQuery.data?.configured ? (
                  <div className="grid gap-3">
                    {(gmailProfilesQuery.data?.items ?? []).map((item: GmailProfileItem) => (
                      <div key={item.templateProfileId} className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.connected && item.email ? (
                            <p className="text-xs text-muted-foreground">{item.email}</p>
                          ) : null}
                          {!item.connected ? <p className="text-xs text-muted-foreground">No conectado</p> : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setGmailOAuthSectionError("");
                            try {
                              const { authUrl } = await fetchGmailOAuthStartUrl(item.templateProfileId);
                              await openGmailOAuthPopupAndWait(authUrl);
                              await queryClient.invalidateQueries({ queryKey: ["gmail-profiles"] });
                            } catch (err) {
                              setGmailOAuthSectionError(getErrorMessageFromUnknown(err));
                            }
                          }}
                        >
                          {item.connected ? "Reconectar" : "Conectar"}
                        </Button>
                      </div>
                    ))}

                    {gmailProfilesQuery.data?.items?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay perfiles de plantilla con Gmail configurado.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <TrashSection canEdit={canEdit} />

          <dialog
            ref={newBaseDialogRef}
            onClose={() => {
              setNewBaseOpen(false);
              setNewBaseLabel("");
              setNewBaseLayout("pear");
            }}
            className="z-[60] w-[min(100vw-2rem,420px)] rounded-lg border border-border bg-background p-6 text-foreground shadow-lg"
          >
            <div className="grid gap-4">
              <h2 className="text-base font-semibold">Nueva base de diseño</h2>
              <p className="text-sm text-muted-foreground">
                Crea un perfil vacío con la plantilla visual elegida. Completa datos del emisor y guarda en el servidor.
              </p>
              <Field label="Nombre del perfil">
                <Input
                  value={newBaseLabel}
                  onChange={(e) => setNewBaseLabel(e.target.value)}
                  placeholder="Ej. Eventos Canarias"
                  autoComplete="off"
                />
              </Field>
              <Field label="Plantilla base">
                <select
                  aria-label="Plantilla base del nuevo perfil"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newBaseLayout}
                  onChange={(e) => setNewBaseLayout(e.target.value as (typeof LAYOUT_OPTIONS)[number]["value"])}
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    newBaseDialogRef.current?.close();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={confirmNewProfileFromBase} disabled={!canEdit}>
                  Crear en memoria
                </Button>
              </div>
            </div>
          </dialog>

          <MembersSection
            canEdit={canEdit}
            profiles={serverProfiles}
            currentUserId={String(sessionQuery.data?.authenticated ? sessionQuery.data.user.id ?? "" : "")}
          />
        </>
      )}
    </div>
  );
}
