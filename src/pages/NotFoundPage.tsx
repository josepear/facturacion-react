import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Ruta no encontrada</h1>
      <p className="text-informative">Esta base solo expone el vertical slice técnico de Fase 0.</p>
      <Link className="text-sm font-medium underline" to="/">
        Volver al borrador
      </Link>
    </main>
  );
}
