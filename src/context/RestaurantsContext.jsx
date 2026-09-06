import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError, getCollection, sendMutation } from '../utils/api.js';
import { compareByRanking } from '../utils/ratings.js';

const RestaurantsContext = createContext(null);

/** Intervallo di polling per la sincronizzazione fra dispositivi (ms). */
const POLL_INTERVAL = 12000;

/**
 * Provider unico della collezione locali — punto di sincronizzazione dell'app.
 *
 * I dati vivono nell'archivio centrale su Vercel Blob e si leggono/scrivono
 * solo tramite `/api/restaurants`. Non c'è più `localStorage` come fonte dati.
 *
 * - all'avvio: `GET /api/restaurants` (stato `loading` → `ready` | `error`);
 * - ogni ~12s (solo a scheda visibile) ricontrolla `version`/`updatedAt` e
 *   aggiorna lo stato solo se il documento è cambiato, senza reload;
 * - create / update / delete / recensioni: chiamano l'API e sostituiscono lo
 *   stato con il documento restituito dal server (fonte autorevole).
 */
export function RestaurantsProvider({ children }) {
  const [restaurants, setRestaurants] = useState([]);
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');

  // Riferimento sempre aggiornato alla versione corrente: il polling lo legge
  // senza dover ricreare l'intervallo a ogni cambiamento di stato.
  const versionRef = useRef(0);

  const applyDoc = useCallback((doc) => {
    versionRef.current = doc.version;
    setRestaurants(doc.restaurants);
    setVersion(doc.version);
    setUpdatedAt(doc.updatedAt);
    setStatus('ready');
    setError('');
  }, []);

  /** Carica (o ricarica) il documento completo dall'archivio. */
  const fetchCollection = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setStatus('loading');
      try {
        const doc = await getCollection();
        applyDoc(doc);
        return doc;
      } catch (err) {
        if (!silent) {
          setStatus('error');
          setError(err.message || 'Non è stato possibile caricare i locali.');
        }
        throw err;
      }
    },
    [applyDoc],
  );

  // Primo caricamento.
  useEffect(() => {
    fetchCollection().catch(() => {
      /* errore già riflesso in `status`/`error` */
    });
  }, [fetchCollection]);

  // Polling leggero + refetch quando la scheda torna in primo piano.
  useEffect(() => {
    let timer = null;

    async function poll() {
      if (document.hidden) return;
      try {
        const doc = await getCollection();
        // Aggiorna solo se il documento è davvero cambiato.
        if (doc.version !== versionRef.current) applyDoc(doc);
      } catch {
        /* problema di rete temporaneo: si riprova al giro successivo */
      }
    }

    function start() {
      if (timer) return;
      timer = window.setInterval(poll, POLL_INTERVAL);
    }
    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        poll();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', poll);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', poll);
    };
  }, [applyDoc]);

  /** Crea un solo locale condiviso (nessuna recensione automatica). */
  const createPlace = useCallback(async (data) => {
    const doc = await sendMutation('POST', { op: 'createPlace', data });
    applyDoc(doc);
    return doc;
  }, [applyDoc]);

  /** Aggiorna solo i dati condivisi del locale: le recensioni restano intatte. */
  const updatePlace = useCallback(async (id, data) => {
    const doc = await sendMutation('PUT', { op: 'updatePlace', id, data });
    applyDoc(doc);
    return doc;
  }, [applyDoc]);

  /**
   * Inserisce o sostituisce la propria recensione su un locale esistente.
   * L'utente NON viene passato dal client: il server lo ricava dalla sessione
   * autenticata e tocca solo la recensione di quell'utente.
   */
  const saveReview = useCallback(async (id, reviewData) => {
    const doc = await sendMutation('PUT', { op: 'saveReview', id, review: reviewData });
    applyDoc(doc);
    return doc;
  }, [applyDoc]);

  /** Elimina l'intero locale (con entrambe le recensioni). */
  const deleteRestaurant = useCallback(async (id) => {
    const doc = await sendMutation('DELETE', { id });
    applyDoc(doc);
    return doc;
  }, [applyDoc]);

  const getRestaurant = useCallback(
    (id) => restaurants.find((r) => r.id === id) ?? null,
    [restaurants],
  );

  const value = useMemo(
    () => ({
      restaurants,
      version,
      updatedAt,
      status,
      error,
      refetch: fetchCollection,
      createPlace,
      updatePlace,
      saveReview,
      deleteRestaurant,
      getRestaurant,
      compareByRanking,
    }),
    [
      restaurants,
      version,
      updatedAt,
      status,
      error,
      fetchCollection,
      createPlace,
      updatePlace,
      saveReview,
      deleteRestaurant,
      getRestaurant,
    ],
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

export { ApiError };
