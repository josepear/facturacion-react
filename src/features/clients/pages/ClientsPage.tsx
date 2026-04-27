import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ClientRecord } from "@/domain/document/types";
import { fetchClients, saveClient } from "@/infrastructure/api/clientsApi";
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
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [draft, setDraft] = useState<ClientRecord>(createEmptyClient());
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  const filteredClients = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    const clients = clientsQuery.data ?? [];
    if (!term) {
      return clients;
    }
    return clients.filter((client) => {
      const name = String(client.name || "").toLowerCase();
      const taxId = String(client.taxId || "").toLowerCase();
      const email = String(client.email || "").toLowerCase();
      return name.includes(term) || taxId.includes(term) || email.includes(term);
    });
  }, [clientsQuery.data, searchTerm]);

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Módulo real conectado al contrato legacy de clientes, coherente con Facturar.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>Búsqueda y selección de clientes guardados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder="Buscar por nombre, NIF/CIF o email"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedRecordId("");
                setDraft(createEmptyClient());
                setStatusMessage("Nuevo cliente.");
                setStatusTone("neutral");
              }}
            >
              Nuevo cliente
            </Button>
            <div className="max-h-[480px] overflow-auto rounded-md border">
              {clientsQuery.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Cargando clientes...</p>
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
                            setSelectedRecordId(String(client.recordId || ""));
                            setDraft(normalizeClientDraft(client));
                            setStatusMessage("Cliente cargado para edición.");
                            setStatusTone("neutral");
                          }}
                        >
                          <p className="font-medium">{client.name || "Sin nombre"}</p>
                          <p className={cn("text-xs", isActive ? "text-primary-foreground/85" : "text-muted-foreground")}>
                            {client.taxId || "Sin NIF/CIF"}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">No hay clientes para ese filtro.</p>
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
                {saveMutation.isPending ? "Guardando..." : "Guardar cliente"}
              </Button>
              {selectedRecordId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedRecordId("");
                    setDraft(createEmptyClient());
                    setStatusMessage("Nuevo cliente.");
                    setStatusTone("neutral");
                  }}
                >
                  Crear nuevo
                </Button>
              ) : null}
            </div>
            {statusMessage ? (
              <p className={cn("sm:col-span-2 text-sm", statusTone === "error" ? "text-red-600" : statusTone === "success" ? "text-emerald-600" : "text-muted-foreground")}>
                {statusMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
