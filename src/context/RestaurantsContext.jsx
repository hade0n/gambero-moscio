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
import { authorizeAdminAction } from '../utils/auth.js';

const RestaurantsContext = createContext(null);

/**
 * Provider unico della collezione locali.
 * Home e Backend condividono questa stessa istanza: nessuna lista separata.
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
  const addRestaurant = useCallback(
    async (data) => {
      await authorizeAdminAction('POST');
      const record = normalizeRestaurant({ ...data, id: createId() });
      if (!record) throw new Error('I dati del locale non sono completi.');
      commit([record, ...restaurants]);
      return record;
    },
    [restaurants, commit],
  );

  const updateRestaurant = useCallback(
    async (id, data) => {
      await authorizeAdminAction('PUT');
      const next = restaurants.map((r) => {
        if (r.id !== id) return r;
        const merged = normalizeRestaurant({ ...r, ...data, id }); // id invariato
        return merged ?? r;
      });
      commit(next);
    },
    [restaurants, commit],
  );

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
      addRestaurant,
      updateRestaurant,
      deleteRestaurant,
      getRestaurant,
      compareByRanking,
    }),
    [restaurants, addRestaurant, updateRestaurant, deleteRestaurant, getRestaurant],
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
