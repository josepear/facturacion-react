import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { SESSION_QUERY_KEY } from "@/features/auth/sessionQueryKey";
import { loginWithPassword } from "@/infrastructure/api/authApi";
import { AUTH_STORAGE_EVENT, clearAuthToken, setAuthToken } from "@/infrastructure/api/httpClient";

type AuthContextValue = {
  /** Se incrementa al iniciar/cerrar sesión para que los consumidores vuelvan a leer el token y React Query refresque. */
  authVersion: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loginError: string | null;
  clearLoginError: () => void;
  isLoginPending: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [authVersion, setAuthVersion] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoginPending, setIsLoginPending] = useState(false);

  useEffect(() => {
    const bump = () => setAuthVersion((value) => value + 1);
    globalThis.addEventListener(AUTH_STORAGE_EVENT, bump);
    return () => globalThis.removeEventListener(AUTH_STORAGE_EVENT, bump);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoginError(null);
      setIsLoginPending(true);
      try {
        const { token } = await loginWithPassword(email, password);
        setAuthToken(token);
        setAuthVersion((value) => value + 1);
        /** No esperar refetch: la app entra ya; `/api/session` valida en segundo plano (paridad con legacy). */
        void queryClient.invalidateQueries({ queryKey: [...SESSION_QUERY_KEY] });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
        setLoginError(message);
        throw error;
      } finally {
        setIsLoginPending(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    setLoginError(null);
    clearAuthToken();
    queryClient.clear();
  }, [queryClient]);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const value = useMemo(
    () => ({
      authVersion,
      login,
      logout,
      loginError,
      clearLoginError,
      isLoginPending,
    }),
    [authVersion, login, logout, loginError, clearLoginError, isLoginPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook no-componente: Fast Refresh solo aplica a exports de componentes. */
// eslint-disable-next-line react-refresh/only-export-components -- useAuth es el consumidor del contexto
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return ctx;
}
