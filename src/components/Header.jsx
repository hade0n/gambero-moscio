import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

/**
 * Header PNDR: fondo panna, nessun divisore, logo ufficiale (public/logo.svg) grande.
 * Interfaccia pubblica: su mobile il logo è centrato, da `md` allineato a sinistra.
 * variant="admin": logo a sinistra + stato "Area riservata" e pulsante Esci a destra.
 * Nessun collegamento al backend in pubblico (l'area riservata si apre solo via /backend).
 * Durante lo scroll l'header rinforza in modo molto discreto l'ombra.
 */
export default function Header({ variant = 'public', onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const isAdmin = variant === 'admin';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-cream/95 backdrop-blur-sm transition-shadow duration-200 ${
        scrolled ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      <div
        className={`relative mx-auto flex max-w-content items-center px-4 md:px-6 ${
          isAdmin ? 'h-16' : 'h-24 md:h-28'
        }`}
      >
        <Link
          to="/"
          className={`press flex min-h-[44px] items-center rounded-lg px-2 ${
            isAdmin
              ? '-ml-2'
              : 'absolute left-1/2 -translate-x-[calc(50%+18px)] md:static md:left-auto md:translate-x-0'
          }`}
          aria-label="PNDR — vai alla homepage"
        >
          <img
            src="/logo.svg"
            alt="PNDR — Recensioni per gente non da ristorante"
            width="694"
            height="156"
            className={isAdmin ? 'h-10 w-auto sm:h-11' : 'h-16 w-auto sm:h-20 md:h-24'}
          />
        </Link>

        {isAdmin && (
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
