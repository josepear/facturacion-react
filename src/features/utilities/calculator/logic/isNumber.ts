/** Coincide con el comportamiento del proyecto de referencia (andrewagain/calculator). */
export default function isNumber(item: string): boolean {
  return /[0-9]+/.test(item);
}
