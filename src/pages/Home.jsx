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
import Icon from '../components/Icon.jsx';
import ProvinceFilter from '../components/ProvinceFilter.jsx';

/** Homepage pubblica: filtro categorie + classifica ordinata per voto complessivo. */
export default function Home() {
  const { restaurants, status, error, refetch } = useRestaurants();
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('');
  const rankingPositions = useMemo(() => new Map(restaurants.filter((r) => r.reviewCount > 0).sort(compareByRanking).map((r, index) => [r.id, index + 1])), [restaurants]);
  const provinces = useMemo(() => [...new Set(restaurants.filter((r) => r.reviewCount > 0).map((r) => r.province).filter(Boolean))].sort(), [restaurants]);
  const normalizeSearch = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');

  const ranked = useMemo(() => {
    // In classifica compaiono solo i locali con almeno una recensione pubblicata.
    const reviewed = restaurants.filter((r) => r.reviewCount > 0);
    const filtered =
      activeCategory === ALL
        ? reviewed
        : reviewed.filter((r) => r.category === activeCategory);
    // Ordinata sul rankingScore ad alta precisione, non sull'overall arrotondato.
    const search = normalizeSearch(query.trim());
    const visible = filtered.filter((r) => (!province || r.province === province) && (!search || normalizeSearch(`${r.name} ${r.town} ${r.category} ${r.province}`).includes(search)));
    return [...visible].sort(compareByRanking);
  }, [restaurants, activeCategory, query, province]);

  const count = ranked.length;
  const showList = status === 'ready';

  return (
    <div className="ranking-page min-h-dvh bg-cream">
      <Header categoryFilter={<CategoryFilter active={activeCategory} onChange={setActiveCategory} inline />} />
      <div className="lg:hidden"><CategoryFilter active={activeCategory} onChange={setActiveCategory} /></div>

      <main className="public-container ranking-main mx-auto max-w-content px-4 py-7 md:px-6 md:py-12">
        <div className="ranking-introduction">
        <div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="ranking-title font-display text-[1.75rem] font-bold leading-tight sm:text-[2.25rem]">
            Classifica
          </h1>
          {showList && count > 0 && (
            <p className="pb-1 text-sm font-medium tabular text-brown-soft lg:hidden">
              {count === 1 ? '1 locale' : `${count} locali`}
            </p>
          )}
        </div>
        <p className="ranking-description mt-1.5 max-w-prose text-sm text-brown-soft sm:text-[0.95rem]">
          {activeCategory === ALL
            ? 'Tutti i locali recensiti, ordinati per voto complessivo.'
            : `${activeCategory}, ordinati per voto complessivo.`}
        </p>
        </div>
        <div className="ranking-search-controls hidden lg:flex">
          <label className="ranking-search">
            <span className="sr-only">Cerca un locale, una città o una tipologia</span>
            <Icon name="search" size={22} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un locale, una città o una cucina…" />
          </label>
          <ProvinceFilter provinces={provinces} value={province} onChange={setProvince} />
        </div>
        </div>

        <div className="mt-7 lg:mt-9">
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <RestaurantList
                  restaurants={ranked}
                  positions={rankingPositions}
                  onOpen={setSelected}
                  isFiltered={activeCategory !== ALL || Boolean(query.trim()) || Boolean(province)}
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
