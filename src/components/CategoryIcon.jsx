/** Icone di categoria coerenti per navigazione e card. */
export default function CategoryIcon({ category, size = 18, className = '' }) {
  const paths = {
    Tutti: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    Trattoria: <><path d="M5 3v7m3-7v7M3 3v7a3 3 0 0 0 6 0M6 13v8M17 3v18M17 3c-4 2-4 9 0 9" /></>,
    Pizzeria: <><path d="m4 20 5-16c5 1 9 5 11 10L4 20Z M8 7c4 1 7 4 9 8" /><circle cx="10" cy="12" r="1" /><circle cx="8" cy="16" r="1" /></>,
    'Ristorante Carne': <><path d="M15 4c5 0 7 6 4 10-2 3-5 5-9 6-5 1-9-2-7-6 1-3 5-3 7-5 2-2 1-5 5-5Z" /><circle cx="15" cy="9" r="2" /></>,
    'Ristorante Pesce': <><path d="M5 12c5-7 10-7 15 0-5 7-10 7-15 0ZM5 12 2 7v10l3-5Z" /><circle cx="16" cy="11" r=".5" /></>,
    Osteria: <><path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM12 14v7m-4 0h8" /></>,
    Paninoteca: <><path d="M3 10c0-8 18-8 18 0H3ZM3 14h18M3 18h18v2H3v-2Z" /></>,
    Agriturismo: <><path d="m12 2-7 8h4l-6 7h18l-6-7h4l-7-8ZM12 17v5" /></>,
    'Street Food': <><path d="M3 5h3l2 12h11l2-8H7M10 5h9M11 2v3m5-3v3" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[category] || paths.Trattoria}</svg>;
}
