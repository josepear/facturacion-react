import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { AuthProvider } from "@/features/auth/AuthContext";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function createHookWrapper() {
  const queryClient = createTestQueryClient();
  return function HookWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

/** Sin `MemoryRouter`: los tests suelen mockear `useSearchParams` / `useNavigate`; evita duplicar React con react-router en Vitest. */
export function createPageWrapper() {
  const queryClient = createTestQueryClient();
  return function PageWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

