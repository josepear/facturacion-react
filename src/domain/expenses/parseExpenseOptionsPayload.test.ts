import { describe, expect, it } from "vitest";

import { parseExpenseOptionsPayload } from "@/domain/expenses/parseExpenseOptionsPayload";

describe("parseExpenseOptionsPayload", () => {
  it("reads vendors and categories from root object", () => {
    const r = parseExpenseOptionsPayload({
      vendors: [" A ", "B"],
      categories: ["Cat1"],
    });
    expect(r.vendors).toEqual(["A", "B"]);
    expect(r.categories).toEqual(["Cat1"]);
  });

  it("unwraps expenseOptions and nested data", () => {
    const r = parseExpenseOptionsPayload({
      expenseOptions: {
        data: {
          vendors: ["V1"],
          categories: ["C1", "C2"],
        },
      },
    });
    expect(r.vendors).toEqual(["V1"]);
    expect(r.categories).toEqual(["C1", "C2"]);
  });

  it("prefers inner arrays over empty root", () => {
    const r = parseExpenseOptionsPayload({
      vendors: [],
      expenseOptions: { vendors: ["X"], categories: ["Y"] },
    });
    expect(r.vendors).toEqual(["X"]);
    expect(r.categories).toEqual(["Y"]);
  });

  it("returns empty arrays for invalid shapes", () => {
    expect(parseExpenseOptionsPayload(null)).toEqual({ vendors: [], categories: [] });
    expect(parseExpenseOptionsPayload({ vendors: "nope" })).toEqual({ vendors: [], categories: [] });
  });

  it("dedupes trimmed strings", () => {
    const r = parseExpenseOptionsPayload({
      vendors: ["Same", "Same", " Other "],
      categories: [],
    });
    expect(r.vendors).toEqual(["Same", "Other"]);
  });
});
