"""Port page-level UI changes to main (tolerant)."""
import re

G = "/Users/josemendoza/Repos/facturacion-react"
missing = []


def patch(rel, pairs):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    for old, new in pairs:
        if old in s:
            s = s.replace(old, new)
        else:
            missing.append(rel + " :: " + old[:75].replace("\n", "\\n"))
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched", rel)


def tokens(rel):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    for o, n in [("text-amber-700 dark:text-amber-300", "text-warning"),
                 ("text-red-600", "text-danger"), ("text-red-700", "text-danger"),
                 ("text-emerald-600", "text-success"), ("text-emerald-700", "text-success"),
                 ("text-amber-600", "text-warning"), ("text-amber-700", "text-warning")]:
        s = s.replace(o, n)
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("tokens", rel)


def selects(rel, skip_sr_only=False):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    openings = [m.start() for m in re.finditer(r"<select\b", s)]
    closings = [m.start() for m in re.finditer(r"</select>", s)]
    if len(openings) != len(closings):
        missing.append(rel + " :: select pairing")
        return
    reps = []
    for o, c in zip(openings, closings):
        if skip_sr_only and "sr-only" in s[o:o + 160]:
            continue
        reps.append((o, o + len("<select"), "<Select"))
        reps.append((c, c + len("</select>"), "</Select>"))
    reps.sort(key=lambda r: r[0], reverse=True)
    for a, b, t in reps:
        s = s[:a] + t + s[b:]
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("selects", rel, len(openings))


def neutralize(rel):
    colors = [
        "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20",
        "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20",
        "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20",
        "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40",
    ]
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    n = 0
    for c in colors:
        old = '<Card className="%s">' % c
        n += s.count(old)
        s = s.replace(old, "<Card>")
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("neutralized", rel, n)


# ---------------- Facturar
patch("src/features/invoices/pages/FacturarPage.tsx", [
    ('import { PageHeader } from "@/features/shared/components/PageHeader";\n',
     'import { PageHeader } from "@/features/shared/components/PageHeader";\n'
     'import { InfoCallout } from "@/components/ui/info-callout";\n'
     'import { SectionTitle } from "@/components/ui/section-title";\n'
     'import { Select } from "@/components/ui/select";\n'),
    ('        <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20">\n'
     '          <CardContent className="pt-6 text-sm text-informative">\n'
     '            Sincronizando emisores y permisos de la sesión…\n'
     '          </CardContent>\n'
     '        </Card>',
     '        <InfoCallout>Sincronizando emisores y permisos de la sesión…</InfoCallout>'),
    ('        <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20">\n'
     '          <CardContent className="pt-6 text-sm text-informative">\n'
     '            Tu sesión no tiene emisores asignados para operar en Facturar. Contacta con un administrador.\n'
     '          </CardContent>\n'
     '        </Card>',
     '        <InfoCallout>Tu sesión no tiene emisores asignados para operar en Facturar. Contacta con un administrador.</InfoCallout>'),
    ('        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar factura por Gmail</h2>',
     '        <SectionTitle style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar factura por Gmail</SectionTitle>'),
    ('                      <Button\n'
     '                        type="button"\n'
     '                        variant="outline"\n'
     '                        disabled={archiveMutation.isPending}',
     '                      <Button\n'
     '                        type="button"\n'
     '                        variant="destructive"\n'
     '                        disabled={archiveMutation.isPending}'),
])
selects("src/features/invoices/pages/FacturarPage.tsx")
tokens("src/features/invoices/pages/FacturarPage.tsx")
neutralize("src/features/invoices/pages/FacturarPage.tsx")

# ---------------- Clientes
patch("src/features/clients/pages/ClientsPage.tsx", [
    ('import { PageHeader } from "@/features/shared/components/PageHeader";\n',
     'import { PageHeader } from "@/features/shared/components/PageHeader";\n'
     'import { EmptyState } from "@/components/ui/empty-state";\n'
     'import { Select } from "@/components/ui/select";\n'),
    ('                <Button\n'
     '                  type="button"\n'
     '                  variant="outline"\n'
     '                  disabled={archiveMutation.isPending || !canArchiveSelectedClient}',
     '                <Button\n'
     '                  type="button"\n'
     '                  variant="destructive"\n'
     '                  disabled={archiveMutation.isPending || !canArchiveSelectedClient}'),
    ('                <p className="p-3 text-informative">No hay clientes para ese filtro.</p>',
     '                <EmptyState>No hay clientes para ese filtro.</EmptyState>'),
])
selects("src/features/clients/pages/ClientsPage.tsx")
tokens("src/features/clients/pages/ClientsPage.tsx")
neutralize("src/features/clients/pages/ClientsPage.tsx")

