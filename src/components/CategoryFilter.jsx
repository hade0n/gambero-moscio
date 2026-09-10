import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn.js';
import { FILTER_CATEGORIES } from '../config/categories.js';

/**
 * Filtro categorie a scorrimento orizzontale (swipe su mobile).
 * Categoria attiva: pill piena Fresh Green con indicatore condiviso (`layoutId`)
 * che scivola tra le voci. Le sfumature ai bordi compaiono SOLO quando c'è
 * davvero contenuto nascosto in quella direzione (a riposo, allineato a
 * sinistra, non c'è nessuna sfumatura). Al cambio, la pill scelta si centra.
 */
export default function CategoryFilter({ active, onChange }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  };

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, []);

  const select = (category, el) => {
    onChange(category);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };

  return (
    <nav aria-label="Filtra per categoria" className="relative border-b bg-cream">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-cream to-transparent transition-opacity duration-200 md:w-8',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-cream to-transparent transition-opacity duration-200 md:w-8',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />

      <ul
        ref={scrollerRef}
        className="mx-auto flex max-w-content gap-2 overflow-x-auto scroll-smooth px-4 py-3 scrollbar-hide md:px-6"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' }}
      >
        {FILTER_CATEGORIES.map((category) => {
          const isActive = category === active;
          return (
            <li key={category} style={{ scrollSnapAlign: 'center' }}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={(e) => select(category, e.currentTarget.closest('li'))}
                className={cn(
                  'press relative inline-flex min-h-[44px] items-center overflow-hidden whitespace-nowrap rounded-full border px-4 text-sm transition-colors',
                  isActive
                    ? 'border-green-deep text-white'
                    : 'border-brown/15 bg-cream-soft font-medium text-brown shadow-xs hover:border-green/50 hover:text-green-deep',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="category-active"
                    className="absolute inset-0 bg-green-deep"
                    transition={{ type: 'spring', stiffness: 480, damping: 40, mass: 0.6 }}
                  />
                )}
                <span className={cn('relative z-10', isActive && 'font-bold')}>{category}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
