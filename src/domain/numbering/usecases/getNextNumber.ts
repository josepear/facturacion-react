export type NumberingInput = {
  type: "factura" | "presupuesto";
  issueDate: string;
  series?: string;
  templateProfileId: string;
  recordId?: string;
  storageScope?: string;
  invoiceNumberTag?: string;
};

export type NumberAvailabilityResult = {
  ok: boolean;
  available: boolean;
  error?: string;
  canonicalNumber?: string;
};

export type NumberingPort = {
  fetchNextNumber: (input: NumberingInput) => Promise<{ number: string }>;
  fetchNumberAvailability: (input: NumberingInput & { number: string }) => Promise<NumberAvailabilityResult>;
};

let port: NumberingPort | null = null;

export function setNumberingPort(impl: NumberingPort) {
  port = impl;
}

function requirePort(): NumberingPort {
  if (!port) {
    throw new Error("NumberingPort not initialized. Call setNumberingPort() at app startup.");
  }
  return port;
}

export async function getNextNumber(input: NumberingInput) {
  const payload = await requirePort().fetchNextNumber(input);
  return payload.number;
}

export async function validateNumberAvailability(input: NumberingInput & { number: string }) {
  return requirePort().fetchNumberAvailability(input);
}
