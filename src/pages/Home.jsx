import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Header from '../components/Header.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';
import RestaurantList from '../components/RestaurantList.jsx';
import RestaurantModal from '../components/RestaurantModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { RestaurantListSkeleton } from '../components/Skeleton.jsx';
import { useRestaurants } from '../hooks/useRestaurants.js';
import { compareByRanking } from '../utils/ratings.js';
import { ALL } from '../config/categories.js';

/** Homepage pubblica: filtro categorie + classifica ordinata per voto complessivo. */
export default function Home() {
  const { restaurants, status, error, refetch } = useRestaurants();
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [selected, setSelected] = useState(null);

  const ranked = useMemo(() => {
    // In classifica compaiono solo i locali con almeno una recensione pubblicata.
    const reviewed = restaurants.filter((r) => r.reviewCount > 0);
    const filtered =
      activeCategory === ALL
        ? reviewed
        : reviewed.filter((r) => r.category === activeCategory);
    // Ordinata sul rankingScore ad alta precisione, non sull'overall arrotondato.
    return [...filtered].sort(compareByRanking);
  }, [restaurants, activeCategory]);

  const count = ranked.length;
  const showList = status === 'ready';

  return (
    <div className="min-h-dvh bg-cream">
      <Header />
      <CategoryFilter active={activeCategory} onChange={setActiveCategory} />

      <main className="mx-auto max-w-content px-4 py-7 md:px-6 md:py-12">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-[1.75rem] font-bold leading-tight sm:text-[2.25rem]">
            Classifica
          </h1>
          {showList && count > 0 && (
            <p className="pb-1 text-sm font-medium tabular text-brown-soft">
              {count === 1 ? '1 locale' : `${count} locali`}
            </p>
          )}
        </div>
        <p className="mt-1.5 max-w-prose text-sm text-brown-soft sm:text-[0.95rem]">
          {activeCategory === ALL
            ? 'Tutti i locali recensiti, ordinati per voto complessivo.'
            : `${activeCategory}, ordinati per voto complessivo.`}
        </p>

        <div className="mt-7">
          <AnimatePresence mode="wait">
            {status === 'loading' && (
              <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <RestaurantListSkeleton />
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  title="Non è stato possibile caricare i locali."
                  description={error || 'Controlla la connessione e riprova.'}
                  action={
                    <button type="button" onClick={() => refetch()} className="btn btn-primary">
                      Riprova
                    </button>
                  }
                />
              </motion.div>
            )}

            {showList && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <RestaurantList
                  restaurants={ranked}
                  onOpen={setSelected}
                  isFiltered={activeCategory !== ALL}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <RestaurantModal
        restaurant={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
