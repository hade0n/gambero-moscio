import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  STORAGE_KEY,
  createId,
  loadRestaurants,
  normalizeRestaurant,
  readRestaurantsFromStorage,
  saveRestaurants,
} from '../utils/storage.js';
import { compareByRanking } from '../utils/ratings.js';
import { isReviewer } from '../config/users.js';
import { authorizeAdminAction } from '../utils/auth.js';

const RestaurantsContext = createContext(null);

/** Campi condivisi del locale (non appartengono alle singole recensioni). */
const PLACE_FIELDS = ['name', 'category', 'town', 'province', 'imageUrl', 'dishImages'];

function pickPlaceFields(data) {
  const out = {};
  PLACE_FIELDS.forEach((k) => {
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

/**
 * Provider unico della collezione locali.
 * Home e Backend condividono questa stessa istanza: nessuna lista separata.
 * Un locale = dati condivisi + fino a due recensioni indipendenti (`reviews`).
 */
export function RestaurantsProvider({ children }) {
  const [restaurants, setRestaurants] = useState(() => loadRestaurants());

  // Sincronizzazione fra tab: se un'altra scheda modifica lo storage, riallineiamo.
  useEffect(() => {
    function onStorage(event) {
      if (event.key === STORAGE_KEY) {
        setRestaurants(readRestaurantsFromStorage());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Applica un aggiornamento allo stato e allo storage in modo atomico. */
  const commit = useCallback((nextList) => {
    saveRestaurants(nextList); // può lanciare: il chiamante gestisce l'errore
    setRestaurants(nextList);
  }, []);

  // Ogni operazione amministrativa è prima autorizzata dal server
  // (`/api/restaurants`): senza sessione valida non viene scritta in localStorage.

  /** Crea un solo locale condiviso (nessuna recensione automatica). */
  const createPlace = useCallback(
    async (data) => {
      await authorizeAdminAction('POST');
      const record = normalizeRestaurant({
        ...pickPlaceFields(data),
        id: createId(),
        reviews: {},
      });
      if (!record) throw new Error('I dati del locale non sono completi.');
      commit([record, ...restaurants]);
      return record;
    },
    [restaurants, commit],
  );

  /** Aggiorna solo i dati condivisi del locale: le recensioni restano intatte. */
  const updatePlace = useCallback(
    async (id, data) => {
      await authorizeAdminAction('PUT');
      const next = restaurants.map((r) => {
        if (r.id !== id) return r;
        const merged = normalizeRestaurant({
          ...r,
          ...pickPlaceFields(data),
          reviews: r.reviews,
          id,
        });
        return merged ?? r;
      });
      commit(next);
    },
    [restaurants, commit],
  );

  /**
   * Inserisce o sostituisce la recensione di un singolo utente su un locale
   * esistente. Non tocca la recensione dell'altro utente né i dati del locale.
   */
  const saveReview = useCallback(
    async (id, user, reviewData) => {
      if (!isReviewer(user)) throw new Error('Utente non valido.');
      await authorizeAdminAction('PUT');
      const next = restaurants.map((r) => {
        if (r.id !== id) return r;
        const merged = normalizeRestaurant({
          ...r,
          reviews: {
            ...r.reviews,
            [user]: { ratings: reviewData.ratings, review: reviewData.review },
          },
          id,
        });
        return merged ?? r;
      });
      commit(next);
    },
    [restaurants, commit],
  );

  /** Elimina l'intero locale (con entrambe le recensioni). */
  const deleteRestaurant = useCallback(
    async (id) => {
      await authorizeAdminAction('DELETE');
      commit(restaurants.filter((r) => r.id !== id));
    },
    [restaurants, commit],
  );

  const getRestaurant = useCallback(
    (id) => restaurants.find((r) => r.id === id) ?? null,
    [restaurants],
  );

  const value = useMemo(
    () => ({
      restaurants,
      createPlace,
      updatePlace,
      saveReview,
      deleteRestaurant,
      getRestaurant,
      compareByRanking,
    }),
    [restaurants, createPlace, updatePlace, saveReview, deleteRestaurant, getRestaurant],
  );

  return <RestaurantsContext.Provider value={value}>{children}</RestaurantsContext.Provider>;
}

export function useRestaurants() {
  const ctx = useContext(RestaurantsContext);
  if (!ctx) {
    throw new Error('useRestaurants deve essere usato dentro <RestaurantsProvider>.');
  }
  return ctx;
}
