import { request } from "@/infrastructure/api/httpClient";

type NextNumberParams = {
  type: "factura" | "presupuesto";
  issueDate: string;
  series?: string;
  templateProfileId: string;
  recordId?: string;
  storageScope?: string;
};

export type NumberAvailabilityResponse = {
  ok: boolean;
  available: boolean;
  error?: string;
  canonicalNumber?: string;
};

export async function fetchNextNumber(params: NextNumberParams) {
  const query = new URLSearchParams({
    type: params.type,
    issueDate: params.issueDate,
    series: params.series ?? "",
    templateProfileId: params.templateProfileId,
  });
  if (params.storageScope === "sandbox") {
    query.set("storageScope", "sandbox");
  }

  return request<{ number: string }>(`/api/next-number?${query.toString()}`);
}

export async function fetchNumberAvailability(params: NextNumberParams & { number: string }) {
  const query = new URLSearchParams({
    number: params.number,
    type: params.type,
    issueDate: params.issueDate,
    templateProfileId: params.templateProfileId,
    series: params.series ?? "",
  });

  if (params.recordId) {
    query.set("recordId", params.recordId);
  }
  if (params.storageScope === "sandbox") {
    query.set("storageScope", "sandbox");
  }

  return request<NumberAvailabilityResponse>(`/api/document-number-availability?${query.toString()}`);
}
