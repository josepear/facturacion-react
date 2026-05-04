import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { AUTH_TOKEN_STORAGE_KEY } from "@/infrastructure/api/httpClient";

beforeEach(() => {
  try {
    globalThis.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, "vitest-bearer-token");
  } catch {
    // sin localStorage en entorno raro
  }
});

afterEach(() => {
  cleanup();
  try {
    globalThis.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
});

vi.mock("@tanstack/react-query", async () => {
  const React = await import("react");

  const useQuery = <TData,>({
    queryFn,
    enabled = true,
  }: {
    queryFn: () => Promise<TData> | TData;
    enabled?: boolean;
  }) => {
    const [data, setData] = React.useState<TData | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(Boolean(enabled));
    const [error, setError] = React.useState<Error | null>(null);
    const queryFnRef = React.useRef(queryFn);
    queryFnRef.current = queryFn;

    React.useEffect(() => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }
      let active = true;
      setIsLoading(true);
      Promise.resolve(queryFnRef.current())
        .then((value) => {
          if (!active) {
            return;
          }
          setData(value);
          setError(null);
        })
        .catch((err) => {
          if (!active) {
            return;
          }
          setError(err as Error);
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [enabled]);

    const isSuccess = Boolean(!isLoading && !error && data !== undefined);
    const isError = Boolean(error);

    return { data, isLoading, error, isSuccess, isError };
  };

  const useMutation = <TArg, TData>({
    mutationFn,
    onSuccess,
    onError,
  }: {
    mutationFn: (arg: TArg) => Promise<TData> | TData;
    onSuccess?: (data: TData) => void | Promise<void>;
    onError?: (error: Error) => void;
  }) => {
    const [isPending, setIsPending] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    const mutateAsync = async (arg: TArg) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await Promise.resolve(mutationFn(arg));
        await onSuccess?.(result);
        return result;
      } catch (err) {
        const safeError = err as Error;
        setError(safeError);
        onError?.(safeError);
        throw safeError;
      } finally {
        setIsPending(false);
      }
    };

    return {
      mutate: (arg: TArg) => {
        void mutateAsync(arg).catch(() => {
          /* `onError` ya se invocó; `mutate` en producción no propaga la promesa al llamador. */
        });
      },
      mutateAsync,
      isPending,
      error,
    };
  };

  class QueryClient {
    constructor() {
      // No-op test stub.
    }
  }

  return {
    QueryClient,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    useQuery,
    useMutation,
    useQueryClient: () => ({
      invalidateQueries: async () => undefined,
      removeQueries: async () => undefined,
      clear: async () => undefined,
      setQueryData: () => undefined,
    }),
  };
});

