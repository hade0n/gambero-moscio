/**
 * Pagina `/game` — "Il Banco del Gambero" (Gioco Co-Op nel Browser 1–4 giocatori).
 * Isolata dal resto dell'app di recensioni: non usa `RestaurantsContext` né l'auth admin.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESSORIES,
  APRON_COLORS,
  CHEF_PERSONAS,
  HAIR_COLORS,
  HAIR_STYLES,
  normalizePlayerAvatar,
  SKIN_TONES,
} from '../game/data/characters.js';
import {
  COOK_STATES,
  getIngredient,
  GRILLABLE_INGREDIENTS,
  INGREDIENTS,
  STATIONS,
} from '../game/data/ingredients.js';
import { RECIPES } from '../game/data/recipes.js';
import { CUSTOMER_ARCHETYPES } from '../game/data/archetypes.js';
import {
  applyPlayerAction,
  getGrillSlotStatus,
  getMatchPhase,
} from '../game/engine/gameEngine.js';
import {
  ChefAvatarSvg,
  CustomerAvatarSvg,
  GameUiIcon,
  IngredientIconSvg,
} from '../game/components/GameArt.jsx';

const loadPhaserCanvas = () => import('../game/phaser/KitchenPhaserCanvas.jsx');
const KitchenPhaserCanvas = lazy(loadPhaserCanvas);
import {
  apiCreateLobby,
  apiFetchSnapshot,
  apiJoinLobby,
  apiLeaveLobby,
  apiReturnToLobby,
  apiSendGameAction,
  apiStartMatch,
  apiUpdatePlayer,
  clearActiveGameSession,
  loadActiveGameSession,
  loadSavedProfile,
  saveProfile,
  subscribeRoomRealtime,
} from '../game/utils/gameApi.js';
import {
  isGameMuted,
  playGameSound,
  setGameMuted,
  unlockAudioOnGesture,
} from '../game/utils/sound.js';

function formatTimer(ms) {
  const totalSec = Math.max(0, Math.ceil((ms || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getBrigadeRankTitle(score = 0, ordersServed = 0) {
  if (score >= 950 || ordersServed >= 7) {
    return {
      title: 'Leggende di Spaccanapoli',
      subtitle: 'La fila fuori al Banco del Gambero arriva fino alla piazza!',
    };
  }
  if (score >= 550 || ordersServed >= 4) {
    return {
      title: 'Maestri della Provola Filante',
      subtitle: 'Piastra calda, tempi giusti e clienti col sorriso.',
    };
  }
  if (score >= 250 || ordersServed >= 2) {
    return {
      title: 'Brigata del Quartiere',
      subtitle: 'Buon ritmo al bancone! Con un altro turno diventate imprendibili.',
    };
  }
  return {
    title: 'Apprendisti del Cuzzetiello',
    subtitle: 'La piastra scotta: coordinatevi sui ticket e riprovate!',
  };
}

export default function GamePage() {
  const savedProfile = useMemo(() => loadSavedProfile(), []);
  const [nickname, setNickname] = useState(savedProfile.nickname || '');
  const [avatar, setAvatar] = useState(savedProfile.avatar);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [session, setSession] = useState(() => loadActiveGameSession());
  const [snapshot, setSnapshot] = useState(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  const [selectedBoardIndex, setSelectedBoardIndex] = useState(0);
  const [stationTab, setStationTab] = useState('all'); // 'all' | 'bread' | 'grill' | 'cold' | 'warm' | 'sauce'
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [netState, setNetState] = useState('idle'); // 'idle' | 'loading' | 'connected' | 'reconnecting' | 'expired' | 'error'
  const [errorBanner, setErrorBanner] = useState('');
  const [actionToast, setActionToast] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [muted, setMuted] = useState(() => isGameMuted());
  const [reducedMotion, setReducedMotion] = useState(false);

  const mutationInFlightRef = useRef(false);
  const actionCounterRef = useRef(1);
  const toastTimerRef = useRef(null);

  const showNotice = useCallback((msg) => {
    if (!msg) return;
    setActionToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setActionToast('');
    }, 2800);
  }, []);

  // Rileva prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Aggiorna titolo documento per /game e ripristina all'uscita
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Il Banco del Gambero — Gioco Co-Op | Gambero Moscio - Recensioni Locali';
    return () => {
      document.title = prevTitle;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const applyServerSnapshot = useCallback((nextSnap) => {
    if (!nextSnap) return;
    if (typeof nextSnap.serverNowMs === 'number') {
      setServerTimeOffsetMs(nextSnap.serverNowMs - Date.now());
    }
    setSnapshot((prev) => {
      if (prev && nextSnap.version < prev.version && nextSnap.status === prev.status) {
        return prev;
      }
      return nextSnap;
    });
    setNetState('connected');
  }, []);

  // Ripristino automatico sessione al caricamento o refresh di `/game`
  useEffect(() => {
    const existing = loadActiveGameSession();
    if (!existing) return undefined;
    let cancelled = false;

    async function reconnectExisting() {
      setNetState('loading');
      try {
        const res = await apiFetchSnapshot(existing);
        if (cancelled) return;
        applyServerSnapshot(res.snapshot);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404 || err.status === 410 || err.status === 401) {
          clearActiveGameSession();
          setSession(null);
          setSnapshot(null);
          setNetState(err.status === 410 ? 'expired' : 'idle');
          setErrorBanner(
            err.status === 410
              ? 'La sessione precedente è scaduta. Crea o raggiungi una nuova lobby.'
              : '',
          );
        } else {
          setNetState('reconnecting');
        }
      }
    }

    reconnectExisting();
    return () => {
      cancelled = true;
    };
  }, [applyServerSnapshot]);

  // Funzione di pull dello snapshot autorevole
  const pullSnapshot = useCallback(async () => {
    if (!session || mutationInFlightRef.current) return;
    try {
      const res = await apiFetchSnapshot(session);
      if (!mutationInFlightRef.current) {
        applyServerSnapshot(res.snapshot);
      }
    } catch (err) {
      if (err.status === 404 || err.status === 410) {
        clearActiveGameSession();
        setSession(null);
        setSnapshot(null);
        setNetState('expired');
        setErrorBanner('La lobby è terminata o scaduta.');
      } else if (err.status === 401) {
        clearActiveGameSession();
        setSession(null);
        setSnapshot(null);
        setNetState('idle');
      } else {
        setNetState('reconnecting');
      }
    }
  }, [session, applyServerSnapshot]);

  // Sottoscrizione Realtime + BroadcastChannel + Polling adattivo
  useEffect(() => {
    if (!session || !snapshot?.code) return undefined;

    const unsubscribeRealtime = subscribeRoomRealtime({
      code: snapshot.code,
      realtimeTopic: snapshot.realtimeTopic,
      realtimeConfig: snapshot.realtimeConfig,
      playerId: session.playerId,
      nickname: nickname || 'Cuoco',
      onWakeupSignal: () => {
        pullSnapshot();
      },
    });

    const intervalMs = snapshot.status === 'playing' ? 1200 : 2500;
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      pullSnapshot();
    }, intervalMs);

    const onFocus = () => pullSnapshot();
    window.addEventListener('focus', onFocus);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollId);
      window.removeEventListener('focus', onFocus);
    };
  }, [session, snapshot?.code, snapshot?.realtimeTopic, snapshot?.status, nickname, pullSnapshot]);

  // Timer fluido locale (200ms) ancorato al tempo server per barre cottura e pazienza
  useEffect(() => {
    if (snapshot?.status !== 'playing') return undefined;
    const id = setInterval(() => {
      setNowTickMs(Date.now() + serverTimeOffsetMs);
    }, 200);
    return () => clearInterval(id);
  }, [snapshot?.status, serverTimeOffsetMs]);

  const effectiveNowMs =
    snapshot?.status === 'playing' ? nowTickMs : Date.now() + serverTimeOffsetMs;

  // Azioni Menu & Lobby
  const handleCreateLobby = async (e) => {
    e?.preventDefault();
    unlockAudioOnGesture();
    setErrorBanner('');
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setErrorBanner('Inserisci un nickname tra 2 e 16 caratteri.');
      return;
    }
    saveProfile({ nickname: trimmed, avatar });
    setNetState('loading');
    try {
      const res = await apiCreateLobby({ nickname: trimmed, avatar });
      setSession({
        code: res.snapshot.code,
        playerId: res.playerId,
        playerToken: res.playerToken,
      });
      applyServerSnapshot(res.snapshot);
      playGameSound('serve_ok');
    } catch (err) {
      setNetState('error');
      setErrorBanner(err.message || 'Impossibile creare la lobby.');
    }
  };

  const handleJoinLobby = async (e) => {
    e?.preventDefault();
    unlockAudioOnGesture();
    setErrorBanner('');
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setErrorBanner('Inserisci prima il tuo nickname (2–16 caratteri).');
      return;
    }
    const cleanCode = joinCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setErrorBanner('Inserisci un codice lobby di 6 caratteri.');
      return;
    }
    saveProfile({ nickname: trimmed, avatar });
    setNetState('loading');
    try {
      const existing = loadActiveGameSession();
      const res = await apiJoinLobby({
        code: cleanCode,
        nickname: trimmed,
        avatar,
        existingPlayerId: existing?.code === cleanCode ? existing.playerId : null,
        existingToken: existing?.code === cleanCode ? existing.playerToken : null,
      });
      setSession({
        code: res.snapshot.code,
        playerId: res.playerId,
        playerToken: res.playerToken,
      });
      applyServerSnapshot(res.snapshot);
      playGameSound('serve_ok');
    } catch (err) {
      setNetState('error');
      setErrorBanner(err.message || 'Impossibile entrare nella lobby.');
    }
  };

  const handleToggleReady = async () => {
    if (!session || !snapshot) return;
    unlockAudioOnGesture();
    const me = snapshot.players?.find((p) => p.id === session.playerId);
    if (!me) return;
    try {
      const res = await apiUpdatePlayer({
        ...session,
        isReady: !me.isReady,
      });
      applyServerSnapshot(res.snapshot);
    } catch (err) {
      setErrorBanner(err.message);
    }
  };

  const handleStartMatch = async () => {
    if (!session) return;
    unlockAudioOnGesture();
    setErrorBanner('');
    setNetState('loading');
    try {
      const res = await apiStartMatch(session);
      applyServerSnapshot(res.snapshot);
      setNowTickMs(Date.now() + (res.snapshot.serverNowMs - Date.now()));
      playGameSound('serve_ok');
      showNotice('Partita iniziata! Buon lavoro in cucina!');
    } catch (err) {
      setNetState('connected');
      setErrorBanner(err.message || 'Impossibile avviare la partita.');
    }
  };

  const handleLeaveLobby = async () => {
    if (!session) {
      setSnapshot(null);
      return;
    }
    await apiLeaveLobby(session);
    setSession(null);
    setSnapshot(null);
    setNetState('idle');
    setErrorBanner('');
  };

  const handleCopyCode = async () => {
    if (!snapshot?.code) return;
    try {
      await navigator.clipboard.writeText(snapshot.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  // Dispatch azione in partita con aggiornamento ottimistico + riconciliazione server
  const dispatchKitchenAction = useCallback(
    async (actionPayload) => {
      if (!session || !snapshot || snapshot.status !== 'playing') return;
      if (netState === 'reconnecting') {
        showNotice('Riconnessione in corso: attendi un istante…');
        return;
      }
      unlockAudioOnGesture();

      const actionId = `act-${session.playerId}-${Date.now()}-${actionCounterRef.current}`;
      actionCounterRef.current += 1;
      const fullAction = { ...actionPayload, actionId };

      // Feedback ottimistico locale immediato
      const currentServerNow = Date.now() + serverTimeOffsetMs;
      if (snapshot.game) {
        const optimistic = applyPlayerAction(
          {
            ...snapshot.game,
            processedActions: [],
            nextTicketSeq: 999,
            nextCustomerSeq: 999,
            nextEventSeq: 999,
            rngState: 12345,
            recentRecipeIds: [],
            recentQuotes: [],
          },
          { ...fullAction, playerId: session.playerId },
          currentServerNow,
        );
        if (!optimistic.conflict) {
          setSnapshot((prev) =>
            prev
              ? {
                  ...prev,
                  game: {
                    ...prev.game,
                    grillSlots: optimistic.state.grillSlots,
                    cookedTray: optimistic.state.cookedTray,
                    prepBoards: optimistic.state.prepBoards,
                    activeTickets: optimistic.state.activeTickets,
                    score: optimistic.state.score,
                    combo: optimistic.state.combo,
                  },
                }
              : prev,
          );
        }
      }

      mutationInFlightRef.current = true;
      try {
        const res = await apiSendGameAction({
          ...session,
          action: fullAction,
        });
        applyServerSnapshot(res.snapshot);
        if (res.notice) showNotice(res.notice);

        if (res.conflict) {
          playGameSound('penalty');
        } else if (fullAction.type === 'SERVE_ORDER') {
          playGameSound(res.notice?.includes('errato') ? 'penalty' : 'serve_ok');
        } else if (fullAction.type === 'START_COOK') {
          playGameSound('cook_start');
        } else if (fullAction.type === 'COLLECT_GRILL') {
          playGameSound(res.notice?.includes('bruciata') ? 'penalty' : 'cook_ready');
        } else if (fullAction.type === 'REMOVE_INGREDIENT' || fullAction.type === 'CLEAR_BOARD') {
          playGameSound('ingredient_remove');
        } else {
          playGameSound('ingredient_add');
        }
      } catch (err) {
        setNetState('reconnecting');
        showNotice(err.message || 'Errore di rete: sincronizzazione in corso…');
      } finally {
        mutationInFlightRef.current = false;
      }
    },
    [session, snapshot, netState, serverTimeOffsetMs, applyServerSnapshot, showNotice],
  );

  // Scorciatoie da tastiera accessibili in partita (solo se non si sta scrivendo in un input)
  useEffect(() => {
    if (snapshot?.status !== 'playing') return undefined;

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Tab' && e.shiftKey) {
        // lascia la navigazione standard
        return;
      }

      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const tkt = snapshot.game?.activeTickets?.[idx];
        if (tkt) {
          e.preventDefault();
          dispatchKitchenAction({
            type: 'SELECT_TICKET',
            boardIndex: selectedBoardIndex,
            ticketId: tkt.id,
          });
        }
      } else if (['q', 'w', 'e', 'r', 'Q', 'W', 'E', 'R'].includes(e.key)) {
        const map = { q: 0, w: 1, e: 2, r: 3 };
        const slotIdx = map[e.key.toLowerCase()];
        const slot = snapshot.game?.grillSlots?.[slotIdx];
        if (slot?.ingredientId) {
          e.preventDefault();
          dispatchKitchenAction({
            type: 'COLLECT_GRILL',
            slotIndex: slotIdx,
            toBoardIndex: selectedBoardIndex,
          });
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        dispatchKitchenAction({
          type: 'REMOVE_INGREDIENT',
          boardIndex: selectedBoardIndex,
        });
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        dispatchKitchenAction({
          type: 'SERVE_ORDER',
          boardIndex: selectedBoardIndex,
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [snapshot?.status, snapshot?.game, selectedBoardIndex, dispatchKitchenAction]);

  const handleToggleMute = () => {
    const next = setGameMuted(!muted);
    setMuted(next);
    if (!next) unlockAudioOnGesture();
  };

  const view = snapshot?.status || 'menu'; // 'menu' | 'lobby' | 'playing' | 'finished'
  const mePlayer = snapshot?.players?.find((p) => p.id === session?.playerId) || null;
  const isHost = Boolean(mePlayer?.isHost);
  const activeBoard = snapshot?.game?.prepBoards?.[selectedBoardIndex] || {
    boardIndex: selectedBoardIndex,
    targetTicketId: null,
    ingredients: [],
  };
  const activeTicket =
    snapshot?.game?.activeTickets?.find((t) => t.id === activeBoard.targetTicketId) ||
    snapshot?.game?.activeTickets?.[0] ||
    null;

  const filteredIngredients = useMemo(() => {
    if (stationTab === 'all') return INGREDIENTS;
    return INGREDIENTS.filter((i) => i.station === stationTab);
  }, [stationTab]);

  const remainingRoundMs = snapshot?.game?.endsAtMs
    ? Math.max(0, snapshot.game.endsAtMs - effectiveNowMs)
    : 0;
  const currentPhase = snapshot?.game?.startedAtMs
    ? getMatchPhase(Math.max(0, effectiveNowMs - snapshot.game.startedAtMs))
    : { index: 1, label: 'Inizio servizio' };

  return (
    <div className="min-h-dvh bg-cream text-brown overflow-x-hidden flex flex-col">
      {/* Top Navbar del Gioco */}
      <header className="sticky top-0 z-30 border-b border-brown/12 bg-cream-soft/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="btn btn-secondary btn-sm press shrink-0"
              aria-label="Torna a Gambero Moscio - Recensioni Locali"
            >
              <GameUiIcon name="arrow-left" size={18} />
              <span className="hidden sm:inline">Torna a Gambero Moscio</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/shrimp.svg"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <h1 className="font-display text-base sm:text-lg font-bold leading-tight truncate">
                  Il Banco del Gambero
                </h1>
                <p className="text-xs text-brown-soft truncate">
                  Paninoteca cooperativa napoletana · 1–4 giocatori
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Stato Connessione */}
            {session && (
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold border ${
                  netState === 'connected'
                    ? 'bg-green/12 text-green-deep border-green/30'
                    : netState === 'reconnecting'
                      ? 'bg-rating/20 text-brown border-rating/40'
                      : 'bg-cream text-brown-soft border-brown/15'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    netState === 'connected'
                      ? 'bg-green'
                      : netState === 'reconnecting'
                        ? 'bg-rating'
                        : 'bg-brown-soft'
                  }`}
                />
                <span>
                  {netState === 'connected'
                    ? `Lobby ${snapshot?.code || ''}`
                    : netState === 'reconnecting'
                      ? 'Riconnessione…'
                      : 'Sincronizzazione…'}
                </span>
              </span>
            )}

            {/* Pulsante Ricettario & Guida */}
            <button
              type="button"
              onClick={() => setShowGuideModal((v) => !v)}
              className="btn btn-secondary btn-sm press"
              aria-expanded={showGuideModal}
            >
              <span>Ricettario</span>
            </button>

            {/* Controllo Audio Muto (>= 44x44px) */}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-pressed={muted}
              aria-label={muted ? 'Riattiva effetti sonori' : 'Disattiva effetti sonori'}
              title={muted ? 'Audio disattivato' : 'Audio attivo'}
              className="btn btn-secondary btn-sm press min-w-[44px] px-2.5"
            >
              <GameUiIcon name={muted ? 'volume-off' : 'volume-on'} size={18} />
              <span className="sr-only">{muted ? 'Audio muto' : 'Audio attivo'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Errori / Riconnessione / Notifiche */}
      <div className="mx-auto w-full max-w-content px-4 pt-3 sm:px-6" aria-live="polite">
        {errorBanner && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="btn btn-sm min-h-[36px] px-3 text-xs font-bold underline"
            >
              Chiudi
            </button>
          </div>
        )}

        {netState === 'reconnecting' && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-rating/50 bg-rating/15 px-4 py-2.5 text-sm font-semibold text-brown"
          >
            Connessione instabile: riconnessione allo stato autorevole della cucina in corso… Le azioni riprenderanno tra un istante.
          </div>
        )}
      </div>

      {/* Contenuto Principale per Stato (Menu / Lobby / Partita / Risultato) */}
      <main className="mx-auto flex-1 w-full max-w-content px-4 pb-10 pt-2 sm:px-6">
        {/* ===================================================================
            VISTA 1: MENU PRINCIPALE & PERSONALIZZAZIONE CUOCO
           =================================================================== */}
        {view === 'menu' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Colonna Sinistra: Identità del Cuoco */}
            <section
              aria-labelledby="chef-custom-heading"
              className="surface p-5 sm:p-6 lg:col-span-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-brown/10">
                <div>
                  <span className="inline-block rounded-sm bg-terracotta/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-terracotta-deep">
                    Brigata di cucina
                  </span>
                  <h2 id="chef-custom-heading" className="mt-1 font-display text-2xl sm:text-3xl font-bold">
                    Scegli il tuo cuoco
                  </h2>
                  <p className="mt-1 text-sm text-brown-soft">
                    Nessun account richiesto. Scegli un nome e personalizza la divisa per entrare al Banco del Gambero.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center bg-cream rounded-2xl p-3 border border-brown/10">
                  <ChefAvatarSvg avatar={avatar} size={72} />
                  <div className="pr-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brown-soft">
                      In divisa
                    </p>
                    <p className="font-display text-lg font-bold text-brown">
                      {nickname.trim() || 'Cuoco Ospite'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Campo Nickname */}
              <div className="mt-5">
                <label htmlFor="player-nickname" className="block text-sm font-bold text-brown mb-1.5">
                  Il tuo nickname al bancone (2–16 caratteri)
                </label>
                <input
                  id="player-nickname"
                  type="text"
                  maxLength={16}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Es. Gennaro, Chiara, Mastro…"
                  className="field-control text-base font-semibold"
                />
              </div>

              {/* Preset Archetipo Cuoco */}
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                  Specialità del cuoco
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CHEF_PERSONAS.map((persona) => {
                    const selected = avatar.chefId === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() =>
                          setAvatar(
                            normalizePlayerAvatar({
                              ...persona.defaultAvatar,
                              chefId: persona.id,
                            }),
                          )
                        }
                        aria-pressed={selected}
                        className={`press flex items-center gap-3 rounded-xl border p-3 text-left min-h-[56px] ${
                          selected
                            ? 'border-terracotta bg-terracotta/10 shadow-xs'
                            : 'border-brown/15 bg-white hover:bg-cream/60'
                        }`}
                      >
                        <ChefAvatarSvg
                          avatar={{ ...persona.defaultAvatar, chefId: persona.id }}
                          size={44}
                        />
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold text-brown truncate">
                            {persona.name}
                          </p>
                          <p className="text-xs text-brown-soft truncate">{persona.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personalizzazione Dettagliata: Carnagione, Capelli, Grembiule, Accessorio */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-brown/10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                    Carnagione
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setAvatar((a) => ({ ...a, skinTone: tone.id }))}
                        aria-label={`Carnagione ${tone.label}`}
                        aria-pressed={avatar.skinTone === tone.id}
                        className={`press h-11 w-11 rounded-xl border-2 flex items-center justify-center ${
                          avatar.skinTone === tone.id
                            ? 'border-terracotta ring-2 ring-terracotta/30'
                            : 'border-brown/20'
                        }`}
                        style={{ backgroundColor: tone.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                    Colore grembiule
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {APRON_COLORS.map((apron) => (
                      <button
                        key={apron.id}
                        type="button"
                        onClick={() => setAvatar((a) => ({ ...a, apronColor: apron.id }))}
                        aria-label={`Grembiule ${apron.label}`}
                        aria-pressed={avatar.apronColor === apron.id}
                        className={`press h-11 w-11 rounded-xl border-2 flex items-center justify-center ${
                          avatar.apronColor === apron.id
                            ? 'border-brown ring-2 ring-terracotta/40'
                            : 'border-brown/20'
                        }`}
                        style={{ backgroundColor: apron.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="select-hair-style" className="block text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                    Acconciatura
                  </label>
                  <select
                    id="select-hair-style"
                    value={avatar.hairStyle}
                    onChange={(e) => setAvatar((a) => ({ ...a, hairStyle: e.target.value }))}
                    className="field-control text-sm font-medium"
                  >
                    {HAIR_STYLES.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="select-hair-color" className="block text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                    Colore capelli
                  </label>
                  <select
                    id="select-hair-color"
                    value={avatar.hairColor}
                    onChange={(e) => setAvatar((a) => ({ ...a, hairColor: e.target.value }))}
                    className="field-control text-sm font-medium"
                  >
                    {HAIR_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                    Accessorio da banco
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACCESSORIES.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAvatar((a) => ({ ...a, accessory: acc.id }))}
                        aria-pressed={avatar.accessory === acc.id}
                        className={`btn btn-sm press ${
                          avatar.accessory === acc.id ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Colonna Destra: Crea Lobby / Unisciti con Party Code */}
            <section
              aria-labelledby="lobby-actions-heading"
              className="surface p-5 sm:p-6 lg:col-span-5 flex flex-col gap-5"
            >
              <div>
                <span className="inline-block rounded-sm bg-green/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-green-deep">
                  Cooperativa 1–4 Giocatori
                </span>
                <h2 id="lobby-actions-heading" className="mt-1 font-display text-2xl font-bold">
                  Apri o raggiungi il Banco
                </h2>
                <p className="mt-1 text-sm text-brown-soft">
                  Puoi giocare da solo per allenarti oppure invitare fino a 3 amici condividendo il codice partita di 6 lettere.
                </p>
              </div>

              {/* Azione 1: Crea Lobby */}
              <div className="rounded-2xl border border-brown/12 bg-cream/60 p-4">
                <h3 className="font-display text-lg font-bold">Nuova brigata</h3>
                <p className="mt-1 text-xs text-brown-soft">
                  Genera un codice stanza immediato e scegli quando alzare la saracinesca.
                </p>
                <button
                  type="button"
                  disabled={netState === 'loading'}
                  onClick={handleCreateLobby}
                  className="btn btn-primary w-full mt-3"
                >
                  {netState === 'loading' ? 'Apertura in corso…' : 'Crea lobby'}
                </button>
              </div>

              {/* Azione 2: Entra con Party Code */}
              <form
                onSubmit={handleJoinLobby}
                className="rounded-2xl border border-brown/12 bg-cream/60 p-4"
              >
                <h3 className="font-display text-lg font-bold">Unisciti con codice</h3>
                <label htmlFor="party-code-input" className="block mt-1 text-xs text-brown-soft">
                  Inserisci il Party Code di 6 caratteri comunicato dall’host:
                </label>
                <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="party-code-input"
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) =>
                      setJoinCodeInput(
                        e.target.value.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, ''),
                      )
                    }
                    placeholder="ES. GMB42K"
                    className="field-control text-center font-mono text-lg font-bold uppercase tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={netState === 'loading'}
                    className="btn btn-outline shrink-0"
                  >
                    Entra in lobby
                  </button>
                </div>
              </form>

              {/* Riepilogo regole rapide */}
              <div className="rounded-2xl border border-brown/10 bg-white/80 p-4 text-xs text-brown-soft space-y-2">
                <p className="font-bold text-brown text-sm">Come funziona il turno (165s):</p>
                <p>
                  1. I clienti arrivano al bancone con un <strong>ticket</strong> e un tratto caratteristico (es. <em>Di fretta</em>, <em>Senza cipolla</em>, <em>Ordine doppio</em>).
                </p>
                <p>
                  2. Le proteine che richiedono piastra (manzo, salsiccia, pollo, burger veg) vanno cotte nei <strong>4 slot griglia</strong> finché diventano <strong>Pronte</strong> (attenzione a non bruciarle!).
                </p>
                <p>
                  3. Assemblate pane, farciture e salse sui <strong>2 banchi condivisi</strong> e consegnate al cliente giusto per attivare la <strong>Combo di squadra</strong>.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            VISTA 2: SALA D'ATTESA LOBBY
           =================================================================== */}
        {view === 'lobby' && snapshot && (
          <section
            aria-labelledby="lobby-room-heading"
            className="surface p-5 sm:p-8 max-w-4xl mx-auto"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brown/12">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-terracotta/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-terracotta-deep">
                  <GameUiIcon name="users" size={14} />
                  <span>Brigata pronta ({snapshot.players.length}/4 cuochi)</span>
                </span>
                <h2 id="lobby-room-heading" className="mt-1.5 font-display text-2xl sm:text-3xl font-bold">
                  Sala pre-servizio · Il Banco del Gambero
                </h2>
                <p className="mt-1 text-sm text-brown-soft">
                  Condividi il codice con i tuoi compagni (da 1 a 4 giocatori) oppure avvia subito un turno di prova.
                </p>
              </div>

              {/* Party Code Box Copiabile */}
              <div className="flex items-center gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream px-4 py-3 self-start md:self-center">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brown-soft">
                    Codice Partita
                  </p>
                  <p
                    className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-terracotta-deep"
                    data-testid="lobby-party-code"
                  >
                    {snapshot.code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="btn btn-secondary btn-sm press"
                  aria-label="Copia codice partita"
                >
                  <GameUiIcon name={copiedCode ? 'check' : 'copy'} size={16} />
                  <span>{copiedCode ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
            </div>

            {/* Elenco 4 Slot Giocatori */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, idx) => {
                const player = snapshot.players[idx];
                if (!player) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="rounded-2xl border-2 border-dashed border-brown/15 bg-cream/40 p-5 flex flex-col items-center justify-center text-center min-h-[180px]"
                    >
                      <p className="font-display text-base font-bold text-brown-soft">
                        Posto Cuoco #{idx + 1}
                      </p>
                      <p className="mt-1 text-xs text-brown-soft">
                        In attesa di un compagno col codice <strong>{snapshot.code}</strong>
                      </p>
                    </div>
                  );
                }

                const isMe = player.id === session?.playerId;
                return (
                  <div
                    key={player.id}
                    className={`rounded-2xl border p-4 flex flex-col items-center text-center min-h-[180px] justify-between ${
                      isMe
                        ? 'border-terracotta bg-white shadow-sm'
                        : 'border-brown/15 bg-cream-soft'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-xs font-bold">
                      <span
                        className={`rounded-sm px-2 py-0.5 ${
                          player.isHost
                            ? 'bg-terracotta text-white'
                            : 'bg-brown/10 text-brown'
                        }`}
                      >
                        {player.isHost ? 'Capo Brigata (Host)' : `Cuoco #${idx + 1}`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          player.isOnline ? 'text-green-deep' : 'text-brown-soft'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            player.isOnline ? 'bg-green' : 'bg-rating'
                          }`}
                        />
                        {player.isOnline ? 'Online' : 'Riconnessione'}
                      </span>
                    </div>

                    <div className="my-2">
                      <ChefAvatarSvg avatar={player.avatar} size={68} />
                      <p className="mt-2 font-display text-lg font-bold text-brown">
                        {player.nickname} {isMe ? '(Tu)' : ''}
                      </p>
                    </div>

                    <span
                      className={`w-full rounded-xl py-1.5 text-xs font-bold ${
                        player.isReady
                          ? 'bg-green/15 text-green-deep border border-green/30'
                          : 'bg-rating/20 text-brown border border-rating/40'
                      }`}
                    >
                      {player.isReady ? 'Pronto ai fornelli' : 'In preparazione…'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Azioni Lobby */}
            <div className="mt-6 pt-5 border-t border-brown/12 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLeaveLobby}
                className="btn btn-danger-outline"
              >
                Esci dalla lobby
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleReady}
                  className="btn btn-secondary"
                >
                  {mePlayer?.isReady ? 'Segna: Non pronto' : 'Segna: Pronto!'}
                </button>

                {isHost ? (
                  <button
                    type="button"
                    disabled={netState === 'loading'}
                    onClick={handleStartMatch}
                    className="btn btn-primary"
                    data-testid="start-match-btn"
                  >
                    <GameUiIcon name="flame" size={18} />
                    <span>
                      {snapshot.players.length === 1
                        ? 'Avvia turno (1 giocatore)'
                        : `Avvia turno co-op (${snapshot.players.length} giocatori)`}
                    </span>
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-brown-soft px-2">
                    In attesa che il Capo Brigata avvii il servizio…
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            VISTA 3: PARTITA IN CORSO (CUCINA COOPERATIVA)
           =================================================================== */}
        {view === 'playing' && snapshot?.game && (
          <div className="space-y-4">
            {/* Barra di stato superiore: Timer, Fase, Punteggio, Combo e Ultimo Evento */}
            <section
              aria-label="Stato del turno e punteggio di squadra"
              className="surface p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                {/* Timer Round */}
                <div className="flex items-center gap-2 rounded-xl bg-brown px-3.5 py-2 text-cream-soft">
                  <GameUiIcon name="clock" size={18} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-80 leading-none">
                      Tempo turno
                    </p>
                    <p
                      className="font-mono text-xl font-extrabold tabular leading-tight"
                      data-testid="match-timer"
                    >
                      {formatTimer(remainingRoundMs)}
                    </p>
                  </div>
                </div>

                {/* Punteggio Squadra */}
                <div className="rounded-xl border border-brown/15 bg-cream px-3.5 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brown-soft">
                    Punteggio Squadra
                  </p>
                  <p
                    className="font-display text-2xl font-extrabold text-terracotta-deep tabular leading-tight"
                    data-testid="team-score"
                  >
                    {snapshot.game.score} <span className="text-xs font-sans font-semibold">pt</span>
                  </p>
                </div>

                {/* Combo & Serviti */}
                <div className="flex items-center gap-2">
                  <span className="rounded-xl border border-brown/15 bg-white px-3 py-2 text-xs font-bold">
                    Serviti: <strong className="tabular">{snapshot.game.stats.ordersServed}</strong>
                  </span>
                  {snapshot.game.combo >= 2 && (
                    <span className="rounded-xl bg-rating px-3 py-2 text-xs font-extrabold text-brown shadow-xs">
                      Combo Squadra ×{snapshot.game.combo}
                    </span>
                  )}
                  <span className="hidden md:inline-block rounded-xl bg-terracotta/12 px-3 py-2 text-xs font-bold text-terracotta-deep">
                    {currentPhase.label}
                  </span>
                </div>
              </div>

              {/* Spiegazione trasparente dell'ultima variazione di punteggio */}
              <div
                role="status"
                aria-live="polite"
                className="flex-1 min-w-[220px] rounded-xl border border-brown/12 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-brown flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {actionToast ||
                    snapshot.game.scoreEvents?.[0]?.message ||
                    'Seleziona un ticket e prepara il panino richiesto!'}
                </span>
                {snapshot.game.scoreEvents?.[0]?.delta !== 0 &&
                  snapshot.game.scoreEvents?.[0]?.delta !== undefined && (
                    <span
                      className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-extrabold tabular ${
                        snapshot.game.scoreEvents[0].delta > 0
                          ? 'bg-green/15 text-green-deep'
                          : 'bg-danger/15 text-danger'
                      }`}
                    >
                      {snapshot.game.scoreEvents[0].delta > 0
                        ? `+${snapshot.game.scoreEvents[0].delta}`
                        : snapshot.game.scoreEvents[0].delta}{' '}
                      pt
                    </span>
                  )}
              </div>
            </section>

            {/* Scena 2D interattiva Phaser 4 */}
            <Suspense
              fallback={
                <div className="surface flex h-64 items-center justify-center border border-brown/15 bg-cream-soft text-sm font-semibold text-brown-soft">
                  Accensione piastra e preparazione cucina…
                </div>
              }
            >
              <KitchenPhaserCanvas
                snapshot={snapshot}
                selectedBoardIndex={selectedBoardIndex}
                serverTimeOffsetMs={serverTimeOffsetMs}
                reducedMotion={reducedMotion}
                disabled={netState === 'reconnecting'}
                onSelectBoard={(bIdx) => setSelectedBoardIndex(bIdx)}
                onSelectTicket={(ticketId) =>
                  dispatchKitchenAction({
                    type: 'SELECT_TICKET',
                    boardIndex: selectedBoardIndex,
                    ticketId,
                  })
                }
                onCollectGrill={(slotIdx) =>
                  dispatchKitchenAction({
                    type: 'COLLECT_GRILL',
                    slotIndex: slotIdx,
                    toBoardIndex: selectedBoardIndex,
                  })
                }
                onRemoveLastIngredient={(bIdx) =>
                  dispatchKitchenAction({
                    type: 'REMOVE_INGREDIENT',
                    boardIndex: bIdx,
                  })
                }
                onServeOrder={(bIdx) =>
                  dispatchKitchenAction({
                    type: 'SERVE_ORDER',
                    boardIndex: bIdx,
                  })
                }
              />
            </Suspense>

            {/* Stazioni DOM accessibili (Ticket Clienti + Griglia + Banchi & Ingredienti) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
              {/* STAZIONE 1: Clienti & Ticket Attivi (4 colonne su desktop) */}
              <section
                aria-labelledby="tickets-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 id="tickets-station-heading" className="font-display text-lg font-bold">
                    1. Clienti e Comande ({snapshot.game.activeTickets.length})
                  </h2>
                  <span className="text-xs font-semibold text-brown-soft">Tasti [1–6]</span>
                </div>

                {snapshot.game.activeTickets.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-brown/20 p-4 text-center text-sm text-brown-soft">
                    Nuovo cliente in arrivo al bancone…
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {snapshot.game.activeTickets.map((tkt, idx) => {
                      const isTarget = activeTicket?.id === tkt.id;
                      const remMs = Math.max(0, tkt.expiresAtMs - effectiveNowMs);
                      const ratio = tkt.patienceMs > 0 ? Math.min(1, remMs / tkt.patienceMs) : 0;
                      const isThinking = Boolean(
                        tkt.thinkingUntilMs && effectiveNowMs < tkt.thinkingUntilMs,
                      );

                      return (
                        <div
                          key={tkt.id}
                          data-testid={`ticket-card-${idx}`}
                          className={`rounded-2xl border p-3 transition ${
                            isTarget
                              ? 'border-terracotta bg-white shadow-sm ring-2 ring-terracotta/20'
                              : 'border-brown/15 bg-cream/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CustomerAvatarSvg appearance={tkt.appearance} size={42} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-display text-sm font-bold text-brown">
                                    #{idx + 1} {tkt.customerName}
                                  </span>
                                  <span className="rounded-sm bg-terracotta/15 px-2 py-0.5 text-[11px] font-bold text-terracotta-deep">
                                    {tkt.badgeLabel}
                                  </span>
                                </div>
                                <p className="text-xs italic text-brown-soft truncate">
                                  “{tkt.quote}”
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 font-mono text-xs font-bold tabular text-brown">
                              {Math.ceil(remMs / 1000)}s
                            </span>
                          </div>

                          {/* Barra di pazienza accessibile */}
                          <div
                            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brown/10"
                            role="progressbar"
                            aria-label={`Pazienza di ${tkt.customerName}`}
                            aria-valuenow={Math.round(ratio * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className={`h-full transition-all ${
                                ratio > 0.5
                                  ? 'bg-green'
                                  : ratio > 0.25
                                    ? 'bg-rating'
                                    : 'bg-danger'
                              }`}
                              style={{ width: `${Math.max(5, Math.round(ratio * 100))}%` }}
                            />
                          </div>

                          {/* Ricetta e Ingredienti richiesti */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-display text-sm font-bold text-brown">
                                {isThinking ? 'Sta confermando (clicca per fissare)…' : tkt.recipeName}
                              </p>
                              <span className="text-[11px] font-bold text-green-deep">
                                +{tkt.basePoints} pt
                              </span>
                            </div>

                            {/* Modificatori espliciti */}
                            {tkt.modifiers?.exclude && (
                              <p className="mt-0.5 text-xs font-bold text-danger">
                                Nota: SENZA {getIngredient(tkt.modifiers.exclude)?.shortName}
                              </p>
                            )}
                            {tkt.modifiers?.add && (
                              <p className="mt-0.5 text-xs font-bold text-terracotta-deep">
                                Nota: EXTRA {getIngredient(tkt.modifiers.add)?.shortName}
                              </p>
                            )}
                            {tkt.modifiers?.swap && (
                              <p className="mt-0.5 text-xs font-bold text-green-deep">
                                Variante: CON {getIngredient(tkt.modifiers.swap.to)?.shortName}
                              </p>
                            )}

                            {/* Chip ingredienti richiesti con spunta se già sul banco attivo */}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tkt.targetIngredients.map((ingId, ingIdx) => {
                                const ing = getIngredient(ingId);
                                const onBoard = activeBoard.ingredients.includes(ingId);
                                return (
                                  <span
                                    key={`${tkt.id}-${ingId}-${ingIdx}`}
                                    className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold ${
                                      onBoard
                                        ? 'border-green bg-green/15 text-green-deep'
                                        : 'border-brown/15 bg-white text-brown'
                                    }`}
                                  >
                                    <IngredientIconSvg ingredientId={ingId} size={14} />
                                    <span>{ing?.shortName || ingId}</span>
                                    {ing?.requiresGrill && (
                                      <span className="text-[10px] text-terracotta-deep">(Piastra)</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Azioni rapide sul Ticket (>= 44px) */}
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={netState === 'reconnecting'}
                              onClick={() =>
                                dispatchKitchenAction({
                                  type: 'SELECT_TICKET',
                                  boardIndex: selectedBoardIndex,
                                  ticketId: tkt.id,
                                })
                              }
                              className={`btn btn-sm flex-1 ${
                                isTarget ? 'btn-secondary' : 'btn-outline'
                              }`}
                            >
                              {isTarget ? `Su Banco ${selectedBoardIndex + 1}` : 'Prepara questo'}
                            </button>
                            <button
                              type="button"
                              disabled={
                                netState === 'reconnecting' || activeBoard.ingredients.length === 0
                              }
                              onClick={() =>
                                dispatchKitchenAction({
                                  type: 'SERVE_ORDER',
                                  boardIndex: selectedBoardIndex,
                                  ticketId: tkt.id,
                                })
                              }
                              className="btn btn-primary btn-sm"
                              data-testid={`serve-ticket-${idx}`}
                            >
                              <GameUiIcon name="bell" size={15} />
                              <span>Consegna</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STAZIONE 2: Piastra a 4 Slot & Vassoio Caldi (4 colonne su desktop) */}
              <section
                aria-labelledby="grill-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 id="grill-station-heading" className="font-display text-lg font-bold">
                    2. Piastra & Cotture (4 slot)
                  </h2>
                  <span className="text-xs font-semibold text-brown-soft">Tasti [Q W E R]</span>
                </div>

                {/* Pulsanti per mettere sulla piastra le 4 proteine */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                    Metti a cuocere sulla piastra:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {GRILLABLE_INGREDIENTS.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        disabled={netState === 'reconnecting'}
                        onClick={() =>
                          dispatchKitchenAction({
                            type: 'START_COOK',
                            ingredientId: ing.id,
                          })
                        }
                        data-testid={`cook-btn-${ing.id}`}
                        className="press flex items-center gap-2 rounded-xl border border-brown/15 bg-white px-3 py-2.5 text-left text-xs font-bold hover:border-terracotta min-h-[48px]"
                      >
                        <IngredientIconSvg ingredientId={ing.id} size={24} />
                        <div className="min-w-0">
                          <p className="text-brown truncate">{ing.shortName}</p>
                          <p className="text-[11px] font-normal text-brown-soft">
                            {(ing.cookTimeMs / 1000).toFixed(1)}s cottura
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* I 4 Slot della Piastra */}
                <div className="space-y-2 pt-2 border-t border-brown/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft">
                    Stato dei 4 slot piastra:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {snapshot.game.grillSlots.map((slot, sIdx) => {
                      const status = getGrillSlotStatus(slot, effectiveNowMs);
                      const ing = slot.ingredientId ? getIngredient(slot.ingredientId) : null;
                      const keyHint = ['Q', 'W', 'E', 'R'][sIdx];

                      return (
                        <div
                          key={slot.slotIndex}
                          data-testid={`grill-slot-${sIdx}`}
                          className={`rounded-xl border p-3 flex flex-col justify-between gap-2 ${
                            !slot.ingredientId
                              ? 'border-dashed border-brown/20 bg-cream/40'
                              : status.state === COOK_STATES.COOKED
                                ? 'border-green bg-green/10 shadow-xs'
                                : status.state === COOK_STATES.BURNED
                                  ? 'border-danger bg-danger/10'
                                  : 'border-rating bg-rating/10'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>
                              Slot {sIdx + 1} [{keyHint}]
                            </span>
                            <span
                              className={
                                status.state === COOK_STATES.COOKED
                                  ? 'text-green-deep'
                                  : status.state === COOK_STATES.BURNED
                                    ? 'text-danger'
                                    : 'text-brown-soft'
                              }
                            >
                              {!slot.ingredientId
                                ? 'Libero'
                                : status.state === COOK_STATES.COOKING
                                  ? `Cuoce ${(status.remainingMs / 1000).toFixed(1)}s`
                                  : status.state === COOK_STATES.COOKED
                                    ? 'PRONTO!'
                                    : 'BRUCIATO!'}
                            </span>
                          </div>

                          {ing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <IngredientIconSvg ingredientId={ing.id} size={24} />
                                <span className="font-display text-sm font-bold">{ing.shortName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={
                                    netState === 'reconnecting' ||
                                    status.state === COOK_STATES.COOKING
                                  }
                                  onClick={() =>
                                    dispatchKitchenAction({
                                      type: 'COLLECT_GRILL',
                                      slotIndex: sIdx,
                                      toBoardIndex: selectedBoardIndex,
                                    })
                                  }
                                  data-testid={`collect-grill-${sIdx}`}
                                  className={`btn btn-sm w-full ${
                                    status.state === COOK_STATES.COOKED
                                      ? 'btn-primary'
                                      : status.state === COOK_STATES.BURNED
                                        ? 'btn-danger'
                                        : 'btn-secondary'
                                  }`}
                                >
                                  {status.state === COOK_STATES.COOKING
                                    ? 'In cottura…'
                                    : status.state === COOK_STATES.COOKED
                                      ? `Usa su Banco ${selectedBoardIndex + 1}`
                                      : 'Pulisci (-15 pt)'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-brown-soft py-2">
                              Tocca una proteina sopra per avviare la cottura.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vassoio Caldi Pronti */}
                <div className="pt-2 border-t border-brown/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-1.5">
                    Vassoio caldi pronti ({snapshot.game.cookedTray.length}/6):
                  </p>
                  {snapshot.game.cookedTray.length === 0 ? (
                    <p className="text-xs text-brown-soft">
                      Le cotture pronte possono andare dritte sul banco o sostare qui.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {snapshot.game.cookedTray.map((item) => {
                        const ing = getIngredient(item.ingredientId);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              dispatchKitchenAction({
                                type: 'ADD_INGREDIENT',
                                boardIndex: selectedBoardIndex,
                                ingredientId: item.ingredientId,
                              })
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            <IngredientIconSvg ingredientId={item.ingredientId} size={18} />
                            <span>+ {ing?.shortName}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* STAZIONE 3: Banchi di Assemblaggio & Dispensa Ingredienti (4 colonne su desktop) */}
              <section
                aria-labelledby="assembly-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 id="assembly-station-heading" className="font-display text-lg font-bold">
                    3. Assemblaggio & Dispensa
                  </h2>
                  {/* Selettore Banco 1 / Banco 2 */}
                  <div className="inline-flex rounded-xl border border-brown/15 bg-cream p-1">
                    {[0, 1].map((bIdx) => (
                      <button
                        key={bIdx}
                        type="button"
                        onClick={() => setSelectedBoardIndex(bIdx)}
                        aria-pressed={selectedBoardIndex === bIdx}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold min-h-[36px] ${
                          selectedBoardIndex === bIdx
                            ? 'bg-terracotta text-white shadow-xs'
                            : 'text-brown hover:bg-white/60'
                        }`}
                      >
                        Banco {bIdx + 1} ({snapshot.game.prepBoards[bIdx]?.ingredients.length || 0})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Riepilogo Panino in preparazione sul Banco selezionato */}
                <div className="rounded-2xl border border-terracotta/35 bg-white p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-brown-soft">
                    <span>
                      Sul Banco {selectedBoardIndex + 1}
                      {activeTicket
                        ? ` · Per ${activeTicket.customerName} (${activeTicket.recipeName})`
                        : ''}
                    </span>
                    {activeBoard.ingredients.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          dispatchKitchenAction({
                            type: 'CLEAR_BOARD',
                            boardIndex: selectedBoardIndex,
                          })
                        }
                        className="text-danger underline font-bold"
                      >
                        Svuota
                      </button>
                    )}
                  </div>

                  {activeBoard.ingredients.length === 0 ? (
                    <p className="py-3 text-xs text-brown-soft">
                      Nessun ingrediente sul tagliere. Tocca il pane e gli ingredienti qui sotto!
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeBoard.ingredients.map((ingId, idx) => {
                        const ing = getIngredient(ingId);
                        return (
                          <button
                            key={`${ingId}-${idx}`}
                            type="button"
                            onClick={() =>
                              dispatchKitchenAction({
                                type: 'REMOVE_INGREDIENT',
                                boardIndex: selectedBoardIndex,
                                ingredientIndex: idx,
                              })
                            }
                            title="Tocca per rimuovere questo ingrediente"
                            className="press inline-flex items-center gap-1.5 rounded-lg border border-brown/20 bg-cream px-2.5 py-1.5 text-xs font-bold text-brown hover:border-danger min-h-[38px]"
                          >
                            <IngredientIconSvg ingredientId={ingId} size={16} />
                            <span>{ing?.shortName || ingId}</span>
                            <span className="text-danger font-extrabold">×</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Barra azioni Banco: Togli ultimo + Consegna */}
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-brown/10">
                    <button
                      type="button"
                      disabled={
                        netState === 'reconnecting' || activeBoard.ingredients.length === 0
                      }
                      onClick={() =>
                        dispatchKitchenAction({
                          type: 'REMOVE_INGREDIENT',
                          boardIndex: selectedBoardIndex,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      <GameUiIcon name="undo" size={15} />
                      <span>Togli ultimo</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        netState === 'reconnecting' ||
                        activeBoard.ingredients.length === 0 ||
                        !activeTicket
                      }
                      onClick={() =>
                        dispatchKitchenAction({
                          type: 'SERVE_ORDER',
                          boardIndex: selectedBoardIndex,
                          ticketId: activeTicket?.id,
                        })
                      }
                      data-testid="main-serve-btn"
                      className="btn btn-primary btn-sm flex-1"
                    >
                      <GameUiIcon name="bell" size={16} />
                      <span>
                        Consegna {activeTicket ? `a ${activeTicket.customerName}` : 'ordine'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Filtri Stazione Dispensa */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Tutti' },
                    { id: STATIONS.BREAD, label: 'Pani' },
                    { id: STATIONS.COLD, label: 'Formaggi & Verdure' },
                    { id: STATIONS.WARM, label: 'Caldi & Ragù' },
                    { id: STATIONS.SAUCE, label: 'Salse' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStationTab(tab.id)}
                      aria-pressed={stationTab === tab.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold min-h-[38px] ${
                        stationTab === tab.id
                          ? 'bg-brown text-cream-soft'
                          : 'bg-cream text-brown hover:bg-brown/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Griglia Bottoni Ingredienti (>= 44x44px) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredIngredients.map((ing) => {
                    const isRequiredByActive = activeTicket?.targetIngredients?.includes(ing.id);
                    const alreadyAdded = activeBoard.ingredients.includes(ing.id);

                    return (
                      <button
                        key={ing.id}
                        type="button"
                        disabled={netState === 'reconnecting'}
                        onClick={() =>
                          dispatchKitchenAction({
                            type: 'ADD_INGREDIENT',
                            boardIndex: selectedBoardIndex,
                            ingredientId: ing.id,
                          })
                        }
                        data-testid={`add-ing-${ing.id}`}
                        className={`press flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold min-h-[48px] ${
                          alreadyAdded
                            ? 'border-green bg-green/10 text-green-deep'
                            : isRequiredByActive
                              ? 'border-terracotta bg-white ring-1 ring-terracotta/30'
                              : 'border-brown/15 bg-white hover:bg-cream/60'
                        }`}
                      >
                        <IngredientIconSvg ingredientId={ing.id} size={22} />
                        <div className="min-w-0">
                          <p className="truncate leading-tight">{ing.shortName}</p>
                          {ing.requiresGrill && (
                            <p className="text-[10px] font-semibold text-terracotta-deep">
                              Da piastra
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ===================================================================
            VISTA 4: RISULTATI DI FINE PARTITA
           =================================================================== */}
        {view === 'finished' && snapshot?.game && (
          <section
            aria-labelledby="match-results-heading"
            className="surface p-6 sm:p-8 max-w-4xl mx-auto space-y-6"
          >
            {(() => {
              const rank = getBrigadeRankTitle(
                snapshot.game.score,
                snapshot.game.stats.ordersServed,
              );
              return (
                <div className="text-center border-b border-brown/12 pb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-rating/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brown">
                    <GameUiIcon name="sparkle" size={14} />
                    <span>Fine turno al Banco del Gambero</span>
                  </span>
                  <h2
                    id="match-results-heading"
                    className="mt-2 font-display text-3xl sm:text-4xl font-bold"
                  >
                    {rank.title}
                  </h2>
                  <p className="mt-1 text-base text-brown-soft">{rank.subtitle}</p>

                  <div className="mt-5 inline-flex flex-col items-center rounded-2xl border-2 border-terracotta/40 bg-cream px-8 py-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-brown-soft">
                      Punteggio Finale di Squadra
                    </span>
                    <span
                      className="font-display text-4xl sm:text-5xl font-extrabold text-terracotta-deep tabular"
                      data-testid="final-score"
                    >
                      {snapshot.game.score} pt
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Riepilogo Statistiche Partita */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Panini serviti', value: snapshot.game.stats.ordersServed },
                { label: 'Combo massima', value: `×${snapshot.game.maxCombo || 1}` },
                { label: 'Mance & bonus', value: `+${snapshot.game.stats.tipsEarned} pt` },
                { label: 'Bonus combo', value: `+${snapshot.game.stats.comboBonusEarned} pt` },
                { label: 'Consegne errate', value: snapshot.game.stats.wrongDeliveries },
                { label: 'Clienti persi / Bruciati', value: `${snapshot.game.stats.customersLost} / ${snapshot.game.stats.burnedCount}` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-brown/12 bg-cream/60 p-3.5 text-center"
                >
                  <p className="text-xs font-semibold text-brown-soft">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-bold text-brown tabular">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Contributi amichevoli della brigata */}
            <div>
              <h3 className="font-display text-lg font-bold mb-3">
                Contributi amichevoli della brigata
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {snapshot.players.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-brown/15 bg-white p-4 flex items-center gap-3"
                  >
                    <ChefAvatarSvg avatar={p.avatar} size={52} />
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold truncate">{p.nickname}</p>
                      <p className="text-xs text-brown-soft">
                        Serviti: <strong>{p.contributions?.ordersServed || 0}</strong> · Piastra:{' '}
                        <strong>{p.contributions?.ingredientsCooked || 0}</strong>
                      </p>
                      <p className="text-xs text-brown-soft">
                        Ingredienti: <strong>{p.contributions?.ingredientsAssembled || 0}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Azioni post-partita */}
            <div className="pt-4 border-t border-brown/12 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLeaveLobby}
                className="btn btn-secondary"
              >
                Esci al menu principale
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!session) return;
                    const res = await apiReturnToLobby(session);
                    applyServerSnapshot(res.snapshot);
                  }}
                  className="btn btn-outline"
                >
                  Torna alla lobby
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={handleStartMatch}
                    className="btn btn-primary"
                  >
                    Rigioca subito
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modale Ricettario e Archetipi Clienti */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown/50 p-4 backdrop-blur-xs"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="surface max-h-[85dvh] w-full max-w-3xl overflow-y-auto p-5 sm:p-7 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-brown/12 pb-4">
              <div>
                <h2 id="guide-modal-title" className="font-display text-2xl font-bold">
                  Menu del Banco & Clienti di Napoli
                </h2>
                <p className="text-xs text-brown-soft">
                  Tutte le 8 ricette ufficiali e gli 8 archetipi comportamentali dei clienti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Chiudi
              </button>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-2.5">I Panini in Lavagna (8)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RECIPES.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-brown/12 bg-cream/50 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-bold">{r.name}</p>
                      <span className="text-xs font-bold text-terracotta-deep">
                        {r.basePoints} pt {r.requiresGrill ? '· Piastra' : '· No piastra'}
                      </span>
                    </div>
                    <p className="text-xs text-brown-soft">{r.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.ingredients.map((ingId) => (
                        <span
                          key={ingId}
                          className="rounded-sm bg-white px-2 py-0.5 text-[11px] font-semibold border border-brown/10"
                        >
                          {getIngredient(ingId)?.shortName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-2.5">I Clienti del Quartiere (8)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CUSTOMER_ARCHETYPES.map((arch) => (
                  <div
                    key={arch.id}
                    className="rounded-xl border border-brown/12 bg-white p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold">{arch.name}</span>
                      <span className="rounded-sm bg-terracotta/15 px-2 py-0.5 text-[11px] font-bold text-terracotta-deep">
                        {arch.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-brown-soft">{arch.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
