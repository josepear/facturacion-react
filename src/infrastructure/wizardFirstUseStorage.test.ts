import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY,
  FIRST_USE_WIZARD_REACT_SEEN_KEY,
  hasFirstUseWizardBeenDismissed,
  markFirstUseWizardDismissed,
} from "./wizardFirstUseStorage";

function mockStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  const store = {
    getItem: vi.fn((key: string) => (map.has(key) ? map.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
  };
  vi.stubGlobal("localStorage", store);
  return { map };
}

describe("wizardFirstUseStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hasFirstUseWizardBeenDismissed is true when only react key is set", () => {
    mockStorage({ [FIRST_USE_WIZARD_REACT_SEEN_KEY]: "1" });
    expect(hasFirstUseWizardBeenDismissed()).toBe(true);
  });

  it("hasFirstUseWizardBeenDismissed is true when only legacy key is set", () => {
    mockStorage({ [FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY]: "1" });
    expect(hasFirstUseWizardBeenDismissed()).toBe(true);
  });

  it("hasFirstUseWizardBeenDismissed is false when neither key is set", () => {
    mockStorage();
    expect(hasFirstUseWizardBeenDismissed()).toBe(false);
  });

  it("markFirstUseWizardDismissed sets both keys", () => {
    const { map } = mockStorage();
    markFirstUseWizardDismissed();
    expect(map.get(FIRST_USE_WIZARD_REACT_SEEN_KEY)).toBe("1");
    expect(map.get(FIRST_USE_WIZARD_LEGACY_DISMISSED_KEY)).toBe("1");
  });
});
