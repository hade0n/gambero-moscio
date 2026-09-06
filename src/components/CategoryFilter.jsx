import { FILTER_CATEGORIES } from '../config/categories.js';

/**
 * Filtro categorie a scorrimento orizzontale (swipe su mobile).
 * Categoria attiva: fondo Fresh Green + peso maggiore. Cambio immediato.
 */
export default function CategoryFilter({ active, onChange }) {
  return (
    <nav aria-label="Filtra per categoria" className="border-b bg-cream">
      <ul
        className="mx-auto flex max-w-content snap-x gap-2.5 overflow-x-auto scroll-smooth px-4 py-3 scrollbar-hide md:px-6"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {FILTER_CATEGORIES.map((category) => {
          const isActive = category === active;
          return (
            <li key={category} className="snap-start">
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange(category)}
                className={`press inline-flex min-h-[46px] items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                  isActive
                    ? 'border-green-deep bg-green-deep font-bold text-white shadow-sm'
                    : 'border-brown/15 bg-cream-soft font-medium text-brown shadow-xs hover:border-green/50 hover:text-green-deep hover:shadow-sm'
                }`}
              >
                {category}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
