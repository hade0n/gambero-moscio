import Header from './Header.jsx';

/** Cornice dell'area amministrativa: stessa identità visiva della homepage. */
export default function BackendLayout({ onLogout, title, description, action, children }) {
  return (
    <div className="min-h-dvh bg-cream">
      <Header variant="admin" onLogout={onLogout} />
      <main className="mx-auto max-w-content px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
            {description && <p className="mt-1 text-sm text-brown-soft">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
