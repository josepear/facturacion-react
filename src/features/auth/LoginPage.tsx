import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useLayoutEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/AuthContext";
import { SESSION_QUERY_KEY } from "@/features/auth/sessionQueryKey";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { ApiError, getAuthToken } from "@/infrastructure/api/httpClient";

function safeNextParam(raw: string | null): string {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "";
  }
  return value;
}

/** Sin token: no monta `useSessionQuery` → no petición a `/api/session`. */
function LoginFormOnly() {
  const { authVersion, login, loginError, clearLoginError, isLoginPending } = useAuth();
  void authVersion;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNextParam(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearLoginError();
    try {
      await login(email, password);
      navigate(next || "/facturar", { replace: true });
    } catch {
      // loginError ya fijado en AuthProvider
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Iniciar sesión</h1>
          <p className="text-informative">Mismas credenciales que en la app de facturación.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="Email o identificador">
            <Input
              type="text"
              autoComplete="username"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              autoComplete="current-password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}

          <Button type="submit" className="w-full" disabled={isLoginPending}>
            {isLoginPending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Con token en URL de login: validación en background; recovery si la query falla. */
function LoginWithTokenGate() {
  const { authVersion, logout } = useAuth();
  void authVersion;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = safeNextParam(searchParams.get("next"));
  const sessionQuery = useSessionQuery();

  useLayoutEffect(() => {
    if (sessionQuery.isSuccess && sessionQuery.data && sessionQuery.data.authenticated === false) {
      logout();
    }
  }, [sessionQuery.isSuccess, sessionQuery.data, logout]);

  if (sessionQuery.isError) {
    const err = sessionQuery.error;
    const is401 = err instanceof ApiError && err.status === 401;
    if (is401) {
      return null;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="max-w-sm text-center text-informative">
          Hay un token guardado pero no se pudo validar con el servidor (red temporal o servidor
          reiniciando). Puedes reintentar o cerrar sesión y volver a entrar.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: [...SESSION_QUERY_KEY] });
            }}
          >
            Reintentar
          </Button>
          <Button type="button" variant="outline" onClick={() => logout()}>
            Olvidar token
          </Button>
        </div>
      </div>
    );
  }

  if (sessionQuery.isSuccess && sessionQuery.data && sessionQuery.data.authenticated === false) {
    return null;
  }

  return <Navigate to={next || "/facturar"} replace />;
}

export function LoginPage() {
  const hasToken = Boolean(getAuthToken());
  if (!hasToken) {
    return <LoginFormOnly />;
  }
  return <LoginWithTokenGate />;
}
