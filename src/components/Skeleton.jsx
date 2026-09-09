import { cn } from '../lib/cn.js';

/**
 * Blocco segnaposto per gli stati di caricamento. Pulsazione discreta di sola
 * opacità (azzerata da `prefers-reduced-motion` via `motion-reduce`).
 */
export function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-brown/8 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

/** Card fantasma con le stesse proporzioni di RestaurantCard. */
export function RestaurantCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-brown/10 bg-cream-soft shadow-sm">
      <Skeleton className="aspect-[3/2] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-auto border-t border-brown/8 pt-3">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}

/** Griglia di card fantasma, stessa struttura di RestaurantList. */
export function RestaurantListSkeleton({ count = 6 }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="h-full">
          <RestaurantCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Righe fantasma per l'elenco amministrativo. */
export function AdminListSkeleton({ count = 4 }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="surface flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-11 w-24 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
