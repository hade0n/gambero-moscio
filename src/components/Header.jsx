import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

/**
 * Header PNDR: compatto, fondo panna, logo ufficiale (public/logo.svg).
 * Nell'interfaccia pubblica non c'è alcun collegamento al backend: l'area
 * riservata si raggiunge solo digitando /backend.
 * variant="admin" aggiunge lo stato "Area riservata" e il pulsante Esci.
 * Durante lo scroll l'header rinforza in modo molto discreto l'ombra.
 */
export default function Header({ variant = 'public', onLogout }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-cream/95 backdrop-blur-sm transition-shadow duration-200 ${
        scrolled ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 md:px-6">
        <Link
          to="/"
          className="press flex min-h-[44px] items-center rounded-lg py-1 pr-2"
          aria-label="PNDR — vai alla homepage"
        >
          <img
            src="/logo.svg"
            alt="PNDR — Recensioni per gente non da ristorante"
            width="694"
            height="348"
            className="h-10 w-auto sm:h-11"
          />
        </Link>

        {variant === 'admin' && (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-xs font-semibold text-green-deep sm:inline-flex">
              Area riservata
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Esci dall'area riservata"
              className="btn btn-outline btn-sm"
            >
              <Icon name="logout" size={18} />
              <span>Esci</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
