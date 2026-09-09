import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import GamberoModal from './GamberoModal.jsx';
import { cn } from '../lib/cn.js';
import { NAV_BUTTON_ARIA, NAV_BUTTON_LABEL } from '../config/wheelMessages.js';

/**
 * Header: fondo panna, logo ufficiale ottime centrato (mobile e desktop).
 * Griglia a 3 tracce `[1fr auto 1fr]` così il logo resta centrato e la CTA
 * della Ruota vive nella sua traccia — nessuna sovrapposizione a 360px.
 * A scroll 0 l'header è piatto; scorrendo compaiono con delicatezza ombra e
 * velo. L'altezza non cambia mai (niente layout shift).
 */
export default function Header({ variant = 'public', onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const [gamberoOpen, setGamberoOpen] = useState(false);
  const gamberoBtnRef = useRef(null);
  const isAdmin = variant === 'admin';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-200 ease-pndr',
        scrolled ? 'bg-cream/90 shadow-sm backdrop-blur-sm' : 'bg-cream shadow-none',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-content items-center gap-3 px-4 md:px-6',
          isAdmin ? 'h-16' : 'grid grid-cols-[1fr_auto_1fr] h-[60px] md:h-[68px]',
        )}
      >
        <Link
          to="/"
          className={cn(
            'press flex min-h-[44px] items-center rounded-lg',
            isAdmin ? '-ml-1' : 'col-start-2 justify-self-center px-1',
          )}
          aria-label="Gambero Moscio - Recensioni Locali — vai alla homepage"
        >
          <img
            src="/logo.svg"
            alt="Gambero Moscio - Recensioni Locali"
            width="785"
            height="288"
            className={isAdmin ? 'h-10 w-auto sm:h-11' : 'h-10 w-auto sm:h-11 md:h-12'}
          />
        </Link>

        <div
          className={cn(
            'flex items-center gap-2 sm:gap-3',
            isAdmin ? 'ml-auto' : 'col-start-3 justify-self-end',
          )}
        >
          <button
            ref={gamberoBtnRef}
            type="button"
            onClick={() => setGamberoOpen(true)}
            aria-label={NAV_BUTTON_ARIA}
            aria-haspopup="dialog"
            className="btn btn-outline btn-sm w-11 shrink-0 justify-center px-0 sm:w-auto sm:gap-1.5 sm:px-3.5"
          >
            <Icon name="wheel" size={18} className="shrink-0" />
            <span className="hidden sm:inline">{NAV_BUTTON_LABEL}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Esci dall'area riservata"
              className="btn btn-secondary btn-sm"
            >
              <Icon name="logout" size={18} />
              <span className="hidden sm:inline">Esci</span>
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