# ---------------- Historial
patch("src/features/history/pages/HistoryPage.tsx", [
    ('import { PageHeader } from "@/features/shared/components/PageHeader";\n',
     'import { PageHeader } from "@/features/shared/components/PageHeader";\n'
     'import { EmptyState } from "@/components/ui/empty-state";\n'
     'import { InfoCallout } from "@/components/ui/info-callout";\n'
     'import { SectionTitle } from "@/components/ui/section-title";\n'
     'import { Select } from "@/components/ui/select";\n'),
    ('                <p className="p-3 text-informative">No hay documentos en el historial.</p>',
     '                <EmptyState>No hay documentos en el historial.</EmptyState>'),
    ('              <p className="text-informative">Selecciona un documento del listado para abrirlo.</p>',
     '              <EmptyState>Selecciona un documento del listado para abrirlo.</EmptyState>'),
    ('                  <p className="text-informative">Sin datos de documento.</p>',
     '                  <EmptyState>Sin datos de documento.</EmptyState>'),
    ('              <p className="p-3 text-informative">No hay documentos en papelera.</p>',
     '              <EmptyState>No hay documentos en papelera.</EmptyState>'),
    ('              <Button\n'
     '                type="button"\n'
     '                variant="outline"\n'
     '                onClick={() => archiveYearMutation.mutate()}',
     '              <Button\n'
     '                type="button"\n'
     '                variant="destructive"\n'
     '                onClick={() => archiveYearMutation.mutate()}'),
    ('                  <Button\n'
     '                    type="button"\n'
     '                    variant="outline"\n'
     '                    onClick={() => archiveDocumentMutation.mutate(selectedRecordId)}',
     '                  <Button\n'
     '                    type="button"\n'
     '                    variant="destructive"\n'
     '                    onClick={() => archiveDocumentMutation.mutate(selectedRecordId)}'),
    ('                    <Button\n'
     '                      type="button"\n'
     '                      size="sm"\n'
     '                      variant="outline"\n'
     '                      onClick={() => deleteTrashMutation.mutate(item.path)}',
     '                    <Button\n'
     '                      type="button"\n'
     '                      size="sm"\n'
     '                      variant="destructive"\n'
     '                      onClick={() => deleteTrashMutation.mutate(item.path)}'),
])
selects("src/features/history/pages/HistoryPage.tsx")
tokens("src/features/history/pages/HistoryPage.tsx")
neutralize("src/features/history/pages/HistoryPage.tsx")

