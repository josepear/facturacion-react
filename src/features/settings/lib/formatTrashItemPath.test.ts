import { describe, expect, it } from "vitest";

import { formatTrashItemPath } from "./formatTrashItemPath";

describe("formatTrashItemPath", () => {
  it("extrae nombre de archivo y ruta relativa desde _papelera", () => {
    const long =
      "/Volumes/RAID/Datos/facturacion-central/storage/tenant-x/_papelera/gastos/2026/gasto-abc.json";
    const r = formatTrashItemPath(long);
    expect(r.primary).toBe("gasto-abc.json");
    expect(r.secondary).toContain("_papelera");
    expect(r.secondary).toContain("gastos");
  });

  it("acorta URLs largas", () => {
    const url =
      "https://cloud.ejemplo.com/remote.php/dav/files/user/very/long/path/to/archived%20file%20name.pdf";
    const r = formatTrashItemPath(url);
    expect(r.primary).toContain("archived");
    expect(r.secondary).toContain("cloud.ejemplo.com");
  });
});
