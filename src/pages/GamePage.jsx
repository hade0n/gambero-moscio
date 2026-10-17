/**
 * Pagina `/game` — "Il Banco del Gambero" (Gioco Co-Op nel Browser 1–4 giocatori).
 * Isolata dal resto dell'app di recensioni: non usa `RestaurantsContext` né l'auth admin.
 *
 * Direzione artistica 2.5D — Paninoteca Napoletana Contemporanea:
 * - Ingresso / Lobby (`view === 'menu' | 'lobby'`): Ambientata all'ingresso del locale
 *   (`lobby_paninoteca_bg.jpg`) con lavagna ricette illustrate in 2.5D (`RecipePlateSvg`),
 *   4 cuochi a mezzo busto (`Gennaro`, `Chiara`, `Tano`, `Sofia`) e creazione/accesso rapido con Party Code.
 * - Scena di Gioco (`view === 'playing'`): Un unico spazio cucina continuo e immersivo:
 *   1. HUD Superiore Compatto su architrave in legno scuro (Timer, Fase, Punteggio, Combo, Party Code,
 *      4 cuochi di brigata con stato connessione e cambio ruolo rapido).
 *   2. Palcoscenico 2.5D (`KitchenPhaserCanvas` 1280×510 + Comande Appese al Pass):
 *      Sala con scorcio sul vicolo napoletano (`sala_vicolo_bg.jpg`), clienti espressivi al bancone,
 *      ticket illustrati vicino a ciascun cliente, piastra a 4 fuochi, taglieri con panino che cresce
 *      visivamente e dispensa sul banco.
 *   3. Bancone Operativo Tattile Integrato (Ghisa per la Piastra, Legno d'ulivo per i Taglieri,
 *      Vaschette Gastronorm per la Dispensa) progettato per desktop (con shortcut `[1-6]`, `[Q W E R]`,
 *      `Backspace`, `Ctrl+Enter`) e mobile portrait/landscape (target ≥ 48px).
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
import { GAME_ART_MANIFEST } from '../game/data/artManifest.js';
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
  RecipePlateSvg,
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
      showNotice('Saracinesca alzata! Guardate le comande al bancone e coordinatevi!');
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
    <div className="min-h-dvh bg-[#23150E] text-brown overflow-x-hidden flex flex-col">
      {/* Top Navbar del Gioco (Insegna in legno bruciato, rame e maiolica) */}
      <header className="sticky top-0 z-30 border-b-2 border-[#5C341D] bg-[#2D1B12]/95 text-cream backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/"
              className="btn btn-sm press shrink-0 border border-[#8C583A] bg-[#3E2519] text-cream hover:bg-[#523222]"
              aria-label="Torna a Gambero Moscio - Recensioni Locali"
            >
              <GameUiIcon name="arrow-left" size={17} />
              <span className="hidden sm:inline">Gambero Moscio</span>
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
                <h1 className="font-display text-base sm:text-lg font-bold leading-tight text-cream truncate">
                  Il Banco del Gambero
                </h1>
                <p className="text-[11px] text-[#E6C9A8] truncate">
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                  netState === 'connected'
                    ? 'bg-[#2A4723] text-[#C5F2A7] border-[#5F8F3A]'
                    : netState === 'reconnecting'
                      ? 'bg-rating/25 text-cream border-rating'
                      : 'bg-[#3E2519] text-[#E6C9A8] border-[#8C583A]'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    netState === 'connected'
                      ? 'bg-[#8AE856]'
                      : netState === 'reconnecting'
                        ? 'bg-rating'
                        : 'bg-[#E6C9A8]'
                  }`}
                />
                <span>
                  {netState === 'connected'
                    ? `Stanza ${snapshot?.code || ''}`
                    : netState === 'reconnecting'
                      ? 'Riconnessione…'
                      : 'Sincronizzazione…'}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal((v) => !v)}
              className="btn btn-sm press border border-[#8C583A] bg-[#3E2519] text-cream hover:bg-[#523222]"
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
              className="btn btn-sm press min-w-[44px] px-2.5 border border-[#8C583A] bg-[#3E2519] text-cream hover:bg-[#523222]"
            >
              <GameUiIcon name={muted ? 'volume-off' : 'volume-on'} size={18} />
              <span className="sr-only">{muted ? 'Audio muto' : 'Audio attivo'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner Errori / Riconnessione */}
      <div className="mx-auto w-full max-w-[1400px] px-3 pt-2 sm:px-5" aria-live="polite">
        {errorBanner && (
          <div
            role="alert"
            className="mb-2.5 flex items-center justify-between gap-3 rounded-xl border border-danger bg-[#4A1814] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={() => setErrorBanner('')}
              className="btn btn-sm min-h-[34px] px-3 text-xs font-bold underline text-white"
            >
              Chiudi
            </button>
          </div>
        )}

        {netState === 'reconnecting' && (
          <div
            role="alert"
            className="mb-2.5 rounded-xl border border-rating bg-[#4A3214] px-4 py-2 text-sm font-semibold text-cream"
          >
            Connessione instabile: riconnessione allo stato autorevole della cucina in corso…
          </div>
        )}
      </div>

      {/* Contenuto Principale */}
      <main className="mx-auto flex-1 w-full max-w-[1400px] px-3 pb-8 pt-1 sm:px-5">
        {/* ===================================================================
            VISTA 1: INGRESSO DELLA PANINOTECA (MENU PRINCIPALE + BRIGATA)
           =================================================================== */}
        {view === 'menu' && (
          <div className="space-y-5">
            {/* Hero Scenografico 2.5D dell'Ingresso al Ristorante */}
            <div className="relative overflow-hidden rounded-3xl border-2 border-[#7A482A] bg-[#2D1B12] shadow-lg">
              <img
                src={GAME_ART_MANIFEST.scenes.lobby_paninoteca_bg}
                alt="Ingresso illustrato de Il Banco del Gambero con piastra in ghisa, maioliche di Vietri e cesti di pane"
                className="h-52 sm:h-64 w-full object-cover object-center opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#1E110B]/95 via-[#2B180F]/80 to-[#1E110B]/55" />
              <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/60 bg-[#3B2115]/90 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#FFB48A]">
                    <GameUiIcon name="flame" size={14} />
                    <span>Cucina Cooperativa in Tempo Reale · 1–4 Cuochi</span>
                  </span>
                  <span className="rounded-full border border-[#8C583A] bg-[#2B1911]/90 px-3 py-1 text-xs font-bold text-[#F5DEC2]">
                    Turno da 165s · 8 Ricette Napoletane
                  </span>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <h2 className="font-display text-2xl sm:text-4xl font-bold text-cream drop-shadow-sm">
                      Benvenuti a Il Banco del Gambero
                    </h2>
                    <p className="mt-1 text-sm sm:text-base text-[#F2DEC4]">
                      Indossa il grembiule, scalda la piastra in ghisa e servi cuzzetielli fumanti,
                      salsiccia e friarielli insieme alla tua brigata.
                    </p>
                  </div>

                  {/* Vetrina Piatti del Giorno sul Bancone */}
                  <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-[#8C583A]/70 bg-[#26160E]/90 px-3.5 py-2 backdrop-blur-xs">
                    {RECIPES.slice(0, 4).map((r) => (
                      <div key={r.id} className="flex flex-col items-center px-1.5">
                        <RecipePlateSvg recipeId={r.id} size={56} />
                        <span className="text-[10px] font-bold text-[#F5DEC2] max-w-[74px] truncate">
                          {r.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Griglia Ingresso: A Destra/Alto Azione Immediata (Tavolo Accoglienza), A Sinistra Vestiario Brigata */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
              {/* Colonna Accoglienza & Partita (Priorità CTA) */}
              <section
                aria-labelledby="lobby-actions-heading"
                className="rounded-3xl border-2 border-[#7A482A] bg-cream-soft p-5 sm:p-6 lg:col-span-5 flex flex-col gap-4 shadow-md order-1 lg:order-2"
              >
                <div className="border-b border-brown/12 pb-3.5">
                  <span className="inline-block rounded-sm bg-terracotta/15 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-terracotta-deep">
                    Ingresso Ristorante
                  </span>
                  <h2 id="lobby-actions-heading" className="mt-1 font-display text-2xl font-bold text-brown">
                    Apri o raggiungi il Banco
                  </h2>
                  <p className="mt-0.5 text-xs text-brown-soft">
                    Inserisci il tuo nome da cuoco e apri subito la cucina o entra col codice di 6 lettere.
                  </p>
                </div>

                {/* Campo Nickname sempre in primo piano vicino alla CTA */}
                <div>
                  <label htmlFor="player-nickname" className="block text-sm font-bold text-brown mb-1">
                    Il tuo nickname al bancone (2–16 caratteri)
                  </label>
                  <input
                    id="player-nickname"
                    type="text"
                    maxLength={16}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Es. Gennaro, Chiara, Mastro…"
                    className="field-control text-base font-bold"
                  />
                </div>

                {/* CTA Primaria: Crea Lobby */}
                <div className="rounded-2xl border-2 border-terracotta/40 bg-gradient-to-b from-white to-cream p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-brown">
                        Nuova brigata (1–4 cuochi)
                      </h3>
                      <p className="text-xs text-brown-soft">
                        Apri la paninoteca e ottieni il Party Code da inviare agli amici.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="create-lobby-btn"
                    disabled={netState === 'loading'}
                    onClick={handleCreateLobby}
                    className="btn btn-primary w-full mt-3 text-base font-extrabold shadow-sm"
                  >
                    <GameUiIcon name="flame" size={18} />
                    <span>{netState === 'loading' ? 'Apertura in corso…' : 'Crea lobby'}</span>
                  </button>
                </div>

                {/* Form Secondario: Entra con Party Code */}
                <form
                  onSubmit={handleJoinLobby}
                  className="rounded-2xl border border-brown/15 bg-cream/70 p-4"
                >
                  <h3 className="font-display text-base font-bold text-brown">
                    Unisciti a una cucina aperta
                  </h3>
                  <label htmlFor="party-code-input" className="block mt-0.5 text-xs text-brown-soft">
                    Hai ricevuto il Party Code di 6 caratteri dal Capo Brigata?
                  </label>
                  <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
                    <input
                      id="party-code-input"
                      type="text"
                      maxLength={6}
                      value={joinCodeInput}
                      onChange={(e) =>
                        setJoinCodeInput(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, ''),
                        )
                      }
                      placeholder="ES. GMB42K"
                      className="field-control text-center font-mono text-lg font-extrabold uppercase tracking-widest"
                    />
                    <button
                      type="submit"
                      disabled={netState === 'loading'}
                      className="btn btn-outline shrink-0 font-bold"
                    >
                      Entra in lobby
                    </button>
                  </div>
                </form>

                {/* Lavagna Rapida delle 3 Regole d'Oro */}
                <div className="rounded-2xl border border-[#5C341D] bg-[#2B1911] p-4 text-xs text-[#F2DEC4] space-y-2">
                  <p className="font-display text-sm font-bold text-cream">
                    Lavagna di Brigata — Come funziona il servizio:
                  </p>
                  <p>
                    <strong className="text-[#FFB48A]">1. Scegli la Comanda:</strong> ogni cliente al
                    bancone ha il suo fumetto con il piatto illustrato e le note{' '}
                    <span className="underline">SENZA</span> o <span className="underline">EXTRA</span>.
                  </p>
                  <p>
                    <strong className="text-[#FFB48A]">2. Piastra a 4 Fuochi:</strong> cuoci Manzo,
                    Pollo, Salsiccia e Burger Veg; spostali sul tagliere o nel{' '}
                    <strong>Vassoio Caldo</strong> prima che brucino.
                  </p>
                  <p>
                    <strong className="text-[#C5F2A7]">3. Assembla e Suona il Campanello:</strong> componi
                    gli strati sul Banco 1 o Banco 2 e premi <strong>Consegna</strong>!
                  </p>
                </div>
              </section>

              {/* Colonna Sinistra: Scelta Cuoco della Brigata, Ruolo e Divisa */}
              <section
                aria-labelledby="chef-custom-heading"
                className="rounded-3xl border-2 border-[#7A482A] bg-cream-soft p-5 sm:p-6 lg:col-span-7 shadow-md order-2 lg:order-1"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brown/12">
                  <div>
                    <span className="inline-block rounded-sm bg-terracotta/15 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-terracotta-deep">
                      Spogliatoio della Brigata
                    </span>
                    <h2 id="chef-custom-heading" className="mt-1 font-display text-2xl font-bold text-brown">
                      Scegli il tuo cuoco e il ruolo al banco
                    </h2>
                  </div>

                  {/* Anteprima live del Cuoco a mezzo busto */}
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-terracotta/35 bg-white px-4 py-2.5 shadow-2xs">
                    <ChefAvatarSvg avatar={avatar} size={74} showRoleBadge />
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-terracotta-deep">
                        {getBrigadeRole(avatar.role).label}
                      </p>
                      <p className="font-display text-lg font-bold text-brown">
                        {nickname.trim() || 'Cuoco Ospite'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* I 4 Protagonisti della Brigata (Gennaro, Chiara, Tano, Sofia) */}
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                    I 4 Maestri del Banco (tocca un personaggio o personalizzalo sotto):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {CHEF_PERSONAS.map((persona) => {
                      const selected = avatar.chefId === persona.id;
                      const roleInfo = getBrigadeRole(persona.defaultAvatar.role);
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
                          className={`press flex items-center gap-3 rounded-2xl border-2 p-3 text-left min-h-[72px] transition ${
                            selected
                              ? 'border-terracotta bg-white shadow-xs ring-2 ring-terracotta/20'
                              : 'border-brown/15 bg-cream/60 hover:bg-white'
                          }`}
                        >
                          <ChefAvatarSvg
                            avatar={{ ...persona.defaultAvatar, chefId: persona.id }}
                            size={58}
                            showRoleBadge
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-display text-sm font-bold text-brown truncate">
                                {persona.name}
                              </p>
                              <span className="text-[10px] font-bold text-brown-soft">
                                {roleInfo.shortLabel}
                              </span>
                            </div>
                            <p className="text-xs text-brown-soft line-clamp-2">{persona.tagline}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scelta Ruolo Operativo */}
                <div className="mt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brown-soft mb-2">
                    Postazione operativa preferita (cambiabile anche durante il turno):
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
                          className={`press rounded-xl border-2 p-3 text-left transition ${
                            selected
                              ? 'border-terracotta bg-white shadow-2xs'
                              : 'border-brown/15 bg-cream/50 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-sm font-bold text-brown">
                              {role.label}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${role.badgeClass}`}
                            >
                              {role.shortLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-brown-soft">{role.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Personalizzazione Divisa, Capelli, Carnagione e Accessori */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-brown/12">
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
                          className={`press h-11 w-11 rounded-xl border-2 ${
                            avatar.skinTone === tone.id
                              ? 'border-terracotta ring-2 ring-terracotta/30'
                              : 'border-brown/25'
                          }`}
                          style={{ backgroundColor: tone.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5">
                      Grembiule da banco
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {APRON_COLORS.map((apron) => (
                        <button
                          key={apron.id}
                          type="button"
                          onClick={() => setAvatar((a) => ({ ...a, apronColor: apron.id }))}
                          aria-label={`Grembiule ${apron.label}`}
                          aria-pressed={avatar.apronColor === apron.id}
                          className={`press h-11 w-11 rounded-xl border-2 ${
                            avatar.apronColor === apron.id
                              ? 'border-brown ring-2 ring-terracotta/40'
                              : 'border-brown/25'
                          }`}
                          style={{ backgroundColor: apron.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="select-hair-style"
                      className="block text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5"
                    >
                      Acconciatura
                    </label>
                    <select
                      id="select-hair-style"
                      value={avatar.hairStyle}
                      onChange={(e) => setAvatar((a) => ({ ...a, hairStyle: e.target.value }))}
                      className="field-control text-sm font-semibold"
                    >
                      {HAIR_STYLES.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="select-hair-color"
                      className="block text-xs font-bold uppercase tracking-wide text-brown-soft mb-1.5"
                    >
                      Colore capelli
                    </label>
                    <select
                      id="select-hair-color"
                      value={avatar.hairColor}
                      onChange={(e) => setAvatar((a) => ({ ...a, hairColor: e.target.value }))}
                      className="field-control text-sm font-semibold"
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
                      Segno distintivo in cucina
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
            </div>
          </div>
        )}

        {/* ===================================================================
            VISTA 2: SALA PRE-SERVIZIO (LOBBY COOPERATIVA 1–4 CUOCHI)
           =================================================================== */}
        {view === 'lobby' && snapshot && (
          <section
            aria-labelledby="lobby-room-heading"
            className="overflow-hidden rounded-3xl border-2 border-[#7A482A] bg-cream-soft shadow-lg max-w-5xl mx-auto"
          >
            {/* Header illustrato della Lobby */}
            <div className="relative border-b-2 border-[#7A482A] bg-[#2B1911] p-5 sm:p-7 text-cream">
              <img
                src={GAME_ART_MANIFEST.scenes.lobby_paninoteca_bg}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
                    <GameUiIcon name="users" size={14} />
                    <span>Brigata al Bancone ({snapshot.players.length}/4 cuochi)</span>
                  </span>
                  <h2 id="lobby-room-heading" className="mt-2 font-display text-2xl sm:text-3xl font-bold !text-[#FFF8EC] drop-shadow-sm">
                    Sala Pre-Servizio · Il Banco del Gambero
                  </h2>
                  <p className="mt-1 text-sm text-[#E8D5B7]">
                    Assegnatevi Piastra, Banco 1, Banco 2 e Jolly prima di alzare la saracinesca.
                  </p>
                </div>

                {/* Party Code ben visibile */}
                <div className="flex items-center gap-3 rounded-2xl border-2 border-terracotta bg-[#1F120C]/95 px-4 py-3 self-start md:self-center shadow-md">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#E8D5B7]">
                      Party Code Stanza
                    </p>
                    <p
                      className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-[#FFB48A]"
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
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              {/* Selettore rapido del proprio ruolo in Lobby */}
              <div className="rounded-2xl border border-brown/15 bg-cream p-3.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brown">
                  La tua postazione nella brigata:
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
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold min-h-[40px] transition ${
                          active
                            ? `${role.badgeClass} shadow-xs`
                            : 'bg-white border border-brown/15 text-brown hover:bg-cream-soft'
                        }`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* I 4 Posti della Brigata al Bancone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, idx) => {
                  const player = snapshot.players[idx];
                  if (!player) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="rounded-2xl border-2 border-dashed border-brown/20 bg-cream/50 p-5 flex flex-col items-center justify-center text-center min-h-[210px]"
                      >
                        <p className="font-display text-base font-bold text-brown-soft">
                          Postazione Cuoco #{idx + 1}
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
                      className={`rounded-2xl border-2 p-4 flex flex-col items-center text-center min-h-[210px] justify-between ${
                        isMe
                          ? 'border-terracotta bg-white shadow-sm'
                          : 'border-brown/15 bg-cream'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between text-xs font-bold">
                        <span
                          className={`rounded-md px-2 py-0.5 ${
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
                        <ChefAvatarSvg avatar={player.avatar} size={82} showRoleBadge />
                        <p className="mt-2.5 font-display text-lg font-bold text-brown">
                          {player.nickname} {isMe ? '(Tu)' : ''}
                        </p>
                        <p className="text-xs font-semibold text-brown-soft">
                          {roleInfo.label}
                        </p>
                      </div>

                      <span
                        className={`w-full rounded-xl py-1.5 text-xs font-extrabold ${
                          player.isReady
                            ? 'bg-green/15 text-green-deep border border-green/35'
                            : 'bg-rating/20 text-brown border border-rating/45'
                        }`}
                      >
                        {player.isReady ? '✓ Grembiule allacciato' : 'In preparazione…'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Barra CTA della Lobby */}
              <div className="pt-4 border-t border-brown/12 flex flex-wrap items-center justify-between gap-3">
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
                      className="btn btn-primary text-base font-extrabold shadow-md"
                      data-testid="start-match-btn"
                    >
                      <GameUiIcon name="flame" size={18} />
                      <span>
                        {snapshot.players.length === 1
                          ? 'Alza la saracinesca (1 giocatore)'
                          : `Alza la saracinesca (${snapshot.players.length} cuochi)`}
                      </span>
                    </button>
                  ) : (
                    <p className="text-sm font-semibold text-brown-soft px-2">
                      In attesa che il Capo Brigata alzi la saracinesca…
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            VISTA 3: PARTITA IN CORSO — SCENA UNICA 2.5D PANINOTECA NAPOLETANA
           =================================================================== */}
        {view === 'playing' && snapshot?.game && (
          <div className="overflow-hidden rounded-3xl border-2 border-[#6E4023] bg-[#26160E] shadow-xl">
            {/* ---------------------------------------------------------------
                1. HUD SUPERIORE COMPATTO (Architrave in legno scuro & ottone)
               --------------------------------------------------------------- */}
            <section
              aria-label="HUD turno, punteggio e brigata"
              className="border-b-2 border-[#5C341D] bg-gradient-to-b from-[#331E14] to-[#26160E] px-3 py-2.5 sm:px-4 text-cream"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Timer + Punteggio + Statistiche sintetiche */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div
                    className={`flex items-center gap-2 rounded-xl px-3 py-1 border ${
                      remainingRoundMs <= 25_000
                        ? 'bg-danger border-white/40 text-white'
                        : 'bg-[#1A0E09] border-[#8C583A] text-cream'
                    }`}
                  >
                    <GameUiIcon name="clock" size={17} />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#E6C9A8] leading-none">
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

                  <div className="rounded-xl border border-[#8C583A] bg-[#1A0E09] px-3 py-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#E6C9A8] leading-none">
                      Punteggio Brigata
                    </p>
                    <p
                      className="font-display text-lg sm:text-xl font-extrabold text-[#FFB48A] tabular leading-tight"
                      data-testid="team-score"
                    >
                      {snapshot.game.score} <span className="text-xs font-sans">pt</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-lg border border-[#6E4023] bg-[#362015] px-2.5 py-1 text-xs font-bold text-[#F5DEC2]">
                      Serviti:{' '}
                      <strong className="tabular text-[#A9E37B]">
                        {snapshot.game.stats.ordersServed}
                      </strong>
                    </span>
                    {snapshot.game.combo >= 2 && (
                      <span className="rounded-lg bg-rating px-2.5 py-1 text-xs font-extrabold text-brown">
                        Combo ×{snapshot.game.combo}
                      </span>
                    )}
                    {(snapshot.game.stats.customersLost > 0 ||
                      snapshot.game.stats.burnedCount > 0) && (
                      <span className="rounded-lg border border-danger/60 bg-[#4A1814] px-2 py-1 text-xs font-bold text-[#FF9E96]">
                        Persi: {snapshot.game.stats.customersLost} · Bruciati:{' '}
                        {snapshot.game.stats.burnedCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ticker Evento Live + Toggle Vista Scena */}
                <div className="flex items-center gap-2 flex-1 min-w-[220px] justify-end">
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex-1 max-w-md rounded-xl border border-[#6E4023] bg-[#1A0E09]/90 px-3 py-1.5 text-xs font-semibold text-[#F5DEC2] flex items-center justify-between gap-2 min-w-0"
                  >
                    <span className="truncate">
                      {actionToast ||
                        snapshot.game.scoreEvents?.[0]?.message ||
                        'Tocca un cliente o gli ingredienti per preparare il panino!'}
                    </span>
                    {snapshot.game.scoreEvents?.[0]?.delta !== 0 &&
                      snapshot.game.scoreEvents?.[0]?.delta !== undefined && (
                        <span
                          className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-extrabold tabular ${
                            snapshot.game.scoreEvents[0].delta > 0
                              ? 'bg-[#2A4723] text-[#A9E37B]'
                              : 'bg-[#4A1814] text-[#FF9E96]'
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
                    className="btn btn-sm shrink-0 text-xs border border-[#8C583A] bg-[#3E2519] text-cream hover:bg-[#523222] min-h-[38px] px-2.5"
                  >
                    {showPanorama ? 'Compatta scena' : 'Espandi scena 2.5D'}
                  </button>
                </div>
              </div>

              {/* Barra Compatta dei 4 Cuochi in Cucina + Switch Ruolo */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#4D2C1A]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E6C9A8] mr-1">
                    Brigata ({snapshot.players.length}/4):
                  </span>
                  {snapshot.players.map((p) => {
                    const isMe = p.id === session?.playerId;
                    const rInfo = getBrigadeRole(p.avatar?.role);
                    return (
                      <div
                        key={p.id}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-2 py-0.5 text-xs ${
                          isMe
                            ? 'border-terracotta bg-[#3D2317] text-cream font-bold'
                            : 'border-[#5C341D] bg-[#23140D] text-[#E8D5B7] font-semibold'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.isOnline ? 'bg-[#8AE856]' : 'bg-rating'
                          }`}
                        />
                        <ChefAvatarSvg avatar={p.avatar} size={26} />
                        <span className="truncate max-w-[90px]">
                          {p.nickname}
                          {isMe ? ' (Tu)' : ''}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${rInfo.badgeClass}`}
                        >
                          {rInfo.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E6C9A8] mr-1 hidden sm:inline">
                    Ruolo:
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
                            : 'bg-[#382116] text-[#E6C9A8] hover:bg-[#4D2E1F]'
                        }`}
                      >
                        {r.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------------
                2. SCENA DI GIOCO 2.5D IN PHASER 4 (Sala, Clienti, Fumetti,
                   Piastra a 4 Fuochi, 2 Taglieri con Panino a Strati, Dispensa)
               --------------------------------------------------------------- */}
            {showPanorama && (
              <div className="p-2 sm:p-3 bg-[#1E110B]">
                <Suspense
                  fallback={
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-[#5C341D] bg-[#2B1911] text-xs font-semibold text-[#E8D5B7]">
                      Apertura della cucina 2.5D de Il Banco del Gambero…
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
                    onStartCook={(ingredientId) =>
                      dispatchKitchenAction({
                        type: 'START_COOK',
                        ingredientId,
                      })
                    }
                    onCollectGrill={(slotIdx) =>
                      dispatchKitchenAction({
                        type: 'COLLECT_GRILL',
                        slotIndex: slotIdx,
                        toBoardIndex: selectedBoardIndex,
                      })
                    }
                    onAddIngredient={(ingredientId) =>
                      dispatchKitchenAction({
                        type: 'ADD_INGREDIENT',
                        boardIndex: selectedBoardIndex,
                        ingredientId,
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
              </div>
            )}

            {/* ---------------------------------------------------------------
                3. COMANDE APPESE AL PASS (Ticket da Cucina con Piatto Finito 2.5D)
               --------------------------------------------------------------- */}
            <section
              aria-labelledby="tickets-station-heading"
              className="border-y-2 border-[#5C341D] bg-[#331E14] px-3 py-2.5 sm:px-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h2
                    id="tickets-station-heading"
                    className="font-display text-sm sm:text-base font-bold text-cream"
                  >
                    Comande al Pass ({activeTickets.length}/{maxTicketSlots} clienti al bancone)
                  </h2>
                </div>
                <p className="text-[11px] font-semibold text-[#E6C9A8]">
                  Tocca un ticket per assegnarlo al <strong>Banco {selectedBoardIndex + 1}</strong> ·
                  Scorciatoia tasti [1–6]
                </p>
              </div>

              {activeTickets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#8C583A] bg-[#26160E] p-3 text-center text-xs text-[#E6C9A8]">
                  Nuovo cliente in arrivo dal vicolo…
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {activeTickets.map((tkt, idx) => {
                    const assignedBoardIdx = prepBoards.findIndex(
                      (b) => b.targetTicketId === tkt.id,
                    );
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
                        className={`rounded-2xl border-2 p-2.5 flex flex-col justify-between transition ${
                          isReadyToServe
                            ? 'border-[#76B054] bg-[#EAF7E1] text-brown shadow-md ring-2 ring-[#76B054]/40'
                            : isCurrentTarget
                              ? 'border-terracotta bg-[#FFFDF9] text-brown shadow-md'
                              : ratio <= 0.28
                                ? 'border-danger bg-[#FDECEC] text-brown'
                                : 'border-[#8C6D53] bg-[#F7EEE0] text-brown'
                        }`}
                      >
                        <div>
                          {/* Riga Superiore: Cliente + Piatto Finito 2.5D + Timer */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <CustomerAvatarSvg
                                appearance={tkt.appearance}
                                patienceRatio={ratio}
                                isThinking={isThinking}
                                isReady={isReadyToServe}
                                archetypeId={tkt.archetypeId}
                                size={46}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
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
                                <p className="font-display text-xs font-extrabold text-brown truncate">
                                  {isThinking
                                    ? `Sceglie tra ${thinkingLeftSec}s…`
                                    : `${tkt.recipeName} (+${tkt.basePoints}pt)`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isThinking && (
                                <RecipePlateSvg recipeId={tkt.recipeId} size={46} />
                              )}
                              <span
                                className={`inline-block rounded-lg px-2 py-0.5 font-mono text-xs font-extrabold tabular ${
                                  ratio <= 0.28
                                    ? 'bg-danger text-white'
                                    : ratio <= 0.55
                                      ? 'bg-rating/35 text-brown'
                                      : 'bg-green/15 text-green-deep'
                                }`}
                              >
                                {Math.ceil(remMs / 1000)}s
                              </span>
                            </div>
                          </div>

                          {/* Barra di pazienza */}
                          <div
                            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brown/15"
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

                          {/* Varianti (SENZA / EXTRA / CON) + Ingredienti della comanda */}
                          {!isThinking && (
                            <div className="mt-2">
                              {tkt.modifiers?.exclude && (
                                <div className="mb-1 rounded-md bg-danger/15 border border-danger/35 px-2 py-0.5 text-[10px] font-extrabold text-danger">
                                  ⛔ SENZA{' '}
                                  {getIngredient(tkt.modifiers.exclude)?.shortName?.toUpperCase()}
                                </div>
                              )}
                              {tkt.modifiers?.add && (
                                <div className="mb-1 rounded-md bg-terracotta/15 border border-terracotta/35 px-2 py-0.5 text-[10px] font-extrabold text-terracotta-deep">
                                  ➕ EXTRA{' '}
                                  {getIngredient(tkt.modifiers.add)?.shortName?.toUpperCase()}
                                </div>
                              )}
                              {tkt.modifiers?.swap && (
                                <div className="mb-1 rounded-md bg-green/15 border border-green/35 px-2 py-0.5 text-[10px] font-extrabold text-green-deep">
                                  🔄 CON{' '}
                                  {getIngredient(tkt.modifiers.swap.to)?.shortName?.toUpperCase()}{' '}
                                  (no {getIngredient(tkt.modifiers.swap.from)?.shortName})
                                </div>
                              )}

                              <div className="flex flex-wrap gap-1">
                                {ticketAnalysis.checklist.map((item, ingIdx) => {
                                  const ing = getIngredient(item.ingredientId);
                                  return (
                                    <span
                                      key={`${tkt.id}-${item.ingredientId}-${ingIdx}`}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${
                                        item.present
                                          ? 'border-green bg-green text-white'
                                          : ing?.requiresGrill
                                            ? 'border-terracotta/45 bg-white text-brown'
                                            : 'border-brown/15 bg-white text-brown'
                                      }`}
                                    >
                                      <IngredientIconSvg
                                        ingredientId={item.ingredientId}
                                        size={16}
                                      />
                                      <span>{ing?.shortName || item.ingredientId}</span>
                                      {item.present ? <span>✓</span> : null}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Azioni Comanda */}
                        <div className="mt-2 flex items-center gap-1.5 pt-1.5 border-t border-brown/10">
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
                            className={`btn btn-sm flex-1 text-xs min-h-[38px] ${
                              isCurrentTarget ? 'btn-secondary' : 'btn-outline'
                            }`}
                          >
                            {isThinking
                              ? 'Fissa comanda'
                              : isCurrentTarget
                                ? `Su Banco ${selectedBoardIndex + 1}`
                                : `Prepara (Banco ${selectedBoardIndex + 1})`}
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
                            className={`btn btn-sm text-xs min-h-[38px] ${
                              isReadyToServe ? 'btn-primary ring-2 ring-green/50' : 'btn-primary'
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
                4. PIANO DI LAVORO FISICO DEL BANCONE (3 Baie Integrate:
                   Piastra in Ghisa · Banco Tagliere in Legno · Dispensa Gastronorm)
               --------------------------------------------------------------- */}
            <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-12 items-start bg-[#3E2417]">
              {/* =============================================================
                  BAIA 1 (SINISTRA): PIASTRA IN GHISA A 4 FUOCHI & VASSOIO CALDO
                 ============================================================= */}
              <section
                aria-labelledby="grill-station-heading"
                className="rounded-2xl border-2 border-[#6E5A4F] bg-[#1F1815] p-3.5 text-[#FFF3E2] lg:col-span-4 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-[#4A3B34] pb-2">
                  <div className="flex items-center gap-2">
                    <GameUiIcon name="flame" size={18} className="text-terracotta" />
                    <h2 id="grill-station-heading" className="font-display text-base font-bold !text-[#FFF8EC]">
                      Piastra in Ghisa & Vassoio
                    </h2>
                  </div>
                  <span className="rounded-md bg-[#332722] px-2 py-0.5 text-[11px] font-bold text-[#E6C9A8]">
                    Tasti [Q W E R]
                  </span>
                </div>

                {/* Vaschette Proteine Crude da mettere sulla piastra */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#C9B8AC] mb-1.5">
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
                          className={`press relative flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-xs font-bold min-h-[52px] transition ${
                            neededCount > 0
                              ? 'border-terracotta bg-[#36261E] text-cream ring-2 ring-terracotta/30'
                              : 'border-[#5A473E] bg-[#2B211D] text-cream hover:border-terracotta'
                          }`}
                        >
                          <IngredientIconSvg
                            ingredientId={ing.id}
                            cookState={COOK_STATES.RAW}
                            size={32}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{ing.shortName}</p>
                            <p className="text-[10px] font-normal text-[#C9B8AC]">
                              {(ing.cookTimeMs / 1000).toFixed(1)}s
                            </p>
                          </div>
                          {neededCount > 0 && (
                            <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              ×{neededCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* I 4 Fuochi della Piastra in Ghisa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {snapshot.game.grillSlots.map((slot, sIdx) => {
                    const status = getGrillSlotStatus(slot, effectiveNowMs);
                    const ing = slot.ingredientId ? getIngredient(slot.ingredientId) : null;
                    const keyHint = ['Q', 'W', 'E', 'R'][sIdx];
                    const cookByName = findPlayerName(slot.startedByPlayerId);

                    return (
                      <div
                        key={slot.slotIndex}
                        data-testid={`grill-slot-${sIdx}`}
                        className={`rounded-xl border-2 p-2.5 flex flex-col justify-between gap-2 transition ${
                          !slot.ingredientId
                            ? 'border-dashed border-[#5A473E] bg-[#28201C]'
                            : status.state === COOK_STATES.COOKED && status.aboutToBurn
                              ? 'border-danger bg-[#4A1F1A] ring-2 ring-danger/40'
                              : status.state === COOK_STATES.COOKED
                                ? 'border-[#5F8F3A] bg-[#243B1F]'
                                : status.state === COOK_STATES.BURNED
                                  ? 'border-danger bg-[#381714]'
                                  : 'border-rating bg-[#3D2C1E]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-[#E6C9A8]">
                            Fuoco {sIdx + 1} [{keyHint}]
                          </span>
                          <span
                            className={
                              status.state === COOK_STATES.COOKED && status.aboutToBurn
                                ? 'text-[#FF9E96] font-extrabold'
                                : status.state === COOK_STATES.COOKED
                                  ? 'text-[#A9E37B] font-extrabold'
                                  : status.state === COOK_STATES.BURNED
                                    ? 'text-[#FF9E96] font-extrabold'
                                    : 'text-[#F7D08A]'
                            }
                          >
                            {!slot.ingredientId
                              ? 'Libero'
                              : status.state === COOK_STATES.COOKING
                                ? `${(status.remainingMs / 1000).toFixed(1)}s`
                                : status.state === COOK_STATES.COOKED && status.aboutToBurn
                                  ? `⚠ BRUCIA ${(status.remainingMs / 1000).toFixed(1)}s`
                                  : status.state === COOK_STATES.COOKED
                                    ? `PRONTO (${(status.remainingMs / 1000).toFixed(0)}s)`
                                    : 'BRUCIATO!'}
                          </span>
                        </div>

                        {ing ? (
                          <>
                            <div className="flex items-center gap-2">
                              <GrillBurnerSvg
                                ingredientId={ing.id}
                                cookState={status.state}
                                aboutToBurn={status.aboutToBurn}
                                size={46}
                              />
                              <div className="min-w-0">
                                <p className="font-display text-sm font-bold text-cream truncate">
                                  {ing.shortName}
                                </p>
                                {cookByName && (
                                  <p className="text-[10px] text-[#C9B8AC] truncate">
                                    Cuoco: {cookByName}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
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

                            <div className="flex items-center gap-1.5">
                              {status.state === COOK_STATES.COOKING && (
                                <>
                                  <button
                                    type="button"
                                    disabled
                                    data-testid={`collect-grill-${sIdx}`}
                                    className="btn btn-secondary btn-sm flex-1 text-xs min-h-[38px]"
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
                                    className="btn btn-secondary btn-sm px-2.5 text-xs text-danger min-h-[38px]"
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
                                    className="btn btn-primary btn-sm flex-1 text-xs min-h-[38px]"
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
                                    className="btn btn-secondary btn-sm px-2 text-xs min-h-[38px]"
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
                                  className="btn btn-danger btn-sm w-full text-xs min-h-[38px]"
                                >
                                  Pulisci (-15 pt)
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-[11px] text-[#A9998E] py-3 text-center">
                            Fuoco libero · Tocca una proteina sopra
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Vassoio Caldo in Acciaio Inox */}
                <div className="rounded-xl border border-[#6E5A4F] bg-[#2B221E] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-cream">
                      Vassoio Caldo Condiviso ({snapshot.game.cookedTray.length}/6)
                    </p>
                    <span className="text-[10px] font-bold text-[#A9E37B]">Non brucia mai</span>
                  </div>
                  {snapshot.game.cookedTray.length === 0 ? (
                    <p className="text-[11px] text-[#C9B8AC]">
                      Usa <strong>“→ Vassoio”</strong> per tenere pronte le carni per la brigata.
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
                            className="press inline-flex items-center gap-1.5 rounded-xl border border-[#76B054] bg-[#23381E] px-2.5 py-1 text-xs font-bold text-[#C5F2A7] min-h-[38px]"
                          >
                            <IngredientIconSvg
                              ingredientId={item.ingredientId}
                              cookState={COOK_STATES.COOKED}
                              size={22}
                            />
                            <span>+ {ing?.shortName} → Banco {selectedBoardIndex + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* =============================================================
                  BAIA 2 (CENTRO): BANCO D'ASSEMBLAGGIO IN LEGNO D'ULIVO & PASS
                 ============================================================= */}
              <section
                aria-labelledby="assembly-station-heading"
                className="rounded-2xl border-2 border-[#8C583A] bg-[#EAD4B4] p-3.5 text-brown lg:col-span-4 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between gap-2 border-b border-brown/15 pb-2">
                  <h2 id="assembly-station-heading" className="font-display text-base font-bold">
                    Tagliere & Pass Consegna
                  </h2>

                  {/* Selettore Banco 1 / Banco 2 */}
                  <div className="inline-flex rounded-xl border border-brown/20 bg-cream p-1">
                    {[0, 1].map((bIdx) => {
                      const b = prepBoards[bIdx];
                      const bTicket = activeTickets.find((t) => t.id === b?.targetTicketId);
                      return (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => setSelectedBoardIndex(bIdx)}
                          aria-pressed={selectedBoardIndex === bIdx}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold min-h-[34px] transition ${
                            selectedBoardIndex === bIdx
                              ? 'bg-terracotta text-white shadow-2xs'
                              : 'text-brown hover:bg-white/70'
                          }`}
                        >
                          Banco {bIdx + 1} ({b?.ingredients?.length || 0})
                          {bTicket ? ` · ${bTicket.customerName}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Comanda attiva sul Tagliere + Checklist 1-tap */}
                <div className="rounded-2xl border border-brown/15 bg-white/95 p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {activeTicket && (
                        <RecipePlateSvg recipeId={activeTicket.recipeId} size={46} />
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brown-soft truncate">
                          Banco {selectedBoardIndex + 1}
                          {findPlayerName(activeBoard.updatedByPlayerId)
                            ? ` · Cuoco: ${findPlayerName(activeBoard.updatedByPlayerId)}`
                            : ''}
                        </p>
                        <p className="font-display text-sm sm:text-base font-bold text-brown truncate">
                          {activeTicket
                            ? `${activeTicket.recipeName} per ${activeTicket.customerName}`
                            : 'Nessuna comanda selezionata'}
                        </p>
                      </div>
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
                        className="text-xs text-danger underline font-bold shrink-0"
                      >
                        Svuota
                      </button>
                    )}
                  </div>

                  {activeTicket && (
                    <div className="pt-1">
                      <p className="text-[11px] font-bold text-brown-soft mb-1.5">
                        Tocca gli ingredienti della ricetta per comporre il panino:
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
                              className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-xs font-bold min-h-[42px] ${
                                item.present
                                  ? 'border-green bg-green/15 text-green-deep'
                                  : 'border-terracotta/45 bg-cream/70 text-brown hover:bg-terracotta/15 press'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5 min-w-0">
                                <IngredientIconSvg ingredientId={item.ingredientId} size={22} />
                                <span className="truncate">{ing?.shortName}</span>
                              </span>
                              <span className="shrink-0 text-[10px] font-extrabold">
                                {item.present ? '✓' : ing?.requiresGrill ? '+Piastra' : '+Metti'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tagliere 2.5D con Pila Visuale del Panino */}
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

                {/* Barra Pass Consegna */}
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
                        ? 'btn-primary ring-2 ring-green/60 shadow-md'
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
                  BAIA 3 (DESTRA): CASSETTI DISPENSA GASTRONORM NAPOLETANA
                 ============================================================= */}
              <section
                aria-labelledby="pantry-station-heading"
                className="rounded-2xl border-2 border-[#7A5438] bg-[#2E1E14] p-3.5 text-cream lg:col-span-4 space-y-3 shadow-md"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#4D3322] pb-2">
                  <h2 id="pantry-station-heading" className="font-display text-base font-bold !text-[#FFF8EC]">
                    Vaschette Dispensa
                  </h2>
                  <span className="rounded-md bg-[#452C1E] px-2 py-0.5 text-[11px] font-bold text-[#F5DEC2]">
                    → Banco {selectedBoardIndex + 1}
                  </span>
                </div>

                {/* Cassetti Semantici della Dispensa */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Tutti (17)' },
                    { id: STATIONS.BREAD, label: 'Pani (3)' },
                    { id: STATIONS.COLD, label: 'Latticini & Orto (8)' },
                    { id: STATIONS.WARM, label: 'Caldi & Polpette (4)' },
                    { id: STATIONS.SAUCE, label: 'Salse & Ragù (5)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStationTab(tab.id)}
                      aria-pressed={stationTab === tab.id}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold min-h-[36px] transition ${
                        stationTab === tab.id
                          ? 'bg-terracotta text-white shadow-2xs'
                          : 'bg-[#422A1D] text-[#E8D5B7] hover:bg-[#573827]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Griglia Vaschette Gastronorm 2.5D */}
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
                        className={`press relative flex items-center gap-2 rounded-xl border-2 p-2 text-left text-xs font-bold min-h-[54px] transition ${
                          isForbidden
                            ? 'border-danger/60 bg-[#3B1916] text-[#FF9E96]'
                            : isStillNeeded
                              ? 'border-terracotta bg-[#FFFDF9] text-brown shadow-sm ring-2 ring-terracotta/40'
                              : isAlreadyOnBoard
                                ? 'border-[#76B054] bg-[#243B1F] text-[#C5F2A7]'
                                : 'border-[#6E503B] bg-[#F5E6D0] text-brown hover:bg-white'
                        }`}
                      >
                        <IngredientIconSvg ingredientId={ing.id} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate leading-tight">{ing.shortName}</p>
                          {isForbidden ? (
                            <p className="text-[10px] font-extrabold text-[#FF9E96]">⛔ SENZA!</p>
                          ) : isStillNeeded ? (
                            <p className="text-[10px] font-extrabold text-terracotta-deep">
                              ★ Serve ora
                            </p>
                          ) : isAlreadyOnBoard ? (
                            <p className="text-[10px] font-extrabold text-[#A9E37B]">
                              ✓ Nel panino
                            </p>
                          ) : (
                            <p className="text-[10px] font-normal text-brown-soft">Pronto</p>
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
            className="rounded-3xl border-2 border-[#7A482A] bg-cream-soft p-6 sm:p-8 max-w-4xl mx-auto space-y-6 shadow-xl"
          >
            {(() => {
              const rank = getBrigadeRankTitle(
                snapshot.game.score,
                snapshot.game.stats.ordersServed,
              );
              return (
                <div className="text-center border-b border-brown/12 pb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rating/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brown">
                    <GameUiIcon name="sparkle" size={14} />
                    <span>Chiusura Cassa al Banco del Gambero</span>
                  </span>
                  <h2
                    id="match-results-heading"
                    className="mt-2 font-display text-3xl sm:text-4xl font-bold text-brown"
                  >
                    {rank.title}
                  </h2>
                  <p className="mt-1 text-base text-brown-soft">{rank.subtitle}</p>

                  <div className="mt-5 inline-flex flex-col items-center rounded-2xl border-2 border-terracotta bg-white px-8 py-4 shadow-sm">
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
                  className="rounded-2xl border border-brown/15 bg-cream p-3.5 text-center"
                >
                  <p className="text-xs font-semibold text-brown-soft">{stat.label}</p>
                  <p className="mt-1 font-display text-xl font-bold text-brown tabular">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-display text-lg font-bold mb-3 text-brown">
                Contributi della brigata in cucina
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {snapshot.players.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-brown/15 bg-white p-4 flex items-center gap-3"
                  >
                    <ChefAvatarSvg avatar={p.avatar} size={60} showRoleBadge />
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-brown truncate">
                        {p.nickname}
                      </p>
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

      {/* Modale Ricettario Illustrato 2.5D e Archetipi Clienti */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="surface max-h-[85dvh] w-full max-w-4xl overflow-y-auto p-5 sm:p-7 space-y-6 text-brown"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-brown/12 pb-4">
              <div>
                <h2 id="guide-modal-title" className="font-display text-2xl font-bold">
                  Ricettario Illustrato & Clienti del Quartiere
                </h2>
                <p className="text-xs text-brown-soft">
                  Le 8 ricette originali de Il Banco del Gambero con piatti finiti 2.5D e ingredienti.
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
                    className="rounded-2xl border border-brown/15 bg-cream/60 p-3.5 flex items-start gap-3"
                  >
                    <RecipePlateSvg recipeId={r.id} size={72} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-display text-sm font-bold">{r.name}</p>
                        <span className="text-xs font-bold text-terracotta-deep shrink-0">
                          {r.basePoints} pt {r.requiresGrill ? '· Piastra' : '· Banco'}
                        </span>
                      </div>
                      <p className="text-xs text-brown-soft">{r.description}</p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {r.ingredients.map((ingId) => (
                          <span
                            key={ingId}
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold border border-brown/12"
                          >
                            <IngredientIconSvg ingredientId={ingId} size={16} />
                            <span>{getIngredient(ingId)?.shortName}</span>
                          </span>
                        ))}
                      </div>
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