# ---------------- Gastos
patch("src/features/expenses/pages/ExpensesPage.tsx", [
    ('import { PageHeader } from "@/features/shared/components/PageHeader";\n',
     'import { PageHeader } from "@/features/shared/components/PageHeader";\n'
     'import { EmptyState } from "@/components/ui/empty-state";\n'
     'import { InfoCallout } from "@/components/ui/info-callout";\n'
     'import { SectionTitle } from "@/components/ui/section-title";\n'
     'import { Select } from "@/components/ui/select";\n'),
    ('        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">\n'
     '          <CardContent className="pt-6 text-sm text-informative">\n'
     '            Tu sesión no tiene emisores asignados para operar en Gastos. Contacta con un administrador.\n'
     '          </CardContent>\n'
     '        </Card>',
     '        <InfoCallout>Tu sesión no tiene emisores asignados para operar en Gastos. Contacta con un administrador.</InfoCallout>'),
    ('              <h2 className="text-base font-semibold">Importar gastos</h2>',
     '              <SectionTitle>Importar gastos</SectionTitle>'),
    ('                <h2 id="expense-labels-modal-heading" className="text-lg font-semibold tracking-tight">\n'
     '                  Editar etiquetas de gastos\n'
     '                </h2>',
     '                <SectionTitle id="expense-labels-modal-heading">\n'
     '                  Editar etiquetas de gastos\n'
     '                </SectionTitle>'),
    ('                <h3 className="text-base font-semibold">Proveedores</h3>',
     '                <SectionTitle as="h3">Proveedores</SectionTitle>'),
    ('                <h3 className="text-base font-semibold">Conceptos del gasto</h3>',
     '                <SectionTitle as="h3">Conceptos del gasto</SectionTitle>'),
    ('              <p className="p-3 text-informative">No hay gastos en papelera.</p>',
     '              <EmptyState>No hay gastos en papelera.</EmptyState>'),
    ('                    <p className="p-3 text-sm text-informative">No hay etiquetas en esta lista.</p>',
     '                    <EmptyState>No hay etiquetas en esta lista.</EmptyState>'),
    ('                  <Button type="button" variant="outline" onClick={() => archiveYearMutation.mutate()} disabled={archiveYearMutation.isPending}>',
     '                  <Button type="button" variant="destructive" onClick={() => archiveYearMutation.mutate()} disabled={archiveYearMutation.isPending}>'),
    ('                <Button\n'
     '                  type="button"\n'
     '                  variant="outline"\n'
     '                  onClick={() => archiveExpenseMutation.mutate(selectedRecordId)}',
     '                <Button\n'
     '                  type="button"\n'
     '                  variant="destructive"\n'
     '                  onClick={() => archiveExpenseMutation.mutate(selectedRecordId)}'),
    ('                    <Button\n'
     '                      type="button"\n'
     '                      size="sm"\n'
     '                      variant="outline"\n'
     '                      onClick={() => deleteTrashMutation.mutate(item.path)}',
     '                    <Button\n'
     '                      type="button"\n'
     '                      size="sm"\n'
     '                      variant="destructive"\n'
     '                      onClick={() => deleteTrashMutation.mutate(item.path)}'),
    ('                                  <Button\n'
     '                                    type="button"\n'
     '                                    variant="ghost"\n'
     '                                    size="sm"\n'
     '                                    className="h-8 px-2 text-red-600 hover:text-red-700"\n'
     '                                    disabled={archiveExpenseMutation.isPending}',
     '                                  <Button\n'
     '                                    type="button"\n'
     '                                    variant="destructive"\n'
     '                                    size="sm"\n'
     '                                    className="h-8 px-2"\n'
     '                                    disabled={archiveExpenseMutation.isPending}'),
])
selects("src/features/expenses/pages/ExpensesPage.tsx")
tokens("src/features/expenses/pages/ExpensesPage.tsx")
neutralize("src/features/expenses/pages/ExpensesPage.tsx")

# ---------------- Configuracion
patch("src/features/settings/pages/SettingsPage.tsx", [
    ('import { Input } from "@/components/ui/input";\n',
     'import { Input } from "@/components/ui/input";\n'
     'import { EmptyState } from "@/components/ui/empty-state";\n'
     'import { InfoCallout } from "@/components/ui/info-callout";\n'
     'import { SectionTitle } from "@/components/ui/section-title";\n'
     'import { Select } from "@/components/ui/select";\n'
     'import { PageHeader } from "@/features/shared/components/PageHeader";\n'
     'import { workbookDataTableBase } from "@/features/shared/lib/workbookTableText";\n'),
    ('                <h2 className="text-base font-semibold">Integración Gmail</h2>',
     '                <SectionTitle>Integración Gmail</SectionTitle>'),
    ('              <h2 className="text-base font-semibold">Nueva base de diseño</h2>',
     '              <SectionTitle>Nueva base de diseño</SectionTitle>'),
    ('                <p className="text-informative">No hay emisores configurados.</p>',
     '                <EmptyState>No hay emisores configurados.</EmptyState>'),
    ('                      <p className="text-informative">No hay emisores con Gmail configurado.</p>',
     '                      <EmptyState>No hay emisores con Gmail configurado.</EmptyState>'),
])
selects("src/features/settings/pages/SettingsPage.tsx", skip_sr_only=True)
tokens("src/features/settings/pages/SettingsPage.tsx")
neutralize("src/features/settings/pages/SettingsPage.tsx")

print(">>> PAGES DONE")
print("MISSING ANCHORS:")
for m in missing:
    print("  -", m)
