/**
 * Pagina `/game` — "Il Banco del Gambero" (Gioco Co-Op nel Browser 1–4 giocatori).
 * Isolata dal resto dell'app di recensioni: non usa `RestaurantsContext` né l'auth admin.
 *
 * Architettura della schermata di gioco (`view === 'playing'`):
 * 1. Barra Superiore Turno & Brigata Co-Op (Timer, Fase, Punteggio, Combo, Ruoli e stato live dei 1–4 cuochi)
 * 2. Fascia Bancone Clienti & Comande Attive (Avatar con umore dinamico, timer pazienza, note SENZA/EXTRA,
 *    stato preparazione del tagliere associato e consegna rapida quando il panino è pronto)
 * 3. Area Operativa Cucina a 3 Postazioni Distinte:
 *    - Postazione A: Piastra in Ghisa (4 fuochi con pre-allarme bruciatura + Scarta) & Vassoio Caldo condiviso
 *    - Postazione B: Taglieri di Assemblaggio (Banco 1 / Banco 2) con Checklist passo-passo,
 *      rilevamento immediato errori (`SandwichStackSvg`) e pulsante primario di Consegna
 *    - Postazione C: Dispensa Napoletana con 21 illustrazioni dedicate e badge contestuali (`★ Serve`, `✓ Messo`, `⛔ Evita`)
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESSORIES,
  APRON_COLORS,
  BRIGADE_ROLES,
  CHEF_PERSONAS,
  getBrigadeRole,
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
  getScalingForPlayers,
  inspectBoardAgainstTicket,
} from '../game/engine/gameEngine.js';
import {
  ChefAvatarSvg,
  CustomerAvatarSvg,
  GameUiIcon,
  GrillBurnerSvg,
  IngredientIconSvg,
  SandwichStackSvg,
} from '../game/components/GameArt.jsx';
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

const loadPhaserCanvas = () => import('../game/phaser/KitchenPhaserCanvas.jsx');
const KitchenPhaserCanvas = lazy(loadPhaserCanvas);

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
  const [avatar, setAvatar] = useState(() => normalizePlayerAvatar(savedProfile.avatar));
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [session, setSession] = useState(() => loadActiveGameSession());
  const [snapshot, setSnapshot] = useState(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  const [selectedBoardIndex, setSelectedBoardIndex] = useState(0);
  const [stationTab, setStationTab] = useState('all'); // 'all' | 'bread' | 'cold' | 'warm' | 'sauce'
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showPanorama, setShowPanorama] = useState(true);

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
    }, 3000);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

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

  useEffect(() => {
    if (snapshot?.status !== 'playing') return undefined;
    const id = setInterval(() => {
      setNowTickMs(Date.now() + serverTimeOffsetMs);
    }, 200);
    return () => clearInterval(id);
  }, [snapshot?.status, serverTimeOffsetMs]);

  const effectiveNowMs =
    snapshot?.status === 'playing' ? nowTickMs : Date.now() + serverTimeOffsetMs;

  const handleCreateLobby = async (e) => {
    e?.preventDefault();
    unlockAudioOnGesture();
    setErrorBanner('');
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setErrorBanner('Inserisci un nickname tra 2 e 16 caratteri.');
      return;
    }
    const cleanAv = normalizePlayerAvatar(avatar);
    saveProfile({ nickname: trimmed, avatar: cleanAv });
    setNetState('loading');
    try {
      const res = await apiCreateLobby({ nickname: trimmed, avatar: cleanAv });
      setSession({
        code: res.snapshot.code,
        playerId: res.playerId,
        playerToken: res.playerToken,
      });
      applyServerSnapshot(res.snapshot);
      if (cleanAv.role === 'banco2') setSelectedBoardIndex(1);
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
    const cleanAv = normalizePlayerAvatar(avatar);
    saveProfile({ nickname: trimmed, avatar: cleanAv });
    setNetState('loading');
    try {
      const existing = loadActiveGameSession();
      const res = await apiJoinLobby({
        code: cleanCode,
        nickname: trimmed,
        avatar: cleanAv,
        existingPlayerId: existing?.code === cleanCode ? existing.playerId : null,
        existingToken: existing?.code === cleanCode ? existing.playerToken : null,
      });
      setSession({
        code: res.snapshot.code,
        playerId: res.playerId,
        playerToken: res.playerToken,
      });
      applyServerSnapshot(res.snapshot);
      if (cleanAv.role === 'banco2') setSelectedBoardIndex(1);
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

  const handleChangeMyRole = async (nextRoleId) => {
    const updatedAvatar = normalizePlayerAvatar({ ...avatar, role: nextRoleId });
    setAvatar(updatedAvatar);
    saveProfile({ nickname: nickname.trim() || 'Cuoco', avatar: updatedAvatar });
    if (nextRoleId === 'banco1') setSelectedBoardIndex(0);
    if (nextRoleId === 'banco2') setSelectedBoardIndex(1);

    if (session && snapshot) {
      try {
        const res = await apiUpdatePlayer({
          ...session,
          avatar: updatedAvatar,
        });
        applyServerSnapshot(res.snapshot);
      } catch {
        // ignore transient error
      }
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
      showNotice('Saracinesca alzata! Guardate le comande in alto e coordinatevi!');
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

      // Aggiornamento ottimistico immediato
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
        } else if (fullAction.type === 'COLLECT_GRILL' || fullAction.type === 'DISCARD_GRILL') {
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

  // Scorciatoie da tastiera in partita
  useEffect(() => {
    if (snapshot?.status !== 'playing') return undefined;

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Tab' && e.shiftKey) return;

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

  const view = snapshot?.status || 'menu';
  const mePlayer = snapshot?.players?.find((p) => p.id === session?.playerId) || null;
  const isHost = Boolean(mePlayer?.isHost);
  const prepBoards = snapshot?.game?.prepBoards || [];
  const activeBoard = prepBoards[selectedBoardIndex] || {
    boardIndex: selectedBoardIndex,
    targetTicketId: null,
    ingredients: [],
    updatedByPlayerId: null,
  };
  const activeTickets = snapshot?.game?.activeTickets || [];
  const activeTicket =
    activeTickets.find((t) => t.id === activeBoard.targetTicketId) ||
    activeTickets[0] ||
    null;

  // Analisi in tempo reale del tagliere selezionato rispetto al ticket attivo
  const activeBoardAnalysis = useMemo(
    () => inspectBoardAgainstTicket(activeBoard.ingredients || [], activeTicket),
    [activeBoard.ingredients, activeTicket],
  );

  // Calcola quante proteine da griglia servono in questo momento tra tutti i ticket attivi
  // (al netto di quelle già nei panini, nel vassoio caldo o già sulla piastra)
  const grillDemandByIngredient = useMemo(() => {
    const demand = {};
    for (const gIng of GRILLABLE_INGREDIENTS) {
      let neededTotal = 0;
      for (const tkt of activeTickets) {
        const isThinking = Boolean(tkt.thinkingUntilMs && effectiveNowMs < tkt.thinkingUntilMs);
        if (!isThinking) {
          for (const id of tkt.targetIngredients || []) {
            if (id === gIng.id) neededTotal += 1;
          }
        }
      }
      let alreadyInProgressOrDone = 0;
      for (const b of prepBoards) {
        for (const id of b.ingredients || []) {
          if (id === gIng.id) alreadyInProgressOrDone += 1;
        }
      }
      for (const trayItem of snapshot?.game?.cookedTray || []) {
        if (trayItem.ingredientId === gIng.id) alreadyInProgressOrDone += 1;
      }
      for (const slot of snapshot?.game?.grillSlots || []) {
        if (slot.ingredientId === gIng.id) {
          const st = getGrillSlotStatus(slot, effectiveNowMs);
          if (st.state !== COOK_STATES.BURNED) alreadyInProgressOrDone += 1;
        }
      }
      demand[gIng.id] = Math.max(0, neededTotal - alreadyInProgressOrDone);
    }
    return demand;
  }, [activeTickets, prepBoards, snapshot?.game?.cookedTray, snapshot?.game?.grillSlots, effectiveNowMs]);

  // Ingredienti della dispensa (escludiamo le 4 proteine crude che hanno già la loro postazione Piastra dedicata,
  // ma se una proteina è PRONTA sulla piastra o nel Vassoio Caldo mostriamo anche l'azione rapida se in vista "Tutti")
  const pantryIngredients = useMemo(() => {
    const nonGrill = INGREDIENTS.filter((i) => !i.requiresGrill);
    if (stationTab === 'all') return nonGrill;
    return nonGrill.filter((i) => i.station === stationTab);
  }, [stationTab]);

  const remainingRoundMs = snapshot?.game?.endsAtMs
    ? Math.max(0, snapshot.game.endsAtMs - effectiveNowMs)
    : 0;
  const currentPhase = snapshot?.game?.startedAtMs
    ? getMatchPhase(Math.max(0, effectiveNowMs - snapshot.game.startedAtMs))
    : { index: 1, label: 'Inizio servizio' };
  const maxTicketSlots = getScalingForPlayers(
    snapshot?.game?.playerCount || snapshot?.players?.length || 1,
  ).maxActiveTickets;

  const findPlayerName = (playerId) => {
    if (!playerId) return null;
    return snapshot?.players?.find((p) => p.id === playerId)?.nickname || null;
  };

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
                    ? `Codice ${snapshot?.code || ''}`
                    : netState === 'reconnecting'
                      ? 'Riconnessione…'
                      : 'Sincronizzazione…'}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal((v) => !v)}
              className="btn btn-secondary btn-sm press"
              aria-expanded={showGuideModal}
            >
              <span>Ricettario</span>
            </button>

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

      {/* Banner Errori / Riconnessione */}
      <div className="mx-auto w-full max-w-content px-4 pt-2 sm:px-6" aria-live="polite">
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
            Connessione instabile: riconnessione allo stato autorevole della cucina in corso…
          </div>
        )}
      </div>

      {/* Contenuto Principale per Stato (Menu / Lobby / Partita / Risultato) */}
      <main className="mx-auto flex-1 w-full max-w-content px-4 pb-10 pt-1 sm:px-6">
        {/* ===================================================================
            VISTA 1: MENU PRINCIPALE & PERSONALIZZAZIONE CUOCO + RUOLO
           =================================================================== */}
        {view === 'menu' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
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
                    Scegli il tuo cuoco e il ruolo
                  </h2>
                  <p className="mt-1 text-sm text-brown-soft">
                    Nessun account richiesto. Scegli nome, divisa e il ruolo che preferisci tenere al Banco.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center bg-cream rounded-2xl p-3 border border-brown/10">
                  <ChefAvatarSvg avatar={avatar} size={72} showRoleBadge />
                  <div className="pr-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brown-soft">
                      {getBrigadeRole(avatar.role).label}
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

              {/* Scelta Ruolo Operativo di Brigata */}
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                  Ruolo preferito in cucina (modificabile anche in partita)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BRIGADE_ROLES.map((role) => {
                    const selected = avatar.role === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setAvatar((a) => ({ ...a, role: role.id }))}
                        aria-pressed={selected}
                        className={`press rounded-xl border p-3 text-left transition ${
                          selected
                            ? 'border-terracotta bg-terracotta/10 shadow-xs'
                            : 'border-brown/15 bg-white hover:bg-cream/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-brown">
                            {role.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${role.badgeClass}`}>
                            {role.shortLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-brown-soft">{role.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preset Archetipo Cuoco */}
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                  Preset Personaggio
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

              {/* Personalizzazione Dettagliata */}
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
                  Gioca da solo o invita fino a 3 amici condividendo il codice partita di 6 caratteri.
                </p>
              </div>

              <div className="rounded-2xl border border-brown/12 bg-cream/60 p-4">
                <h3 className="font-display text-lg font-bold">Nuova brigata</h3>
                <p className="mt-1 text-xs text-brown-soft">
                  Genera subito un codice stanza e alza la saracinesca quando siete pronti.
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

              {/* Guida visiva in 3 passi */}
              <div className="rounded-2xl border border-brown/10 bg-white/90 p-4 text-xs text-brown-soft space-y-2.5">
                <p className="font-bold text-brown text-sm">Come si gioca in 3 mosse (turno da 165s):</p>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[11px] font-extrabold text-white">
                    1
                  </span>
                  <p>
                    <strong>Guarda le Comande in alto:</strong> ogni cliente chiede un panino (con eventuali note{' '}
                    <strong className="text-danger">SENZA</strong> o <strong className="text-terracotta-deep">EXTRA</strong>).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[11px] font-extrabold text-white">
                    2
                  </span>
                  <p>
                    <strong>Cuoci sulla Piastra (se serve 🔥):</strong> Manzo, Pollo, Salsiccia e Burger Veg vanno cotti nei 4 fuochi e spostati sul tagliere o nel <strong>Vassoio Caldo</strong> prima che brucino.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green text-[11px] font-extrabold text-white">
                    3
                  </span>
                  <p>
                    <strong>Assembla e Consegna:</strong> tocca gli ingredienti evidenziati con <strong>★ Serve</strong>. Quando la checklist è tutta verde, premi <strong>Consegna</strong>!
                  </p>
                </div>
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
                  Coordinate i ruoli della brigata (Piastra, Banco 1, Banco 2, Jolly) prima di alzare la saracinesca.
                </p>
              </div>

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

            {/* Selettore rapido del proprio ruolo in Lobby */}
            <div className="mt-5 rounded-2xl border border-brown/12 bg-cream/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-brown">
                Il tuo ruolo nella brigata:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {BRIGADE_ROLES.map((role) => {
                  const myRole = mePlayer?.avatar?.role || avatar.role || 'jolly';
                  const active = myRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleChangeMyRole(role.id)}
                      aria-pressed={active}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold min-h-[38px] transition ${
                        active
                          ? `${role.badgeClass} shadow-xs`
                          : 'bg-white border border-brown/15 text-brown hover:bg-cream'
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Elenco 4 Slot Giocatori */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, idx) => {
                const player = snapshot.players[idx];
                if (!player) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="rounded-2xl border-2 border-dashed border-brown/15 bg-cream/40 p-5 flex flex-col items-center justify-center text-center min-h-[190px]"
                    >
                      <p className="font-display text-base font-bold text-brown-soft">
                        Posto Cuoco #{idx + 1}
                      </p>
                      <p className="mt-1 text-xs text-brown-soft">
                        Invita un amico col codice <strong>{snapshot.code}</strong>
                      </p>
                    </div>
                  );
                }

                const isMe = player.id === session?.playerId;
                const roleInfo = getBrigadeRole(player.avatar?.role);
                return (
                  <div
                    key={player.id}
                    className={`rounded-2xl border p-4 flex flex-col items-center text-center min-h-[190px] justify-between ${
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
                        {player.isHost ? 'Capo Brigata' : `Cuoco #${idx + 1}`}
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

                    <div className="my-2 flex flex-col items-center">
                      <ChefAvatarSvg avatar={player.avatar} size={68} showRoleBadge />
                      <p className="mt-3 font-display text-lg font-bold text-brown">
                        {player.nickname} {isMe ? '(Tu)' : ''}
                      </p>
                      <p className="text-[11px] font-semibold text-brown-soft">
                        {roleInfo.label}
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
            VISTA 3: PARTITA IN CORSO — INTERFACCIA RISTORANTE RIPROGETTATA
           =================================================================== */}
        {view === 'playing' && snapshot?.game && (
          <div className="space-y-3.5">
            {/* ---------------------------------------------------------------
                ZONA 0: BARRA SUPERIORE TURNO, PUNTEGGIO & BRIGATA LIVE
               --------------------------------------------------------------- */}
            <section
              aria-label="Stato del turno, punteggio e brigata"
              className="surface p-3 sm:p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
                  {/* Timer Turno */}
                  <div
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-cream-soft ${
                      remainingRoundMs <= 25_000 ? 'bg-danger' : 'bg-brown'
                    }`}
                  >
                    <GameUiIcon name="clock" size={18} />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider opacity-85 leading-none">
                        {currentPhase.label}
                      </p>
                      <p
                        className="font-mono text-lg sm:text-xl font-extrabold tabular leading-tight"
                        data-testid="match-timer"
                      >
                        {formatTimer(remainingRoundMs)}
                      </p>
                    </div>
                  </div>

                  {/* Punteggio Squadra */}
                  <div className="rounded-xl border border-brown/15 bg-cream px-3.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brown-soft leading-none">
                      Punteggio Squadra
                    </p>
                    <p
                      className="font-display text-xl sm:text-2xl font-extrabold text-terracotta-deep tabular leading-tight"
                      data-testid="team-score"
                    >
                      {snapshot.game.score} <span className="text-xs font-sans font-semibold">pt</span>
                    </p>
                  </div>

                  {/* Indicatori Serviti / Combo / Errori */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-xl border border-brown/15 bg-white px-2.5 py-1.5 text-xs font-bold">
                      Serviti: <strong className="tabular text-green-deep">{snapshot.game.stats.ordersServed}</strong>
                    </span>
                    {snapshot.game.combo >= 2 && (
                      <span className="rounded-xl bg-rating px-2.5 py-1.5 text-xs font-extrabold text-brown shadow-xs">
                        Combo ×{snapshot.game.combo}
                      </span>
                    )}
                    {(snapshot.game.stats.customersLost > 0 || snapshot.game.stats.burnedCount > 0) && (
                      <span className="rounded-xl border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger">
                        Persi: {snapshot.game.stats.customersLost} · Bruciati: {snapshot.game.stats.burnedCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notifica Evento / Azione Corrente + Toggle Panorama */}
                <div className="flex items-center gap-2 flex-1 min-w-[240px] justify-end">
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex-1 rounded-xl border border-brown/12 bg-white px-3 py-1.5 text-xs font-semibold text-brown flex items-center justify-between gap-2 min-w-0"
                  >
                    <span className="truncate">
                      {actionToast ||
                        snapshot.game.scoreEvents?.[0]?.message ||
                        'Scegli una comanda e assembla il panino!'}
                    </span>
                    {snapshot.game.scoreEvents?.[0]?.delta !== 0 &&
                      snapshot.game.scoreEvents?.[0]?.delta !== undefined && (
                        <span
                          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-extrabold tabular ${
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

                  <button
                    type="button"
                    onClick={() => setShowPanorama((v) => !v)}
                    aria-pressed={showPanorama}
                    className="btn btn-secondary btn-sm shrink-0 text-xs"
                  >
                    {showPanorama ? 'Nascondi vista sala' : 'Mostra vista sala'}
                  </button>
                </div>
              </div>

              {/* Barra Brigata Co-Op (mostra ruolo e stato di ciascun giocatore + switch rapido ruolo) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-brown/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brown-soft">
                    Brigata in cucina ({snapshot.players.length}/4):
                  </span>
                  {snapshot.players.map((p) => {
                    const isMe = p.id === session?.playerId;
                    const rInfo = getBrigadeRole(p.avatar?.role);
                    return (
                      <div
                        key={p.id}
                        className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs ${
                          isMe
                            ? 'border-terracotta bg-white font-bold shadow-2xs'
                            : 'border-brown/12 bg-cream/60 font-semibold'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.isOnline ? 'bg-green' : 'bg-rating'
                          }`}
                        />
                        <ChefAvatarSvg avatar={p.avatar} size={24} />
                        <span className="text-brown">
                          {p.nickname}
                          {isMe ? ' (Tu)' : ''}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${rInfo.badgeClass}`}>
                          {rInfo.shortLabel}
                        </span>
                        <span className="text-[11px] text-brown-soft tabular">
                          🥪{p.contributions?.ordersServed || 0} 🔥{p.contributions?.ingredientsCooked || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Cambio rapido ruolo personale senza uscire dalla cucina */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-brown-soft mr-1 hidden sm:inline">
                    Tuo ruolo:
                  </span>
                  {BRIGADE_ROLES.map((r) => {
                    const active = (mePlayer?.avatar?.role || avatar.role) === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleChangeMyRole(r.id)}
                        aria-pressed={active}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          active
                            ? `${r.badgeClass}`
                            : 'bg-cream text-brown-soft hover:bg-brown/10'
                        }`}
                      >
                        {r.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Panorama Animato Phaser 4 (compatto, disattivabile con 1 click su schermi piccoli) */}
            {showPanorama && (
              <Suspense
                fallback={
                  <div className="surface flex h-36 items-center justify-center border border-brown/15 bg-cream-soft text-xs font-semibold text-brown-soft">
                    Caricamento panorama animato della cucina…
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
                  onServeOrder={(bIdx, ticketId) =>
                    dispatchKitchenAction({
                      type: 'SERVE_ORDER',
                      boardIndex: bIdx,
                      ticketId,
                    })
                  }
                />
              </Suspense>
            )}

            {/* ---------------------------------------------------------------
                ZONA 1: FASCIA ORIZZONTALE CLIENTI & COMANDE ATTIVE
                Mostra a colpo d'occhio: chi aspetta, quanto tempo resta,
                note SENZA/EXTRA, ingredienti mancanti e bottone Consegna!
               --------------------------------------------------------------- */}
            <section
              aria-labelledby="tickets-station-heading"
              className="surface p-3.5 sm:p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-xs font-extrabold text-white">
                    1
                  </span>
                  <h2 id="tickets-station-heading" className="font-display text-base sm:text-lg font-bold">
                    Clienti al Bancone & Comande Attive ({activeTickets.length}/{maxTicketSlots})
                  </h2>
                </div>
                <p className="text-xs font-semibold text-brown-soft">
                  Tocca una comanda per prepararla sul <strong>Banco {selectedBoardIndex + 1}</strong> · Tasti [1–6]
                </p>
              </div>

              {activeTickets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-brown/20 p-4 text-center text-sm text-brown-soft">
                  Nuovo cliente in arrivo al bancone…
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeTickets.map((tkt, idx) => {
                    // Verifica quale banco (Banco 1 o Banco 2) sta preparando questo ticket
                    const assignedBoardIdx = prepBoards.findIndex((b) => b.targetTicketId === tkt.id);
                    const isCurrentTarget = activeTicket?.id === tkt.id;
                    const boardForThisTicket =
                      assignedBoardIdx !== -1
                        ? prepBoards[assignedBoardIdx]
                        : isCurrentTarget
                          ? activeBoard
                          : null;

                    const ticketAnalysis = inspectBoardAgainstTicket(
                      boardForThisTicket?.ingredients || [],
                      tkt,
                    );
                    const isReadyToServe = ticketAnalysis.ok;

                    const remMs = Math.max(0, tkt.expiresAtMs - effectiveNowMs);
                    const ratio = tkt.patienceMs > 0 ? Math.min(1, remMs / tkt.patienceMs) : 0;
                    const isThinking = Boolean(
                      tkt.thinkingUntilMs && effectiveNowMs < tkt.thinkingUntilMs,
                    );
                    const thinkingLeftSec = isThinking
                      ? Math.max(1, Math.ceil((tkt.thinkingUntilMs - effectiveNowMs) / 1000))
                      : 0;

                    return (
                      <div
                        key={tkt.id}
                        data-testid={`ticket-card-${idx}`}
                        className={`rounded-2xl border-2 p-3 flex flex-col justify-between transition ${
                          isReadyToServe
                            ? 'border-green bg-green/10 shadow-sm ring-2 ring-green/30'
                            : isCurrentTarget
                              ? 'border-terracotta bg-white shadow-sm ring-2 ring-terracotta/20'
                              : ratio <= 0.28
                                ? 'border-danger/60 bg-danger/5'
                                : 'border-brown/15 bg-cream/60'
                        }`}
                      >
                        <div>
                          {/* Testata Cliente: Avatar Umore + Nome + Archetipo + Timer Secondi */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CustomerAvatarSvg
                                appearance={tkt.appearance}
                                patienceRatio={ratio}
                                isThinking={isThinking}
                                archetypeId={tkt.archetypeId}
                                size={48}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-display text-sm font-bold text-brown">
                                    #{idx + 1} {tkt.customerName}
                                  </span>
                                  <span className="rounded-sm bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-extrabold text-terracotta-deep">
                                    {tkt.badgeLabel}
                                  </span>
                                  {assignedBoardIdx !== -1 && (
                                    <span
                                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold text-white ${
                                        assignedBoardIdx === 0 ? 'bg-terracotta' : 'bg-green-deep'
                                      }`}
                                    >
                                      Banco {assignedBoardIdx + 1}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] italic text-brown-soft truncate">
                                  “{tkt.quote}”
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block rounded-lg px-2 py-0.5 font-mono text-xs font-extrabold tabular ${
                                  ratio <= 0.28
                                    ? 'bg-danger text-white'
                                    : ratio <= 0.55
                                      ? 'bg-rating/30 text-brown'
                                      : 'bg-green/15 text-green-deep'
                                }`}
                              >
                                {Math.ceil(remMs / 1000)}s
                              </span>
                            </div>
                          </div>

                          {/* Barra di pazienza */}
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
                                ratio > 0.55
                                  ? 'bg-green'
                                  : ratio > 0.28
                                    ? 'bg-rating'
                                    : 'bg-danger'
                              }`}
                              style={{ width: `${Math.max(5, Math.round(ratio * 100))}%` }}
                            />
                          </div>

                          {/* Corpo Comanda: Ricetta, Modificatori e Ingredienti */}
                          <div className="mt-2.5">
                            {isThinking ? (
                              <div className="rounded-xl border border-dashed border-brown/25 bg-white/80 p-2.5 text-center">
                                <p className="font-display text-xs font-bold text-brown">
                                  💭 Cliente indeciso: sceglie tra {thinkingLeftSec}s…
                                </p>
                                <p className="text-[11px] text-brown-soft mt-0.5">
                                  Tocca <strong>“Fissa comanda”</strong> qui sotto per farlo decidere subito!
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-display text-sm font-bold text-brown">
                                    {tkt.recipeName}
                                  </p>
                                  <span className="text-[11px] font-extrabold text-green-deep tabular">
                                    +{tkt.basePoints} pt
                                  </span>
                                </div>

                                {/* Banner Modificatore ad alta visibilità */}
                                {tkt.modifiers?.exclude && (
                                  <div className="mt-1 rounded-lg bg-danger/15 border border-danger/30 px-2 py-1 text-[11px] font-extrabold text-danger">
                                    ⛔ SENZA {getIngredient(tkt.modifiers.exclude)?.shortName?.toUpperCase()}
                                  </div>
                                )}
                                {tkt.modifiers?.add && (
                                  <div className="mt-1 rounded-lg bg-terracotta/15 border border-terracotta/30 px-2 py-1 text-[11px] font-extrabold text-terracotta-deep">
                                    ➕ EXTRA {getIngredient(tkt.modifiers.add)?.shortName?.toUpperCase()}
                                  </div>
                                )}
                                {tkt.modifiers?.swap && (
                                  <div className="mt-1 rounded-lg bg-green/15 border border-green/30 px-2 py-1 text-[11px] font-extrabold text-green-deep">
                                    🔄 CON {getIngredient(tkt.modifiers.swap.to)?.shortName?.toUpperCase()} (al posto di{' '}
                                    {getIngredient(tkt.modifiers.swap.from)?.shortName})
                                  </div>
                                )}

                                {/* Elenco ingredienti richiesti (spuntati SOLO per il banco che prepara questo ticket) */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {ticketAnalysis.checklist.map((item, ingIdx) => {
                                    const ing = getIngredient(item.ingredientId);
                                    return (
                                      <span
                                        key={`${tkt.id}-${item.ingredientId}-${ingIdx}`}
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                                          item.present
                                            ? 'border-green bg-green text-white'
                                            : ing?.requiresGrill
                                              ? 'border-terracotta/40 bg-white text-brown'
                                              : 'border-brown/15 bg-white text-brown'
                                        }`}
                                      >
                                        <IngredientIconSvg ingredientId={item.ingredientId} size={15} />
                                        <span>{ing?.shortName || item.ingredientId}</span>
                                        {item.present ? (
                                          <span>✓</span>
                                        ) : ing?.requiresGrill ? (
                                          <span className="text-[10px] text-terracotta-deep font-extrabold">
                                            🔥
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Pulsanti Azione Comanda */}
                        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-brown/10">
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
                            className={`btn btn-sm flex-1 text-xs ${
                              isCurrentTarget ? 'btn-secondary' : 'btn-outline'
                            }`}
                          >
                            {isThinking
                              ? 'Fissa comanda'
                              : isCurrentTarget
                                ? `In preparazione (Banco ${selectedBoardIndex + 1})`
                                : `Prepara su Banco ${selectedBoardIndex + 1}`}
                          </button>

                          <button
                            type="button"
                            disabled={
                              netState === 'reconnecting' ||
                              isThinking ||
                              (boardForThisTicket?.ingredients?.length || 0) === 0
                            }
                            onClick={() =>
                              dispatchKitchenAction({
                                type: 'SERVE_ORDER',
                                boardIndex:
                                  assignedBoardIdx !== -1 ? assignedBoardIdx : selectedBoardIndex,
                                ticketId: tkt.id,
                              })
                            }
                            data-testid={`serve-ticket-${idx}`}
                            className={`btn btn-sm text-xs ${
                              isReadyToServe ? 'btn-primary ring-2 ring-green/40' : 'btn-primary'
                            }`}
                          >
                            <GameUiIcon name="bell" size={14} />
                            <span>{isReadyToServe ? 'PRONTO! Servi' : 'Consegna'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ---------------------------------------------------------------
                ZONA 2: POSTAZIONE OPERATIVA CUCINA A 3 COLONNE CHIARE
                - Colonna A (4 col): Piastra a 4 Fuochi + Vassoio Caldo
                - Colonna B (4 col): Tagliere di Assemblaggio + Checklist + Consegna
                - Colonna C (4 col): Dispensa Ingredienti Napoletani
               --------------------------------------------------------------- */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
              {/* =============================================================
                  COLONNA A: PIASTRA IN GHISA (4 FUOCHI) & VASSOIO CALDO
                 ============================================================= */}
              <section
                aria-labelledby="grill-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-xs font-extrabold text-white">
                      2
                    </span>
                    <h2 id="grill-station-heading" className="font-display text-base sm:text-lg font-bold">
                      Piastra Calda & Vassoio
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-brown-soft">Tasti [Q W E R]</span>
                </div>

                {/* Avvio Cottura Proteine (con badge "Serve ora!" quando richieste dai clienti) */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                    Metti a cuocere sulla piastra:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {GRILLABLE_INGREDIENTS.map((ing) => {
                      const neededCount = grillDemandByIngredient[ing.id] || 0;
                      return (
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
                          className={`press relative flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-xs font-bold min-h-[54px] transition ${
                            neededCount > 0
                              ? 'border-terracotta bg-white shadow-xs ring-2 ring-terracotta/20'
                              : 'border-brown/15 bg-white hover:border-terracotta'
                          }`}
                        >
                          <IngredientIconSvg ingredientId={ing.id} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="text-brown truncate">{ing.shortName}</p>
                            <p className="text-[11px] font-normal text-brown-soft">
                              {(ing.cookTimeMs / 1000).toFixed(1)}s cottura
                            </p>
                          </div>
                          {neededCount > 0 && (
                            <span className="rounded-full bg-terracotta px-2 py-0.5 text-[10px] font-extrabold text-white">
                              Serve ×{neededCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* I 4 Fuochi della Piastra */}
                <div className="space-y-2 pt-2 border-t border-brown/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft">
                    I 4 Fuochi della Piastra:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {snapshot.game.grillSlots.map((slot, sIdx) => {
                      const status = getGrillSlotStatus(slot, effectiveNowMs);
                      const ing = slot.ingredientId ? getIngredient(slot.ingredientId) : null;
                      const keyHint = ['Q', 'W', 'E', 'R'][sIdx];
                      const cookByName = findPlayerName(slot.startedByPlayerId);

                      return (
                        <div
                          key={slot.slotIndex}
                          data-testid={`grill-slot-${sIdx}`}
                          className={`rounded-xl border-2 p-3 flex flex-col justify-between gap-2 transition ${
                            !slot.ingredientId
                              ? 'border-dashed border-brown/20 bg-cream/40'
                              : status.state === COOK_STATES.COOKED && status.aboutToBurn
                                ? 'border-danger bg-danger/15 ring-2 ring-danger/30'
                                : status.state === COOK_STATES.COOKED
                                  ? 'border-green bg-green/12 shadow-xs'
                                  : status.state === COOK_STATES.BURNED
                                    ? 'border-danger bg-danger/10'
                                    : 'border-rating bg-rating/12'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>
                              Fuoco {sIdx + 1} [{keyHint}]
                            </span>
                            <span
                              className={
                                status.state === COOK_STATES.COOKED && status.aboutToBurn
                                  ? 'text-danger font-extrabold'
                                  : status.state === COOK_STATES.COOKED
                                    ? 'text-green-deep font-extrabold'
                                    : status.state === COOK_STATES.BURNED
                                      ? 'text-danger font-extrabold'
                                      : 'text-brown-soft'
                              }
                            >
                              {!slot.ingredientId
                                ? 'Libero'
                                : status.state === COOK_STATES.COOKING
                                  ? `Cuoce ${(status.remainingMs / 1000).toFixed(1)}s`
                                  : status.state === COOK_STATES.COOKED && status.aboutToBurn
                                    ? `⚠ BRUCIA TRA ${(status.remainingMs / 1000).toFixed(1)}s!`
                                    : status.state === COOK_STATES.COOKED
                                      ? `PRONTO (${(status.remainingMs / 1000).toFixed(0)}s)`
                                      : 'BRUCIATO!'}
                            </span>
                          </div>

                          {ing ? (
                            <>
                              <div className="flex items-center gap-2.5">
                                <GrillBurnerSvg
                                  ingredientId={ing.id}
                                  cookState={status.state}
                                  aboutToBurn={status.aboutToBurn}
                                  size={42}
                                />
                                <div className="min-w-0">
                                  <p className="font-display text-sm font-bold truncate">
                                    {ing.shortName}
                                  </p>
                                  {cookByName && (
                                    <p className="text-[10px] font-semibold text-brown-soft truncate">
                                      Messo da {cookByName}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Barra avanzamento cottura o tempo prima di bruciare */}
                              <div className="h-2 w-full overflow-hidden rounded-full bg-brown/15">
                                <div
                                  className={`h-full transition-all ${
                                    status.state === COOK_STATES.COOKING
                                      ? 'bg-rating'
                                      : status.state === COOK_STATES.COOKED && !status.aboutToBurn
                                        ? 'bg-green'
                                        : 'bg-danger'
                                  }`}
                                  style={{
                                    width: `${Math.max(
                                      6,
                                      Math.round(
                                        (status.state === COOK_STATES.COOKING
                                          ? status.progress
                                          : status.state === COOK_STATES.COOKED
                                            ? 1 - status.burnProgress
                                            : 1) * 100,
                                      ),
                                    )}%`,
                                  }}
                                />
                              </div>

                              {/* Azioni esplicite sullo slot */}
                              <div className="flex items-center gap-1.5">
                                {status.state === COOK_STATES.COOKING && (
                                  <>
                                    <button
                                      type="button"
                                      disabled
                                      data-testid={`collect-grill-${sIdx}`}
                                      className="btn btn-secondary btn-sm flex-1 text-xs"
                                    >
                                      Sfrigola…
                                    </button>
                                    <button
                                      type="button"
                                      disabled={netState === 'reconnecting'}
                                      onClick={() =>
                                        dispatchKitchenAction({
                                          type: 'DISCARD_GRILL',
                                          slotIndex: sIdx,
                                        })
                                      }
                                      title="Togli dalla piastra"
                                      className="btn btn-secondary btn-sm px-2.5 text-xs text-danger"
                                    >
                                      <GameUiIcon name="trash" size={14} />
                                    </button>
                                  </>
                                )}

                                {status.state === COOK_STATES.COOKED && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={netState === 'reconnecting'}
                                      onClick={() =>
                                        dispatchKitchenAction({
                                          type: 'COLLECT_GRILL',
                                          slotIndex: sIdx,
                                          toBoardIndex: selectedBoardIndex,
                                        })
                                      }
                                      data-testid={`collect-grill-${sIdx}`}
                                      className="btn btn-primary btn-sm flex-1 text-xs"
                                    >
                                      → Banco {selectedBoardIndex + 1}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={netState === 'reconnecting'}
                                      onClick={() =>
                                        dispatchKitchenAction({
                                          type: 'COLLECT_GRILL',
                                          slotIndex: sIdx,
                                          toBoardIndex: null,
                                        })
                                      }
                                      title="Salva nel Vassoio Caldo (non brucia più!)"
                                      className="btn btn-secondary btn-sm px-2.5 text-xs"
                                    >
                                      → Vassoio
                                    </button>
                                  </>
                                )}

                                {status.state === COOK_STATES.BURNED && (
                                  <button
                                    type="button"
                                    disabled={netState === 'reconnecting'}
                                    onClick={() =>
                                      dispatchKitchenAction({
                                        type: 'COLLECT_GRILL',
                                        slotIndex: sIdx,
                                      })
                                    }
                                    data-testid={`collect-grill-${sIdx}`}
                                    className="btn btn-danger btn-sm w-full text-xs"
                                  >
                                    Pulisci (-15 pt)
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-brown-soft py-3 text-center">
                              Fuoco libero · Tocca una carne qui sopra
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vassoio Caldo Condiviso (dove le cotture pronte non bruciano mai) */}
                <div className="rounded-2xl border border-brown/15 bg-cream/70 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-brown">
                      Vassoio Caldo Condiviso ({snapshot.game.cookedTray.length}/6)
                    </p>
                    <span className="text-[11px] font-semibold text-green-deep">
                      Non brucia mai
                    </span>
                  </div>
                  {snapshot.game.cookedTray.length === 0 ? (
                    <p className="text-xs text-brown-soft">
                      Usa <strong>“→ Vassoio”</strong> sulla piastra per mettere da parte le cotture pronte per i compagni!
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
                            className="press inline-flex items-center gap-1.5 rounded-xl border border-green bg-white px-2.5 py-1.5 text-xs font-bold text-green-deep shadow-2xs min-h-[40px]"
                          >
                            <IngredientIconSvg ingredientId={item.ingredientId} size={20} />
                            <span>+ {ing?.shortName} (su Banco {selectedBoardIndex + 1})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* =============================================================
                  COLONNA B: TAGLIERE DI ASSEMBLAGGIO, CHECKLIST & CONSEGNA
                 ============================================================= */}
              <section
                aria-labelledby="assembly-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-xs font-extrabold text-white">
                      3
                    </span>
                    <h2 id="assembly-station-heading" className="font-display text-base sm:text-lg font-bold">
                      Tagliere & Consegna
                    </h2>
                  </div>

                  {/* Selettore Banco 1 / Banco 2 */}
                  <div className="inline-flex rounded-xl border border-brown/15 bg-cream p-1">
                    {[0, 1].map((bIdx) => {
                      const b = prepBoards[bIdx];
                      const bTicket = activeTickets.find((t) => t.id === b?.targetTicketId);
                      return (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => setSelectedBoardIndex(bIdx)}
                          aria-pressed={selectedBoardIndex === bIdx}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold min-h-[36px] transition ${
                            selectedBoardIndex === bIdx
                              ? 'bg-terracotta text-white shadow-xs'
                              : 'text-brown hover:bg-white/60'
                          }`}
                        >
                          Banco {bIdx + 1} ({b?.ingredients?.length || 0})
                          {bTicket ? ` · ${bTicket.customerName}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checklist Ricetta del Cliente Collegato */}
                <div className="rounded-2xl border border-brown/15 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brown-soft">
                        Comanda su Banco {selectedBoardIndex + 1}
                        {findPlayerName(activeBoard.updatedByPlayerId)
                          ? ` · Ultimo tocco: ${findPlayerName(activeBoard.updatedByPlayerId)}`
                          : ''}
                      </p>
                      <p className="font-display text-base font-bold text-brown">
                        {activeTicket
                          ? `${activeTicket.recipeName} per ${activeTicket.customerName}`
                          : 'Nessuna comanda selezionata'}
                      </p>
                    </div>
                    {activeBoard.ingredients.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          dispatchKitchenAction({
                            type: 'CLEAR_BOARD',
                            boardIndex: selectedBoardIndex,
                          })
                        }
                        className="text-xs text-danger underline font-bold"
                      >
                        Svuota tagliere
                      </button>
                    )}
                  </div>

                  {activeTicket && (
                    <div className="pt-1">
                      <p className="text-[11px] font-bold text-brown-soft mb-1.5">
                        Checklist ricetta (tocca un ingrediente mancante per aggiungerlo):
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {activeBoardAnalysis.checklist.map((item, idx) => {
                          const ing = getIngredient(item.ingredientId);
                          return (
                            <button
                              key={`chk-${item.ingredientId}-${idx}`}
                              type="button"
                              disabled={item.present || netState === 'reconnecting'}
                              onClick={() => {
                                if (ing?.requiresGrill) {
                                  // Se è già pronto in griglia o nel vassoio, ADD_INGREDIENT lo prende; altrimenti avvia la cottura!
                                  const hasReadyInTray = snapshot.game.cookedTray.some(
                                    (t) => t.ingredientId === ing.id,
                                  );
                                  const hasReadyOnGrill = snapshot.game.grillSlots.some(
                                    (s) =>
                                      s.ingredientId === ing.id &&
                                      getGrillSlotStatus(s, effectiveNowMs).state ===
                                        COOK_STATES.COOKED,
                                  );
                                  if (hasReadyInTray || hasReadyOnGrill) {
                                    dispatchKitchenAction({
                                      type: 'ADD_INGREDIENT',
                                      boardIndex: selectedBoardIndex,
                                      ingredientId: ing.id,
                                    });
                                  } else {
                                    dispatchKitchenAction({
                                      type: 'START_COOK',
                                      ingredientId: ing.id,
                                    });
                                  }
                                } else {
                                  dispatchKitchenAction({
                                    type: 'ADD_INGREDIENT',
                                    boardIndex: selectedBoardIndex,
                                    ingredientId: item.ingredientId,
                                  });
                                }
                              }}
                              className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-xs font-bold min-h-[40px] ${
                                item.present
                                  ? 'border-green bg-green/12 text-green-deep'
                                  : 'border-terracotta/40 bg-cream/60 text-brown hover:bg-terracotta/10 press'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <IngredientIconSvg ingredientId={item.ingredientId} size={18} />
                                <span className="truncate">{ing?.shortName}</span>
                              </span>
                              <span className="shrink-0 text-[11px]">
                                {item.present ? '✓ Messo' : ing?.requiresGrill ? '+ 🔥' : '+ Metti'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Visualizzatore Tagliere e Strati Panino (con segnalazione rossa su errori) */}
                <SandwichStackSvg
                  boardIngredients={activeBoard.ingredients}
                  ticket={activeTicket}
                  onRemoveLayer={(layerIdx) =>
                    dispatchKitchenAction({
                      type: 'REMOVE_INGREDIENT',
                      boardIndex: selectedBoardIndex,
                      ingredientIndex: layerIdx,
                    })
                  }
                />

                {/* Barra Azioni Primarie: Togli ultimo + CONSEGNA PANINO */}
                <div className="flex items-center gap-2">
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
                      !activeTicket ||
                      Boolean(
                        activeTicket.thinkingUntilMs &&
                          effectiveNowMs < activeTicket.thinkingUntilMs,
                      )
                    }
                    onClick={() =>
                      dispatchKitchenAction({
                        type: 'SERVE_ORDER',
                        boardIndex: selectedBoardIndex,
                        ticketId: activeTicket?.id,
                      })
                    }
                    data-testid="main-serve-btn"
                    className={`btn btn-sm flex-1 font-extrabold ${
                      activeBoardAnalysis.ok
                        ? 'btn-primary ring-2 ring-green/50'
                        : 'btn-primary'
                    }`}
                  >
                    <GameUiIcon name="bell" size={16} />
                    <span>
                      {activeBoardAnalysis.ok
                        ? `✓ PRONTO! Consegna a ${activeTicket?.customerName}`
                        : `Consegna a ${activeTicket?.customerName || 'cliente'}`}
                    </span>
                  </button>
                </div>
              </section>

              {/* =============================================================
                  COLONNA C: DISPENSA INGREDIENTI NAPOLETANI PER STAZIONE
                 ============================================================= */}
              <section
                aria-labelledby="pantry-station-heading"
                className="surface p-4 lg:col-span-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-xs font-extrabold text-white">
                      4
                    </span>
                    <h2 id="pantry-station-heading" className="font-display text-base sm:text-lg font-bold">
                      Dispensa Ingredienti
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-brown-soft">
                    Tocca per aggiungere a Banco {selectedBoardIndex + 1}
                  </span>
                </div>

                {/* Filtri Stazione Dispensa */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Tutti (17)' },
                    { id: STATIONS.BREAD, label: 'Pani (3)' },
                    { id: STATIONS.COLD, label: 'Formaggi & Verdure (8)' },
                    { id: STATIONS.WARM, label: 'Caldi & Polpette (4)' },
                    { id: STATIONS.SAUCE, label: 'Salse (5)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStationTab(tab.id)}
                      aria-pressed={stationTab === tab.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold min-h-[38px] transition ${
                        stationTab === tab.id
                          ? 'bg-brown text-cream-soft'
                          : 'bg-cream text-brown hover:bg-brown/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Griglia Bottoni Ingredienti Dispensa con Sprite SVG e Badge Contestuale */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {pantryIngredients.map((ing) => {
                    const isForbidden = activeTicket?.modifiers?.exclude === ing.id;
                    const isStillNeeded = activeBoardAnalysis.missing.includes(ing.id);
                    const isAlreadyOnBoard = activeBoard.ingredients.includes(ing.id);

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
                        className={`press relative flex items-center gap-2 rounded-xl border-2 p-2.5 text-left text-xs font-bold min-h-[52px] transition ${
                          isForbidden
                            ? 'border-danger/40 bg-danger/5 text-brown-soft'
                            : isStillNeeded
                              ? 'border-terracotta bg-white text-brown shadow-2xs ring-2 ring-terracotta/20'
                              : isAlreadyOnBoard
                                ? 'border-green bg-green/10 text-green-deep'
                                : 'border-brown/15 bg-white text-brown hover:bg-cream/60'
                        }`}
                      >
                        <IngredientIconSvg ingredientId={ing.id} size={28} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate leading-tight">{ing.shortName}</p>
                          {isForbidden ? (
                            <p className="text-[10px] font-extrabold text-danger">⛔ SENZA!</p>
                          ) : isStillNeeded ? (
                            <p className="text-[10px] font-extrabold text-terracotta-deep">
                              ★ Serve ora
                            </p>
                          ) : isAlreadyOnBoard ? (
                            <p className="text-[10px] font-extrabold text-green-deep">
                              ✓ Nel panino
                            </p>
                          ) : (
                            <p className="text-[10px] font-normal text-brown-soft">Disponibile</p>
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Panini serviti', value: snapshot.game.stats.ordersServed },
                { label: 'Combo massima', value: `×${snapshot.game.maxCombo || 1}` },
                { label: 'Mance & bonus', value: `+${snapshot.game.stats.tipsEarned} pt` },
                { label: 'Bonus combo', value: `+${snapshot.game.stats.comboBonusEarned} pt` },
                { label: 'Consegne errate', value: snapshot.game.stats.wrongDeliveries },
                {
                  label: 'Clienti persi / Bruciati',
                  value: `${snapshot.game.stats.customersLost} / ${snapshot.game.stats.burnedCount}`,
                },
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
                    <ChefAvatarSvg avatar={p.avatar} size={52} showRoleBadge />
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

      {/* Modale Ricettario e Archetipi Clienti con Illustrazioni Ingredienti */}
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
                  Tutte le 8 ricette ufficiali con i relativi ingredienti e gli 8 archetipi comportamentali.
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
                        {r.basePoints} pt {r.requiresGrill ? '· 🔥 Piastra' : '· No piastra'}
                      </span>
                    </div>
                    <p className="text-xs text-brown-soft">{r.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.ingredients.map((ingId) => (
                        <span
                          key={ingId}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold border border-brown/12"
                        >
                          <IngredientIconSvg ingredientId={ingId} size={15} />
                          <span>{getIngredient(ingId)?.shortName}</span>
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
