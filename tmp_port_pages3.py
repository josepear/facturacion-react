G = "/Users/josemendoza/Repos/facturacion-react"


def patch(rel, pairs):
    with open(G + "/" + rel, encoding="utf-8") as fh:
        s = fh.read()
    for old, new in pairs:
        assert old in s, (rel, old[:70])
        s = s.replace(old, new)
    with open(G + "/" + rel, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched", rel)


patch("src/features/history/pages/HistoryPage.tsx", [
    ("        <Card>\n"
     '          <CardContent className="pt-6 text-sm text-informative">\n'
     "            Tu sesión no tiene emisores asignados para operar en Historial. Contacta con un administrador.\n"
     "          </CardContent>\n"
     "        </Card>",
     "        <InfoCallout>Tu sesión no tiene emisores asignados para operar en Historial. Contacta con un administrador.</InfoCallout>"),
])

patch("src/features/settings/pages/SettingsPage.tsx", [
    ("        <Card>\n"
     '          <CardContent className="pt-6 text-informative">Cargando configuración...</CardContent>\n'
     "        </Card>",
     "        <InfoCallout>Cargando configuración...</InfoCallout>"),
    ("        <Card>\n"
     '          <CardContent className="pt-6 text-sm">\n'
     "            <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />\n"
     "          </CardContent>\n"
     "        </Card>",
     "        <InfoCallout>\n"
     "          <SettingsConfigLoadError error={configQuery.error ?? sessionQuery.error} />\n"
     "        </InfoCallout>"),
    ("            <Card>\n"
     '              <CardContent className="pt-6 text-sm text-informative">\n'
     "                Tu sesión no tiene emisores asignados para operar en Configuración. Contacta con un administrador.\n"
     "              </CardContent>\n"
     "            </Card>",
     "            <InfoCallout>Tu sesión no tiene emisores asignados para operar en Configuración. Contacta con un administrador.</InfoCallout>"),
])

print("PAGES3 DONE")
