import { describe, expect, it } from "vitest";

import { DEFAULT_DESIGN, mergeDesign } from "@/domain/design/designConfig";

describe("mergeDesign", () => {
  it("devuelve los valores por defecto del backend cuando no hay diseño", () => {
    expect(mergeDesign(undefined)).toEqual(DEFAULT_DESIGN);
    expect(mergeDesign({})).toEqual(DEFAULT_DESIGN);
  });

  it("aplica clamp a tamaños y medidas fuera de rango", () => {
    const design = mergeDesign({ logoWidthMm: 999, bodySizePt: 1, detailSizePt: 99, titlePanelWidthMm: 0 });
    expect(design.logoWidthMm).toBe(45);
    expect(design.bodySizePt).toBe(6);
    expect(design.detailSizePt).toBe(12);
    expect(design.titlePanelWidthMm).toBe(28);
  });

  it("rechaza layouts y alineaciones desconocidas", () => {
    const design = mergeDesign({ layout: "otro", brandAlignX: "diagonal", brandAlignY: "arriba" });
    expect(design.layout).toBe("pear");
    expect(design.brandAlignX).toBe("center");
    expect(design.brandAlignY).toBe("center");
  });

  it("hereda detalle de texto base y concepto del título si faltan (migración)", () => {
    const design = mergeDesign({ bodySizePt: 9, itemTitleSizePt: 14 });
    expect(design.detailSizePt).toBe(9);
    expect(design.conceptSizePt).toBe(14);
  });

  it("acepta un diseño completo sin perder claves", () => {
    const design = mergeDesign({
      ...DEFAULT_DESIGN,
      layout: "editorial",
      accentColor: "#123456",
      darkColor: "#222222",
      itemConceptAlignX: "left",
      itemDetailAlignX: "left",
      contentAlign: "left",
    });
    expect(design.layout).toBe("editorial");
    expect(design.accentColor).toBe("#123456");
    expect(design.itemConceptAlignX).toBe("left");
    expect(design.itemDetailAlignX).toBe("left");
  });

  it("acota el tamaño del texto del proyecto y normaliza su alineación", () => {
    const design = mergeDesign({ projectNameSizePt: 2, projectAlignX: "otra" });
    expect(design.projectNameSizePt).toBe(6);
    expect(design.projectAlignX).toBe("left");

    const centered = mergeDesign({ projectNameSizePt: 12, projectAlignX: "center" });
    expect(centered.projectNameSizePt).toBe(12);
    expect(centered.projectAlignX).toBe("center");
  });
});
