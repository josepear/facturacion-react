import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, type PropsWithChildren } from "react";

import { AuthProvider } from "@/features/auth/AuthContext";

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Suspense>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}
