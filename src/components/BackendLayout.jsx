import Header from './Header.jsx';
import SectionHeader from './SectionHeader.jsx';

/** Cornice dell'area amministrativa: stessa identità visiva della homepage. */
export default function BackendLayout({ onLogout, title, description, action, children }) {
  return (
    <div className="min-h-dvh bg-cream">
      <Header variant="admin" onLogout={onLogout} />
      <main className="mx-auto max-w-content px-4 py-7 md:px-6 md:py-12">
        <SectionHeader title={title} description={description} />
        {action && <div className="mt-5">{action}</div>}
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
