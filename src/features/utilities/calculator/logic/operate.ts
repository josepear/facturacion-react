import Big from "big.js";

export default function operate(numberOne: string | null, numberTwo: string | null, operation: string): string {
  const one = Big(numberOne || "0");
  const two = Big(numberTwo || (operation === "÷" || operation === "x" ? "1" : "0"));

  if (operation === "+") {
    return one.plus(two).toString();
  }
  if (operation === "-") {
    return one.minus(two).toString();
  }
  if (operation === "x") {
    return one.times(two).toString();
  }
  if (operation === "÷") {
    if (two.eq(0)) {
      return "Error";
    }
    return one.div(two).toString();
  }
  throw new Error(`Unknown operation '${operation}'`);
}
