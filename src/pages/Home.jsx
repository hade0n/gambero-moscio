import { useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';
import RestaurantList from '../components/RestaurantList.jsx';
import RestaurantModal from '../components/RestaurantModal.jsx';
import ShrimpWheelSection from '../components/ShrimpWheelSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
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

      <ShrimpWheelSection
        restaurants={ranked}
        contextStatus={status}
        categoryLabel={activeCategory === ALL ? null : activeCategory}
        onViewPlace={(place) => setSelected(restaurants.find((r) => r.id === place.id) ?? place)}
      />

      <main className="mx-auto max-w-content px-3 py-6 md:px-6 md:py-10">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-bold sm:text-[2rem]">Classifica</h1>
          {showList && count > 0 && (
            <p className="text-sm font-medium text-brown-soft">
              {count === 1 ? '1 locale' : `${count} locali`}
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-brown-soft">
          {activeCategory === ALL
            ? 'Tutti i locali recensiti, ordinati per voto complessivo.'
            : `${activeCategory}, ordinati per voto complessivo.`}
        </p>

        <div className="mt-6">
          {status === 'loading' && (
            <EmptyState
              title="Caricamento dei locali in corso…"
              description="Stiamo recuperando la classifica dall’archivio."
            />
          )}

          {status === 'error' && (
            <EmptyState
              title="Non è stato possibile caricare i locali."
              description={error || 'Controlla la connessione e riprova.'}
              action={
                <button type="button" onClick={() => refetch()} className="btn btn-primary">
                  Riprova
                </button>
              }
            />
          )}

          {showList && (
            <RestaurantList
              restaurants={ranked}
              onOpen={setSelected}
              isFiltered={activeCategory !== ALL}
            />
          )}
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
