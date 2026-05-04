type PlaceholderModulePageProps = {
  title: string;
  description: string;
};

export function PlaceholderModulePage({ title, description }: PlaceholderModulePageProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-informative">{description}</p>
      </header>
      <section className="rounded-lg border bg-card p-4 text-informative">
        Módulo preparado en el shell principal. Se activará por fases manteniendo la lógica funcional del legacy.
      </section>
    </main>
  );
}
