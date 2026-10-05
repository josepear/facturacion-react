"""Bloque 3 port — parte 2: Historial (resto) + Configuración (resto)."""
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
            missing.append(rel + " :: " + old[:80].replace("\n", "\\n"))
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched", rel)


# ---------------- Historial (resto)
patch("src/features/history/pages/HistoryPage.tsx", [
    ('        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">\n'
     '          <CardContent className="pt-6 text-sm text-informative">\n'
     '            Tu sesión no tiene emisores asignados para operar en Historial. Contacta con un administrador.\n'
     '          </CardContent>\n'
     '        </Card>',
     '        <InfoCallout>Tu sesión no tiene emisores asignados para operar en Historial. Contacta con un administrador.</InfoCallout>'),
    ('        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar facturas por Gmail (lote)</h2>',
     '        <SectionTitle style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar facturas por Gmail (lote)</SectionTitle>'),
    ('        <h2 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar factura por Gmail</h2>',
     '        <SectionTitle style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }}>Enviar factura por Gmail</SectionTitle>'),
])

# ---------------- Configuración (resto)
patch("src/features/settings/pages/SettingsPage.tsx", [
    ('      <header className="space-y-1">\n'
     '        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración · Emisores</h1>\n'
     '        <p className="text-informative">\n'
     '          Gestiona emisores desde el listado: edita o borra cada fila y guarda los cambios en el servidor con «{SAVE} datos del\n'
     '          emisor». Independiente de «{SAVE} documento» en Facturar.\n'
     '        </p>\n'
     '      </header>',
     '      <PageHeader\n'
     '        title="Configuración · Emisores"\n'
     '        description={`Gestiona emisores desde el listado: edita o borra cada fila y guarda los cambios en el servidor con «${SAVE} datos del emisor». Independiente de «${SAVE} documento» en Facturar.`}\n'
     '      />'),
    ('        <Card className="border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">\n'
     '          <CardContent className="pt-6 text-informative">Cargando configuración...</CardContent>\n'
     '        </Card>',
     '        <InfoCallout>Cargando configuración...</InfoCallout>'),
    ('        <Card className="border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">\n'
     '          <CardContent className="pt-6 text-sm">\n'
     '            <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />\n'
     '          </CardContent>\n'
     '        </Card>',
     '        <InfoCallout>\n'
     '          <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />\n'
     '        </InfoCallout>'),
    ('            <Card className="border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">\n'
     '              <CardContent className="pt-6 text-sm text-informative">\n'
     '                Tu sesión no tiene emisores asignados para operar en Configuración. Contacta con un administrador.\n'
     '              </CardContent>\n'
     '            </Card>',
     '            <InfoCallout>Tu sesión no tiene emisores asignados para operar en Configuración. Contacta con un administrador.</InfoCallout>'),
    ('                  <table className="w-full min-w-[28rem] text-left text-sm">',
     '                  <table className={cn(workbookDataTableBase, "min-w-[28rem] text-left")}>'),
    ('                        <th className="px-3 py-2 font-medium">Nombre</th>',
     '                        <th className="p-2 font-medium">Nombre</th>'),
    ('                        <th className="px-3 py-2 font-medium">Email</th>',
     '                        <th className="p-2 font-medium">Email</th>'),
    ('                        <th className="px-3 py-2 font-medium text-right">Acciones</th>',
     '                        <th className="p-2 font-medium text-right">Acciones</th>'),
    ('                            className={cn("border-b border-border last:border-b-0", isRowSelected && "bg-muted/30")}',
     '                            className={cn("border-b border-border/70 last:border-b-0 hover:bg-muted/25", isRowSelected && "bg-muted/30")}'),
    ('                            <td className="px-3 py-2 align-middle">',
     '                            <td className="p-2 align-middle">'),
    ('                            <td className="max-w-[14rem] truncate px-3 py-2 align-middle text-informative" title={email || undefined}>',
     '                            <td className="max-w-[14rem] truncate p-2 align-middle text-informative" title={email || undefined}>'),
    ('                            <td className="whitespace-nowrap px-3 py-2 text-right align-middle">',
     '                            <td className="whitespace-nowrap p-2 text-right align-middle">'),
    ('                                <Button\n'
     '                                  type="button"\n'
     '                                  variant="ghost"\n'
     '                                  size="sm"\n'
     '                                  className="text-destructive hover:text-destructive"\n'
     '                                  disabled={!isAdmin || profiles.length <= 1}',
     '                                <Button\n'
     '                                  type="button"\n'
     '                                  variant="destructive"\n'
     '                                  size="sm"\n'
     '                                  disabled={!isAdmin || profiles.length <= 1}'),
])

print("PART2 DONE")
print("MISSING:")
for m in missing:
    print("  -", m)
