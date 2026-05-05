import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TemplateProfileConfig } from "@/domain/document/types";
import { CANCEL, SAVE, savePending } from "@/features/shared/lib/uiActionCopy";
import { ApiError } from "@/infrastructure/api/httpClient";
import {
  type SystemUser,
  type UpsertUserInput,
  deleteSystemUser,
  fetchSystemUsers,
  upsertSystemUser,
} from "@/infrastructure/api/usersApi";

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

export function MembersSection({
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
  const userDialogRef = useRef<HTMLDialogElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const lastDialogTriggerRef = useRef<HTMLElement | null>(null);
  const [memberStatus, setMemberStatus] = useState("");
  const [memberStatusTone, setMemberStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const usersQueryError = usersQuery.error;
  /** Incluye `status` por si el error no pasa `instanceof ApiError` (p. ej. duplicado de módulo en tests). */
  const usersErrorHttpStatus = (() => {
    if (usersQueryError instanceof ApiError) {
      return usersQueryError.status;
    }
    if (usersQueryError && typeof usersQueryError === "object" && "status" in usersQueryError) {
      const n = Number((usersQueryError as { status: unknown }).status);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  })();
  const usersApiUnavailable =
    usersQuery.isError && (usersErrorHttpStatus === 404 || usersErrorHttpStatus === 405);
  const usersUnavailableStatus: 404 | 405 | null =
    usersErrorHttpStatus === 404 || usersErrorHttpStatus === 405 ? usersErrorHttpStatus : null;
  const canManageMembers = canEdit && !usersApiUnavailable;

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
    if (!canManageMembers) {
      setMemberStatus("Tu servidor actual no soporta la gestión de miembros (/api/users).");
      setMemberStatusTone("error");
      return;
    }
    if (!window.confirm(`¿Eliminar al miembro «${user.name || user.email}»? Esta acción no se puede deshacer.`)) {
      return;
    }
    deleteMutation.mutate(user.id);
  };

  const handleEdit = (user: SystemUser) => {
    if (!canManageMembers) {
      setMemberStatus("Tu servidor actual no soporta la gestión de miembros (/api/users).");
      setMemberStatusTone("error");
      return;
    }
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
    if (!canManageMembers) {
      setMemberStatus("Tu servidor actual no soporta la gestión de miembros (/api/users).");
      setMemberStatusTone("error");
      return;
    }
    setEditingUser({ isNew: true, ...EMPTY_USER_FORM });
    setMemberStatus("");
  };

  useEffect(() => {
    const dialog = userDialogRef.current;
    if (!dialog) {
      return;
    }
    if (editingUser) {
      if (!dialog.open) {
        dialog.showModal();
      }
      globalThis.setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 0);
      return;
    }
    if (dialog.open) {
      dialog.close();
    }
    lastDialogTriggerRef.current?.focus();
  }, [editingUser]);

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
    if (!canManageMembers) {
      setMemberStatus("Tu servidor actual no soporta la gestión de miembros (/api/users).");
      setMemberStatusTone("error");
      return;
    }
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

  const closeUserDialog = () => {
    setEditingUser(null);
  };

  const handleDialogEsc = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeUserDialog();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros del sistema</CardTitle>
        <CardDescription>
          Usuarios con acceso a la aplicación. Solo los administradores ven y gestionan esta sección.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {usersQuery.isLoading ? (
          <p className="text-informative">Cargando miembros...</p>
        ) : usersQuery.isError && usersApiUnavailable ? (
          <div
            role="region"
            aria-label="Gestión de miembros no disponible en este servidor"
            className="space-y-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm"
          >
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                Gestión de miembros no disponible en este servidor
              </p>
              <ul className="list-disc space-y-1.5 pl-5 text-informative">
                <li>
                  Este entorno no expone <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/api/users</code>.
                </li>
                <li>
                  Para habilitar creación/edición de miembros, hay que activar esa API en el backend runtime.
                </li>
                <li>
                  Mientras tanto, los accesos se gestionan en{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">facturacion.config.json</code> (
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">users</code>/
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">templateProfiles</code>).
                </li>
              </ul>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={async () => {
                const status = usersUnavailableStatus ?? 404;
                const stamp = new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" });
                const line = `API miembros no disponible: GET /api/users -> ${status} en ${stamp}`;
                try {
                  if (!navigator.clipboard?.writeText) {
                    throw new Error("clipboard_unavailable");
                  }
                  await navigator.clipboard.writeText(line);
                  setMemberStatus("Diagnóstico copiado al portapapeles.");
                  setMemberStatusTone("success");
                } catch {
                  setMemberStatus("No se pudo copiar (permisos del navegador o contexto no seguro).");
                  setMemberStatusTone("error");
                }
              }}
            >
              Copiar diagnóstico
            </Button>
          </div>
        ) : usersQuery.isError ? (
          <p className="text-sm text-red-600">
            {(usersQuery.error as Error)?.message || "No se pudo cargar la lista de miembros."}
          </p>
        ) : (
          <div className="grid gap-2">
            {items.map((user) => {
              return (
                <div key={user.id} className="grid gap-0">
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{user.name || user.email}</p>
                      <p className="truncate text-informative">{user.email} · {user.role}</p>
                    </div>
                    {canManageMembers && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            lastDialogTriggerRef.current = event.currentTarget;
                            handleEdit(user);
                          }}
                        >
                          Editar
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

                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-informative">No hay miembros registrados.</p>
            )}
          </div>
        )}

        {canManageMembers && !editingUser && (
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              lastDialogTriggerRef.current = event.currentTarget;
              handleNew();
            }}
            className="self-start"
          >
            Nuevo usuario
          </Button>
        )}

        {memberStatus && (
          <p
            className={
              memberStatusTone === "error"
                ? "text-sm text-red-600"
                : memberStatusTone === "success"
                  ? "text-sm text-emerald-600"
                  : "text-informative"
            }
          >
            {memberStatus}
          </p>
        )}

        <dialog
          ref={userDialogRef}
          onClose={closeUserDialog}
          onKeyDown={handleDialogEsc}
          className="z-[60] w-[min(100vw-2rem,680px)] rounded-lg border border-border bg-background p-6 text-foreground shadow-lg"
          aria-label={editingUser?.isNew ? "Nuevo usuario" : "Editar usuario"}
        >
          {editingUser ? (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{editingUser.isNew ? "Nuevo usuario" : "Editar usuario"}</h2>
                <Button type="button" variant="ghost" size="sm" onClick={closeUserDialog} aria-label="Cerrar">
                  ✕
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre">
                  <Input
                    ref={firstFieldRef}
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label={editingUser.isNew ? "Contraseña" : "Nueva contraseña (vacío = sin cambio)"}>
                  <Input
                    type="password"
                    value={editingUser.password ?? ""}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Rol">
                  <select
                    aria-label="Rol del usuario"
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

              {profiles.length > 0 ? (
                <Field label="Emisores permitidos (vacío = todos)">
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
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeUserDialog}>
                  {CANCEL}
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? savePending() : SAVE}
                </Button>
              </div>
            </div>
          ) : null}
        </dialog>
      </CardContent>
    </Card>
  );
}
