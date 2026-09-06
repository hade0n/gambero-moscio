import Header from './Header.jsx';

/** Cornice dell'area amministrativa: stessa identità visiva della homepage. */
export default function BackendLayout({ onLogout, title, description, action, children }) {
  return (
    <div className="min-h-dvh bg-cream">
      <Header variant="admin" onLogout={onLogout} />
      <main className="mx-auto max-w-content px-3 py-6 md:px-6 md:py-10">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 text-sm text-brown-soft">{description}</p>}
        </div>
        {action && <div className="mt-5">{action}</div>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
