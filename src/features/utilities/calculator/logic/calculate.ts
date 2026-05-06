import Big from "big.js";

import isNumber from "./isNumber";
import operate from "./operate";

export type CalculatorData = {
  total: string | null;
  next: string | null;
  operation: string | null;
};

/** Fragmentos parciales que se fusionan con el estado (como `setState` del proyecto original). */
export type CalculatorPatch = Partial<CalculatorData>;

/**
 * Lógica adaptada de {@link https://github.com/andrewagain/calculator andrewagain/calculator} (MIT).
 */
export default function calculate(obj: CalculatorData, buttonName: string): CalculatorPatch {
  if (buttonName === "AC") {
    return {
      total: null,
      next: null,
      operation: null,
    };
  }

  if (isNumber(buttonName)) {
    if (buttonName === "0" && obj.next === "0") {
      return {};
    }
    if (obj.operation) {
      if (obj.next) {
        return { next: obj.next + buttonName };
      }
      return { next: buttonName };
    }
    if (obj.next) {
      const next = obj.next === "0" ? buttonName : obj.next + buttonName;
      return {
        next,
        total: null,
      };
    }
    return {
      next: buttonName,
      total: null,
    };
  }

  if (buttonName === "%") {
    if (obj.operation && obj.next) {
      const result = operate(obj.total, obj.next, obj.operation);
      if (result === "Error") {
        return { total: "Error", next: null, operation: null };
      }
      return {
        total: Big(result).div(Big("100")).toString(),
        next: null,
        operation: null,
      };
    }
    if (obj.next) {
      return {
        next: Big(obj.next).div(Big("100")).toString(),
      };
    }
    return {};
  }

  if (buttonName === ".") {
    if (obj.next) {
      if (obj.next.includes(".")) {
        return {};
      }
      return { next: `${obj.next}.` };
    }
    return { next: "0." };
  }

  if (buttonName === "=") {
    if (obj.next && obj.operation) {
      const total = operate(obj.total, obj.next, obj.operation);
      return {
        total,
        next: null,
        operation: null,
      };
    }
    return {};
  }

  if (buttonName === "+/-") {
    if (obj.next) {
      return { next: (-1 * Number.parseFloat(obj.next)).toString() };
    }
    if (obj.total && obj.total !== "Error") {
      return { total: (-1 * Number.parseFloat(obj.total)).toString() };
    }
    return {};
  }

  if (obj.operation) {
    const total = operate(obj.total, obj.next, obj.operation);
    return {
      total,
      next: null,
      operation: buttonName,
    };
  }

  if (!obj.next) {
    return { operation: buttonName };
  }

  return {
    total: obj.next,
    next: null,
    operation: buttonName,
  };
}
