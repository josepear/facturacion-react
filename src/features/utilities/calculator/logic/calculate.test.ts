import { describe, expect, it } from "vitest";

import calculate, { type CalculatorData } from "./calculate";

function merge(prev: CalculatorData, button: string): CalculatorData {
  return { ...prev, ...calculate(prev, button) };
}

describe("calculate (referencia andrewagain/calculator)", () => {
  it("suma encadenada", () => {
    let s = merge({ total: null, next: null, operation: null }, "7");
    s = merge(s, "+");
    s = merge(s, "7");
    s = merge(s, "=");
    expect(s.total).toBe("14");
  });

  it("AC reinicia", () => {
    const s = merge({ total: "5", next: null, operation: null }, "AC");
    expect(s).toEqual({ total: null, next: null, operation: null });
  });

  it("divide entre cero devuelve Error", () => {
    let s = merge({ total: null, next: null, operation: null }, "5");
    s = merge(s, "÷");
    s = merge(s, "0");
    s = merge(s, "=");
    expect(s.total).toBe("Error");
  });
});
