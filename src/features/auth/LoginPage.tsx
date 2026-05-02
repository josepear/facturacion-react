import { type FormEvent, useLayoutEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/AuthContext";
import { useSessionQuery } from "@/features/shared/hooks/useSessionQuery";
import { getAuthToken } from "@/infrastructure/api/httpClient";

function safeNextParam(raw: string | null): string {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "";
  }
  return value;
}

export function LoginPage() {
  const { authVersion, login, logout, loginError, clearLoginError, isLoginPending } = useAuth();
  void authVersion;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNextParam(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const hasToken = Boolean(getAuthToken());
  const sessionQuery = useSessionQuery();

  useLayoutEffect(() => {
    if (hasToken && sessionQuery.isSuccess && sessionQuery.data && sessionQuery.data.authenticated === false) {
      logout();
    }
  }, [hasToken, sessionQuery.isSuccess, sessionQuery.data, logout]);

  /** Con token y error de red/API: quedarse aquí para recuperación; si no hay error, ir a la app y validar allí (legacy-like). */
  if (hasToken && sessionQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Hay un token guardado pero no se pudo validar con el servidor (red o sesión caducada).
        </p>
        <Button type="button" variant="outline" onClick={() => logout()}>
          Olvidar token y volver al acceso
        </Button>
      </div>
    );
  }

  /** Evita bucle con `/facturar` si el servidor devuelve `authenticated: false` antes de limpiar token. */
  if (hasToken && sessionQuery.isSuccess && sessionQuery.data && sessionQuery.data.authenticated === false) {
    return null;
  }

  if (hasToken) {
    return <Navigate to={next || "/facturar"} replace />;
  }

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
          <p className="text-xs text-muted-foreground">Mismas credenciales que en la app de facturación.</p>
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
