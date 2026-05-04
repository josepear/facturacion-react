import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ClientRecord } from "@/domain/document/types";
import { PageHeader } from "@/features/shared/components/PageHeader";
import { SAVE, savePending } from "@/features/shared/lib/uiActionCopy";
import { archiveClient, fetchClients, saveClient } from "@/infrastructure/api/clientsApi";
import { normalizeTaxIdKey, normalizeTextKey } from "@/lib/clientMatching";
import { cn } from "@/lib/utils";

function createEmptyClient(): ClientRecord {
  return {
    name: "",
    taxId: "",
    address: "",
    city: "",
    province: "",
    taxCountryCode: "ES",
    taxIdType: "",
    email: "",
    contactPerson: "",
  };
}

function normalizeClientDraft(client: ClientRecord): ClientRecord {
  return {
    ...client,
    name: String(client.name || "").trim(),
    taxId: String(client.taxId || "").trim(),
    address: String(client.address || "").trim(),
    city: String(client.city || "").trim(),
    province: String(client.province || "").trim(),
    taxCountryCode: String(client.taxCountryCode || "").trim().toUpperCase(),
    taxIdType: String(client.taxIdType || "").trim(),
    email: String(client.email || "").trim(),
    contactPerson: String(client.contactPerson || "").trim(),
  };
}

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRecordId = String(searchParams.get("recordId") || "").trim();
  const initialSearchTerm = String(searchParams.get("q") || "").trim();
  const initialCountryFilter = String(searchParams.get("country") || "").trim().toUpperCase();

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [sortBy, setSortBy] = useState<"name" | "taxCountryCode" | "recent">("name");
  const [filterCountry, setFilterCountry] = useState(initialCountryFilter);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [draft, setDraft] = useState<ClientRecord>(createEmptyClient());
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  const setRecordIdSearchParam = (recordId: string) => {
    const next = new URLSearchParams(searchParams);
    const safe = String(recordId || "").trim();
    if (safe) {
      next.set("recordId", safe);
    } else {
      next.delete("recordId");
    }
    setSearchParams(next, { replace: true });
  };

  const allClients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  const countryOptions = useMemo(() => {
    const values = new Set(
      allClients
        .map((client) => String(client.taxCountryCode || "").trim().toUpperCase())
        .filter(Boolean),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allClients]);

  const filteredClients = useMemo(() => {
    const term = normalizeTextKey(searchTerm);
    const taxTerm = normalizeTaxIdKey(searchTerm);
    const safeCountry = String(filterCountry || "").trim().toUpperCase();
    const clients = allClients;
    if (!term) {
      const noSearchClients = safeCountry
        ? clients.filter((client) => String(client.taxCountryCode || "").trim().toUpperCase() === safeCountry)
        : clients;
      if (sortBy === "recent") {
        return noSearchClients;
      }
      const sorted = [...noSearchClients].sort((left, right) => {
        if (sortBy === "taxCountryCode") {
          const leftCountry = String(left.taxCountryCode || "").trim().toUpperCase();
          const rightCountry = String(right.taxCountryCode || "").trim().toUpperCase();
          if (leftCountry !== rightCountry) {
            return leftCountry.localeCompare(rightCountry);
          }
        }
        return normalizeTextKey(left.name || "").localeCompare(normalizeTextKey(right.name || ""));
      });
      return sorted;
    }

    const searched = clients.filter((client) => {
      const name = normalizeTextKey(client.name || "");
      const taxId = normalizeTaxIdKey(client.taxId || "");
      const email = normalizeTextKey(client.email || "");
      const contactPerson = normalizeTextKey(client.contactPerson || "");
      const city = normalizeTextKey(client.city || "");
      const province = normalizeTextKey(client.province || "");
      const recordId = normalizeTextKey(client.recordId || "");
      return (
        name.includes(term)
        || taxId.includes(taxTerm)
        || email.includes(term)
        || contactPerson.includes(term)
        || city.includes(term)
        || province.includes(term)
        || recordId.includes(term)
      );
    });
    const countryFiltered = safeCountry
      ? searched.filter((client) => String(client.taxCountryCode || "").trim().toUpperCase() === safeCountry)
      : searched;
    if (sortBy === "recent") {
      return countryFiltered;
    }
    const sorted = [...countryFiltered].sort((left, right) => {
      if (sortBy === "taxCountryCode") {
        const leftCountry = String(left.taxCountryCode || "").trim().toUpperCase();
        const rightCountry = String(right.taxCountryCode || "").trim().toUpperCase();
        if (leftCountry !== rightCountry) {
          return leftCountry.localeCompare(rightCountry);
        }
      }
      return normalizeTextKey(left.name || "").localeCompare(normalizeTextKey(right.name || ""));
    });
    return sorted;
  }, [allClients, filterCountry, searchTerm, sortBy]);

  const hasSearchFilter = Boolean(String(searchTerm || "").trim());
  const hasActiveFilters = hasSearchFilter || Boolean(String(filterCountry || "").trim());

  useEffect(() => {
    if (!initialRecordId || selectedRecordId || !allClients.length) {
      return;
    }
    const target = allClients.find((client) => String(client.recordId || "").trim() === initialRecordId);
    if (!target) {
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      setSelectedRecordId(initialRecordId);
      setDraft(normalizeClientDraft(target));
      setStatusMessage("Cliente cargado desde URL.");
      setStatusTone("neutral");
    }, 0);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [allClients, initialRecordId, selectedRecordId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const safeSearch = String(searchTerm || "").trim();
    const safeCountry = String(filterCountry || "").trim().toUpperCase();
    if (safeSearch) {
      next.set("q", safeSearch);
    } else {
      next.delete("q");
    }
    if (safeCountry) {
      next.set("country", safeCountry);
    } else {
      next.delete("country");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filterCountry, searchParams, searchTerm, setSearchParams]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = normalizeClientDraft(draft);
      if (!payload.name) {
        throw new Error("Nombre o razón social obligatorio.");
      }
      return saveClient({
        recordId: selectedRecordId || undefined,
        client: payload,
      });
    },
    onSuccess: async (savedClient) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      const nextRecordId = String(savedClient.recordId || "").trim();
      if (nextRecordId) {
        setSelectedRecordId(nextRecordId);
        setRecordIdSearchParam(nextRecordId);
      }
      setDraft(normalizeClientDraft(savedClient));
      setStatusMessage("Cliente guardado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo guardar el cliente.");
      setStatusTone("error");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const safeRecordId = String(selectedRecordId || "").trim();
      if (!safeRecordId) {
        throw new Error("Selecciona un cliente para archivar.");
      }
      return archiveClient(safeRecordId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSelectedRecordId("");
      setDraft(createEmptyClient());
      setRecordIdSearchParam("");
      setStatusMessage("Cliente archivado.");
      setStatusTone("success");
    },
    onError: (error) => {
      setStatusMessage((error as Error).message || "No se pudo archivar el cliente.");
      setStatusTone("error");
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Clientes"
        description="Módulo real conectado al contrato legacy de clientes, coherente con Facturar."
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>Búsqueda y selección de clientes guardados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder="Buscar por nombre, NIF/CIF, email, contacto, ciudad o recordId"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="País">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filterCountry}
                  onChange={(event) => setFilterCountry(String(event.target.value || "").trim().toUpperCase())}
                >
                  <option value="">Todos los países</option>
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ordenar por">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "name" | "taxCountryCode" | "recent")}
                >
                  <option value="name">Nombre (A-Z)</option>
                  <option value="taxCountryCode">País (A-Z)</option>
                  <option value="recent">Orden original</option>
                </select>
              </Field>
            </div>
            {hasActiveFilters ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCountry("");
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRecordId("");
                setDraft(createEmptyClient());
                setRecordIdSearchParam("");
                setStatusMessage("Nuevo cliente.");
                setStatusTone("neutral");
              }}
            >
              Nuevo cliente
            </Button>
            {!clientsQuery.isLoading && allClients.length ? (
              <p className="text-informative">
                Mostrando {filteredClients.length} de {allClients.length}
                {hasActiveFilters ? " (filtro activo)" : ""}
              </p>
            ) : null}
            <div className="max-h-[480px] overflow-auto rounded-md border">
              {clientsQuery.isLoading ? (
                <p className="p-3 text-informative">Cargando clientes...</p>
              ) : filteredClients.length ? (
                <ul className="divide-y">
                  {filteredClients.map((client) => {
                    const isActive = String(client.recordId || "") === selectedRecordId;
                    return (
                      <li key={client.recordId || `${client.name}-${client.taxId || ""}`}>
                        <button
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm transition-colors",
                            isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                          )}
                          onClick={() => {
                            const nextId = String(client.recordId || "");
                            setSelectedRecordId(nextId);
                            setRecordIdSearchParam(nextId);
                            setDraft(normalizeClientDraft(client));
                            setStatusMessage("Cliente cargado para edición.");
                            setStatusTone("neutral");
                          }}
                        >
                          <p className="font-medium">{client.name || "Sin nombre"}</p>
                          <p className={cn(isActive ? "text-xs text-primary-foreground/85" : "text-informative")}>
                            {client.taxId || "Sin NIF/CIF"}
                          </p>
                          {String(client.email || "").trim() ? (
                            <p className={cn(isActive ? "text-xs text-primary-foreground/85" : "text-informative")}>
                              {String(client.email).trim()}
                            </p>
                          ) : null}
                          {String(client.contactPerson || "").trim() ? (
                            <p className={cn(isActive ? "text-xs text-primary-foreground/85" : "text-informative")}>
                              Contacto: {String(client.contactPerson).trim()}
                            </p>
                          ) : null}
                          {(String(client.city || "").trim() || String(client.province || "").trim()) ? (
                            <p className={cn(isActive ? "text-xs text-primary-foreground/85" : "text-informative")}>
                              {[String(client.city || "").trim(), String(client.province || "").trim()].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-3 text-informative">No hay clientes para ese filtro.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedRecordId ? "Editar cliente" : "Alta de cliente"}</CardTitle>
            <CardDescription>Edición mínima operativa con el mismo modelo que consume Facturar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {selectedRecordId ? (
              <p className="sm:col-span-2 text-informative">
                <span className="font-medium text-foreground">recordId (Facturar / API):</span> {selectedRecordId}
              </p>
            ) : null}
            <Field label="Nombre o razón social">
              <Input value={draft.name || ""} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
            </Field>
            <Field label="NIF/CIF">
              <Input value={draft.taxId || ""} onChange={(event) => setDraft((prev) => ({ ...prev, taxId: event.target.value }))} />
            </Field>
            <Field label="Dirección">
              <Input
                value={draft.address || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
              />
            </Field>
            <Field label="Ciudad">
              <Input value={draft.city || ""} onChange={(event) => setDraft((prev) => ({ ...prev, city: event.target.value }))} />
            </Field>
            <Field label="Provincia">
              <Input
                value={draft.province || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, province: event.target.value }))}
              />
            </Field>
            <Field label="País (código)">
              <Input
                value={draft.taxCountryCode || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, taxCountryCode: event.target.value }))}
              />
            </Field>
            <Field label="Tipo NIF">
              <Input
                value={draft.taxIdType || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, taxIdType: event.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input value={draft.email || ""} onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))} />
            </Field>
            <Field label="Persona de contacto">
              <Input
                value={draft.contactPerson || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, contactPerson: event.target.value }))}
              />
            </Field>

            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? savePending() : `${SAVE} cliente`}
              </Button>
              {selectedRecordId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedRecordId("");
                    setDraft(createEmptyClient());
                    setRecordIdSearchParam("");
                    setStatusMessage("Nuevo cliente.");
                    setStatusTone("neutral");
                  }}
                >
                  Crear nuevo
                </Button>
              ) : null}
              {selectedRecordId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={archiveMutation.isPending}
                  onClick={() => {
                    const confirmed = globalThis.confirm("Este cliente se moverá a papelera. ¿Continuar?");
                    if (!confirmed) {
                      return;
                    }
                    archiveMutation.mutate();
                  }}
                >
                  {archiveMutation.isPending ? "Archivando..." : "Archivar cliente"}
                </Button>
              ) : null}
            </div>
            {statusMessage ? (
              <p
                className={cn(
                  "sm:col-span-2",
                  statusTone === "error" ? "text-sm text-red-600" : statusTone === "success" ? "text-sm text-emerald-600" : "text-informative",
                )}
              >
                {statusMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
