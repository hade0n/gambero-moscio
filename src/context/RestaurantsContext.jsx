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
const POLL_INTERVAL = 45000;

/**
 * Provider unico della collezione locali — punto di sincronizzazione dell'app.
 *
 * I dati vivono nell'archivio centrale su Supabase (tabella `places`) e si
 * leggono/scrivono solo tramite `/api/restaurants`. Niente `localStorage`.
 *
 * - all'avvio: `GET /api/restaurants` (stato `loading` → `ready` | `error`);
 * - create / update / delete / recensioni: chiamano l'API e SOSTITUISCONO lo
 *   stato con la collezione restituita dal server (fonte autorevole);
 * - polling ogni ~45s (solo a scheda visibile): confronta `signature` (hash
 *   di `id@updated_at` lato server) e applica solo se è cambiata. Una risposta di polling che "torna in corso" durante una
 *   mutazione viene scartata (contatore `mutationSeq`), così una modifica appena
 *   fatta non può essere sovrascritta da una lettura partita prima.
 */
export function RestaurantsProvider({ children }) {
  const [restaurants, setRestaurants] = useState([]);
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');

  const signatureRef = useRef('');
  // Incrementato a ogni mutazione andata a buon fine: identifica una risposta di
  // polling ormai superata.
  const mutationSeqRef = useRef(0);

  const applyDoc = useCallback((doc) => {
    signatureRef.current = doc.signature || '';
    setRestaurants(doc.restaurants);
    setVersion(doc.version);
    setUpdatedAt(doc.updatedAt);
    setStatus('ready');
    setError('');
  }, []);

  /** Carica (o ricarica) l'intera collezione dall'archivio. */
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
      const seqAtStart = mutationSeqRef.current;
      try {
        const doc = await getCollection();
        // Una mutazione è avvenuta mentre questa lettura era in corso: scartala,
        // lo stato è già più recente.
        if (seqAtStart !== mutationSeqRef.current) return;
        // Applica solo se l'elenco lato server è davvero diverso.
        if (doc.signature && doc.signature !== signatureRef.current) applyDoc(doc);
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

  /** Applica la collezione autorevole restituita da una mutazione. */
  const applyMutation = useCallback(
    (doc) => {
      applyDoc(doc);
      mutationSeqRef.current += 1; // invalida eventuali letture di polling in corso
      return doc;
    },
    [applyDoc],
  );

  /** Crea un solo locale condiviso (nessuna recensione automatica). */
  const createPlace = useCallback(
    async (data) => applyMutation(await sendMutation('POST', { op: 'createPlace', data })),
    [applyMutation],
  );

  /** Aggiorna solo i dati condivisi del locale: le recensioni restano intatte. */
  const updatePlace = useCallback(
    async (id, data) => applyMutation(await sendMutation('PUT', { op: 'updatePlace', id, data })),
    [applyMutation],
  );

  /**
   * Inserisce o sostituisce la propria recensione su un locale esistente.
   * L'utente NON viene passato dal client: il server lo ricava dalla sessione
   * autenticata e tocca solo la recensione di quell'utente.
   */
  const saveReview = useCallback(
    async (id, reviewData) =>
      applyMutation(await sendMutation('PUT', { op: 'saveReview', id, review: reviewData })),
    [applyMutation],
  );

  /** Elimina l'intero locale (con entrambe le recensioni). */
  const deleteRestaurant = useCallback(
    async (id) => applyMutation(await sendMutation('DELETE', { id })),
    [applyMutation],
  );

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
