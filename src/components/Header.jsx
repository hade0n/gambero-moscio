import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import GamberoModal from './GamberoModal.jsx';
import { NAV_BUTTON_ARIA, NAV_BUTTON_LABEL } from '../config/wheelMessages.js';

/**
 * Header: fondo panna, nessun divisore, logo ufficiale (public/logo.svg).
 * Interfaccia pubblica: logo centrato. variant="admin": logo a sinistra + Esci a destra.
 * A destra c'è il pulsante «Il Gambero» che apre la Ruota (modal full screen).
 * Nessun collegamento al backend in pubblico.
 */
export default function Header({ variant = 'public', onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const [gamberoOpen, setGamberoOpen] = useState(false);
  const gamberoBtnRef = useRef(null);
  const isAdmin = variant === 'admin';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-cream/95 backdrop-blur-sm transition-shadow duration-150 ${
        scrolled ? 'shadow-sm' : 'shadow-none'
      }`}
    >
      <div
        className={`relative mx-auto flex max-w-content items-center px-3 md:px-6 ${
          isAdmin ? 'h-16' : 'h-24 md:h-[68px]'
        }`}
      >
        <Link
          to="/"
          className={`press flex min-h-[44px] items-center rounded-lg px-2 ${
            isAdmin ? '-ml-2' : 'absolute left-1/2 -translate-x-1/2'
          }`}
          aria-label="Gambero Moscio - Recensioni Locali — vai alla homepage"
        >
          <img
            src="/logo.svg"
            alt="Gambero Moscio - Recensioni Locali"
            width="785"
            height="288"
            className={isAdmin ? 'h-10 w-auto sm:h-11' : 'h-16 w-auto sm:h-20 md:h-[52px]'}
          />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            ref={gamberoBtnRef}
            type="button"
            onClick={() => setGamberoOpen(true)}
            aria-label={NAV_BUTTON_ARIA}
            aria-haspopup="dialog"
            className="btn btn-secondary btn-sm shrink-0 px-3.5 text-sm sm:px-4"
          >
            <span>{NAV_BUTTON_LABEL}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Esci dall'area riservata"
              className="btn btn-outline btn-sm"
            >
              <Icon name="logout" size={18} />
              <span>Esci</span>
            </button>
          )}
        </div>
      </div>

      <GamberoModal
        open={gamberoOpen}
        onClose={() => setGamberoOpen(false)}
        triggerRef={gamberoBtnRef}
      />
    </header>
  );
}
