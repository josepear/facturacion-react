import { describe, expect, it } from "vitest";

import { normalizeTemplateProfilesFromApi } from "./runtimeTemplateProfiles";

describe("normalizeTemplateProfilesFromApi", () => {
  it("returns empty array for non-array input", () => {
    expect(normalizeTemplateProfilesFromApi(null)).toEqual([]);
    expect(normalizeTemplateProfilesFromApi({})).toEqual([]);
  });

  it("keeps standard profiles by id", () => {
    const raw = [
      { id: "jose-mendoza", label: "José Mendoza" },
      { id: "nacho", label: "Nacho" },
    ];
    expect(normalizeTemplateProfilesFromApi(raw)).toEqual([
      { id: "jose-mendoza", label: "José Mendoza" },
      { id: "nacho", label: "Nacho" },
    ]);
  });

  it("maps templateProfileId to id when id is absent", () => {
    const raw = [{ templateProfileId: "mari-angeles", label: "Mari Ángeles" }];
    expect(normalizeTemplateProfilesFromApi(raw)).toEqual([{ templateProfileId: "mari-angeles", label: "Mari Ángeles", id: "mari-angeles" }]);
  });

  it("prefers explicit id over templateProfileId", () => {
    const raw = [{ id: "desiree-delgado", templateProfileId: "ignored", label: "Desirée" }];
    expect(normalizeTemplateProfilesFromApi(raw)).toEqual([
      { id: "desiree-delgado", templateProfileId: "ignored", label: "Desirée" },
    ]);
  });

  it("coerces numeric id to string", () => {
    const raw = [{ id: 42, label: "X" }];
    expect(normalizeTemplateProfilesFromApi(raw)).toEqual([{ id: "42", label: "X" }]);
  });

  it("skips invalid entries and dedupes by id", () => {
    const raw = [
      null,
      "not-an-object",
      { label: "sin id" },
      { id: "dup", label: "Primera" },
      { id: "dup", label: "Segunda" },
    ];
    expect(normalizeTemplateProfilesFromApi(raw)).toEqual([{ id: "dup", label: "Primera" }]);
  });
});
