import { fetchNextNumber, fetchNumberAvailability } from "@/infrastructure/api/numberingApi";

type NumberingInput = {
  type: "factura" | "presupuesto";
  issueDate: string;
  series?: string;
  templateProfileId: string;
  recordId?: string;
};

export async function getNextNumber(input: NumberingInput) {
  const payload = await fetchNextNumber(input);
  return payload.number;
}

export async function validateNumberAvailability(input: NumberingInput & { number: string }) {
  const payload = await fetchNumberAvailability(input);
  return payload;
}
