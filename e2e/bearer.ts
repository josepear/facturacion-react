import { e2eEnv } from "./env";

type LoginResponseShape = {
  token?: string;
  accessToken?: string;
  bearer?: string;
  jwt?: string;
  data?: {
    token?: string;
    accessToken?: string;
    bearer?: string;
    jwt?: string;
  };
  error?: string;
  message?: string;
};

type LoginAttempt = {
  pathname: string;
  body: Record<string, string>;
  label: string;
};

function pickToken(payload: LoginResponseShape | null): string {
  const candidates = [
    payload?.token,
    payload?.accessToken,
    payload?.bearer,
    payload?.jwt,
    payload?.data?.token,
    payload?.data?.accessToken,
    payload?.data?.bearer,
    payload?.data?.jwt,
  ];

  const token = candidates.find((value) => typeof value === "string" && value.trim());
  return String(token || "").trim();
}

export async function fetchBearerToken(): Promise<string> {
  const email = process.env.E2E_USER_EMAIL?.trim();
  const password = process.env.E2E_USER_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("Faltan E2E_USER_EMAIL o E2E_USER_PASSWORD en .env.e2e para autenticar E2E.");
  }

  const attempts: LoginAttempt[] = [
    { pathname: "/login", body: { email, password }, label: "POST /login {email,password}" },
    { pathname: "/api/login", body: { email, password }, label: "POST /api/login {email,password}" },
    { pathname: "/login", body: { username: email, password }, label: "POST /login {username,password}" },
    { pathname: "/api/login", body: { username: email, password }, label: "POST /api/login {username,password}" },
  ];

  const failures: string[] = [];

  for (const attempt of attempts) {
    const url = new URL(attempt.pathname, e2eEnv.apiTarget).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt.body),
    });

    const rawBody = await response.text();
    const data = ((): LoginResponseShape | null => {
      try {
        return rawBody ? (JSON.parse(rawBody) as LoginResponseShape) : null;
      } catch {
        return null;
      }
    })();

    if (response.ok) {
      const token = pickToken(data);
      if (!token) {
        failures.push(`${attempt.label} -> ${url}: 200 sin token`);
        continue;
      }
      return token;
    }

    const reason = data?.error || data?.message || response.statusText;
    const preview = rawBody.replace(/\s+/g, " ").slice(0, 140);
    failures.push(`${attempt.label} -> ${url}: ${response.status} ${reason}. ${preview}`);
  }

  throw new Error(
    [
      `Login E2E falló para ${email} contra ${e2eEnv.apiTarget}.`,
      "Intentos realizados:",
      ...failures.map((line) => `- ${line}`),
    ].join("\n"),
  );
}
