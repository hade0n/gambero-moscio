/**
 * Motore deterministico e autorevole de "Il Banco del Gambero".
 * Funzioni pure condivise fra Vercel Functions e client per:
 * - generazione deterministica di clienti e ticket (1–4 giocatori)
 * - progressione in 3 fasi (inizio, centro, finale) su 165 secondi
 * - gestione griglia (crudo -> in cottura -> pronto -> bruciato)
 * - banchi di assemblaggio condivisi, rimozione errori e consegna
 * - punteggio, mance velocità, bonus archetipo, combo di squadra e idempotenza azioni
 */
import {
  COOK_STATES,
  getIngredient,
  INGREDIENT_MAP,
} from '../data/ingredients.js';
import {
  buildTicketIngredients,
  getRecipe,
  RECIPES,
} from '../data/recipes.js';
import {
  CUSTOMER_ARCHETYPES,
  getArchetype,
} from '../data/archetypes.js';
import {
  getNpcAppearance,
  NPC_NAMES,
} from '../data/characters.js';
import {
  nextRandom,
  normalizeSeed,
  pickFromArray,
  randomInt,
} from './prng.js';

export const ROUND_DURATION_MS = 165_000; // 165s (finestra consigliata 150-180s)
export const GRILL_SLOT_COUNT = 4;
export const PREP_BOARD_COUNT = 2;
export const COOKED_TRAY_LIMIT = 6;
export const COMBO_WINDOW_MS = 22_000;
export const MAX_PROCESSED_ACTIONS = 160;
export const MAX_SCORE_EVENTS = 12;

/**
 * Configurazione di scalabilità per 1, 2, 3 o 4 giocatori.
 */
export const PLAYER_SCALING = Object.freeze({
  1: { maxActiveTickets: 3, baseSpawnIntervalMs: 12_500, minSpawnIntervalMs: 9_200, patienceScale: 1.08 },
  2: { maxActiveTickets: 4, baseSpawnIntervalMs: 10_200, minSpawnIntervalMs: 7_400, patienceScale: 1.02 },
  3: { maxActiveTickets: 5, baseSpawnIntervalMs: 8_400, minSpawnIntervalMs: 6_200, patienceScale: 1.0 },
  4: { maxActiveTickets: 6, baseSpawnIntervalMs: 7_200, minSpawnIntervalMs: 5_400, patienceScale: 0.98 },
});

export function getScalingForPlayers(playerCount = 1) {
  const clamped = Math.max(1, Math.min(4, Math.trunc(Number(playerCount) || 1)));
  return PLAYER_SCALING[clamped];
}

/**
 * Determina la fase della partita in base al tempo trascorso:
 * - Fase 1 (inizio): 0 - 45s
 * - Fase 2 (centro): 45 - 115s
 * - Fase 3 (finale): 115 - 165s
 */
export function getMatchPhase(elapsedMs = 0) {
  if (elapsedMs < 45_000) return { index: 1, id: 'inizio', label: 'Inizio servizio' };
  if (elapsedMs < 115_000) return { index: 2, id: 'centro', label: 'Ora di punta' };
  return { index: 3, id: 'finale', label: 'Rush finale' };
}

/**
 * Calcola lo stato corrente di uno slot griglia rispetto a `nowMs`.
 */
export function getGrillSlotStatus(slot, nowMs) {
  if (!slot || !slot.ingredientId) {
    return {
      state: COOK_STATES.RAW,
      progress: 0,
      burnProgress: 0,
      aboutToBurn: false,
      remainingMs: 0,
    };
  }
  const ing = getIngredient(slot.ingredientId);
  const cookTimeMs = slot.cookTimeMs || ing?.cookTimeMs || 5500;
  const burnWindowMs = slot.burnWindowMs || ing?.burnWindowMs || 7500;
  const elapsed = Math.max(0, nowMs - slot.startedAtMs);

  if (elapsed < cookTimeMs) {
    return {
      state: COOK_STATES.COOKING,
      progress: Math.min(1, elapsed / cookTimeMs),
      burnProgress: 0,
      aboutToBurn: false,
      remainingMs: cookTimeMs - elapsed,
    };
  }

  const readyElapsed = elapsed - cookTimeMs;
  if (readyElapsed < burnWindowMs) {
    const burnProgress = Math.min(1, readyElapsed / burnWindowMs);
    return {
      state: COOK_STATES.COOKED,
      progress: 1,
      burnProgress,
      aboutToBurn: burnProgress >= 0.65,
      remainingMs: burnWindowMs - readyElapsed,
    };
  }

  return {
    state: COOK_STATES.BURNED,
    progress: 1,
    burnProgress: 1,
    aboutToBurn: false,
    remainingMs: 0,
  };
}

/**
 * Crea lo stato iniziale della partita al momento dello start.
 */
export function createInitialGameState({ seed = Date.now(), playerCount = 1, nowMs = Date.now() } = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const clampedPlayers = Math.max(1, Math.min(4, Math.trunc(Number(playerCount) || 1)));

  let state = {
    startedAtMs: nowMs,
    endsAtMs: nowMs + ROUND_DURATION_MS,
    lastTickAtMs: nowMs,
    playerCount: clampedPlayers,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextCustomerSeq: 1,
    nextTicketSeq: 1,
    nextEventSeq: 1,
    nextSpawnAtMs: nowMs,
    recentRecipeIds: [],
    recentQuotes: [],
    activeTickets: [],
    grillSlots: Array.from({ length: GRILL_SLOT_COUNT }, (_, idx) => ({
      slotIndex: idx,
      ingredientId: null,
      startedAtMs: null,
      cookTimeMs: 0,
      burnWindowMs: 0,
      startedByPlayerId: null,
    })),
    cookedTray: [],
    prepBoards: Array.from({ length: PREP_BOARD_COUNT }, (_, idx) => ({
      boardIndex: idx,
      targetTicketId: null,
      ingredients: [],
      updatedByPlayerId: null,
    })),
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastServeAtMs: null,
    stats: {
      ordersServed: 0,
      wrongDeliveries: 0,
      customersLost: 0,
      burnedCount: 0,
      tipsEarned: 0,
      comboBonusEarned: 0,
    },
    playerStats: {},
    scoreEvents: [
      {
        id: 'evt-start',
        atMs: nowMs,
        delta: 0,
        type: 'info',
        message: 'Saracinesca alzata! Il Banco del Gambero è aperto.',
      },
    ],
    processedActions: [],
  };

  // Genera subito il primo cliente (e un secondo se la squadra ha 3-4 giocatori)
  state = spawnCustomerWave(state, nowMs);
  if (clampedPlayers >= 3 && state.activeTickets.length < 2) {
    state = spawnCustomerWave(state, nowMs);
  }

  return state;
}

function recordScoreEvent(state, { atMs, delta = 0, type = 'info', message, playerId = null }) {
  const id = `evt-${state.nextEventSeq}`;
  const nextEventSeq = state.nextEventSeq + 1;
  const entry = { id, atMs, delta, type, message, playerId };
  const scoreEvents = [entry, ...(state.scoreEvents || [])].slice(0, MAX_SCORE_EVENTS);
  return { ...state, nextEventSeq, scoreEvents };
}

function incrementPlayerStat(state, playerId, key, amount = 1) {
  if (!playerId) return state;
  const prev = state.playerStats?.[playerId] || {
    ordersServed: 0,
    ingredientsCooked: 0,
    ingredientsAssembled: 0,
    mistakes: 0,
  };
  return {
    ...state,
    playerStats: {
      ...state.playerStats,
      [playerId]: {
        ...prev,
        [key]: (prev[key] || 0) + amount,
      },
    },
  };
}

/**
 * Seleziona una ricetta compatibile con la fase e con l'archetipo,
 * evitando più di 2 ricette identiche consecutive.
 */
function selectRecipeForSpawn(rngState, phaseIndex, archetype, recentRecipeIds = []) {
  let candidates = RECIPES.filter((r) => r.minPhase <= phaseIndex);

  if (phaseIndex === 1) {
    // All'inizio privilegia ricette snelle (3-4 ingredienti o diff 1)
    const simple = candidates.filter((r) => r.difficulty === 1 || r.ingredients.length <= 4);
    if (simple.length > 0) candidates = simple;
  }

  if (archetype.preferSimple) {
    const simple = candidates.filter((r) => r.difficulty === 1);
    if (simple.length > 0) candidates = simple;
  }

  if (archetype.requiresExclusion) {
    const withRemovable = candidates.filter((r) => r.removableIngredients.length > 0);
    if (withRemovable.length > 0) candidates = withRemovable;
  }

  if (archetype.requiresAddition) {
    const withAdditions = candidates.filter((r) => r.allowedAdditions.length > 0);
    if (withAdditions.length > 0) candidates = withAdditions;
  }

  // Regola anti-ripetizione: mai più di 2 ordini identici consecutivi
  if (
    recentRecipeIds.length >= 2 &&
    recentRecipeIds[0] === recentRecipeIds[1]
  ) {
    const lastId = recentRecipeIds[0];
    const filtered = candidates.filter((r) => r.id !== lastId);
    if (filtered.length > 0) candidates = filtered;
  }

  return pickFromArray(rngState, candidates.length > 0 ? candidates : RECIPES);
}

/**
 * Costruisce i modificatori coerenti con l'archetipo e la ricetta scelta.
 */
function buildModifiersForArchetype(rngState, recipe, archetype, phaseIndex) {
  let currentRng = rngState;
  const modifiers = {};

  if (archetype.requiresExclusion && recipe.removableIngredients.length > 0) {
    // Se la ricetta ha cipolla, privilegia "senza cipolla"
    if (recipe.removableIngredients.includes('cipolla')) {
      modifiers.exclude = 'cipolla';
    } else {
      const picked = pickFromArray(currentRng, recipe.removableIngredients);
      currentRng = picked.nextSeedState;
      modifiers.exclude = picked.value;
    }
  } else if (archetype.requiresAddition && recipe.allowedAdditions.length > 0) {
    const picked = pickFromArray(currentRng, recipe.allowedAdditions);
    currentRng = picked.nextSeedState;
    modifiers.add = picked.value;
  } else if (archetype.canSwapVariant && phaseIndex >= 2 && Object.keys(recipe.variantSwaps || {}).length > 0) {
    const swapChance = nextRandom(currentRng);
    currentRng = swapChance.nextSeedState;
    if (swapChance.value < 0.55) {
      const [from, to] = Object.entries(recipe.variantSwaps)[0];
      modifiers.swap = { from, to };
    }
  }

  // Verifica che i modificatori producano sempre ingredienti validi
  const validList = buildTicketIngredients(recipe.id, modifiers);
  if (!validList) {
    return { modifiers: {}, targetIngredients: [...recipe.ingredients], nextSeedState: currentRng };
  }

  return {
    modifiers,
    targetIngredients: validList,
    nextSeedState: currentRng,
  };
}

function createSingleTicket({
  state,
  rngState,
  nowMs,
  phaseIndex,
  archetype,
  customerName,
  appearanceSeed,
  linkedGroupId = null,
  ticketIndexInGroup = 1,
  totalInGroup = 1,
}) {
  let currentRng = rngState;
  const recipePick = selectRecipeForSpawn(currentRng, phaseIndex, archetype, state.recentRecipeIds);
  currentRng = recipePick.nextSeedState;
  const recipe = recipePick.value || RECIPES[0];

  const modResult = buildModifiersForArchetype(currentRng, recipe, archetype, phaseIndex);
  currentRng = modResult.nextSeedState;

  const quotePick = pickFromArray(
    currentRng,
    archetype.lines.arrival.filter((q) => !state.recentQuotes.includes(q)).length > 0
      ? archetype.lines.arrival.filter((q) => !state.recentQuotes.includes(q))
      : archetype.lines.arrival,
  );
  currentRng = quotePick.nextSeedState;

  const scaling = getScalingForPlayers(state.playerCount);
  const complexityBonusMs = Math.max(0, (modResult.targetIngredients.length - 3) * 3200);
  const grillBufferMs = recipe.requiresGrill ? 5500 : 0;
  const rawPatience =
    (recipe.basePatienceMs + complexityBonusMs + grillBufferMs) *
    archetype.patienceMultiplier *
    scaling.patienceScale;
  const patienceMs = Math.round(Math.max(24_000, Math.min(75_000, rawPatience)));

  const ticketId = `tkt-${state.nextTicketSeq}`;
  const customerId = `npc-${state.nextCustomerSeq}`;

  const thinkingUntilMs = archetype.thinkingTimeMs
    ? nowMs + archetype.thinkingTimeMs
    : null;

  const ticket = {
    id: ticketId,
    customerId,
    customerName,
    appearanceSeed,
    appearance: getNpcAppearance(appearanceSeed),
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    badgeLabel: archetype.badgeLabel,
    recipeId: recipe.id,
    recipeName: recipe.name,
    bread: recipe.bread,
    requiresGrill: modResult.targetIngredients.some((id) => INGREDIENT_MAP[id]?.requiresGrill),
    modifiers: modResult.modifiers,
    targetIngredients: modResult.targetIngredients,
    basePoints: recipe.basePoints,
    bonusPoints: archetype.bonusPoints || 0,
    bonusPatienceRatio: archetype.bonusPatienceRatio || 0.35,
    quote: quotePick.value,
    spawnedAtMs: nowMs,
    patienceMs,
    expiresAtMs: nowMs + patienceMs,
    thinkingUntilMs,
    prepStarted: false,
    linkedGroupId,
    ticketIndexInGroup,
    totalInGroup,
  };

  return {
    ticket,
    nextSeedState: currentRng,
  };
}

/**
 * Genera deterministicamente un nuovo arrivo (singolo, ordine doppio o gruppo di amici).
 */
export function spawnCustomerWave(state, nowMs) {
  const scaling = getScalingForPlayers(state.playerCount);
  const openSlots = scaling.maxActiveTickets - state.activeTickets.length;
  if (openSlots <= 0) return state;

  const elapsedMs = Math.max(0, nowMs - state.startedAtMs);
  const phase = getMatchPhase(elapsedMs);
  let currentRng = state.rngState;

  // Filtra gli archetipi disponibili per fase e numero giocatori
  let eligibleArchetypes = CUSTOMER_ARCHETYPES.filter(
    (a) => a.minPhase <= phase.index && a.minPlayers <= state.playerCount,
  );
  if (openSlots < 2) {
    eligibleArchetypes = eligibleArchetypes.filter((a) => !a.isDoubleOrder && !a.spawnsCompanion);
  }

  const archPick = pickFromArray(currentRng, eligibleArchetypes);
  currentRng = archPick.nextSeedState;
  const archetype = archPick.value || CUSTOMER_ARCHETYPES[0];

  const namePick = pickFromArray(currentRng, NPC_NAMES);
  currentRng = namePick.nextSeedState;
  const seedPick = randomInt(currentRng, 100, 999_999);
  currentRng = seedPick.nextSeedState;

  let nextState = {
    ...state,
    rngState: currentRng,
  };

  if (archetype.isDoubleOrder && openSlots >= 2) {
    const groupId = `dbl-${nextState.nextCustomerSeq}`;
    const first = createSingleTicket({
      state: nextState,
      rngState: nextState.rngState,
      nowMs,
      phaseIndex: phase.index,
      archetype,
      customerName: namePick.value,
      appearanceSeed: seedPick.value,
      linkedGroupId: groupId,
      ticketIndexInGroup: 1,
      totalInGroup: 2,
    });

    nextState = {
      ...nextState,
      rngState: first.nextSeedState,
      nextTicketSeq: nextState.nextTicketSeq + 1,
      recentRecipeIds: [first.ticket.recipeId, ...nextState.recentRecipeIds].slice(0, 4),
      recentQuotes: [first.ticket.quote, ...nextState.recentQuotes].slice(0, 4),
    };

    const second = createSingleTicket({
      state: nextState,
      rngState: nextState.rngState,
      nowMs,
      phaseIndex: phase.index,
      archetype,
      customerName: namePick.value,
      appearanceSeed: seedPick.value,
      linkedGroupId: groupId,
      ticketIndexInGroup: 2,
      totalInGroup: 2,
    });

    nextState = {
      ...nextState,
      rngState: second.nextSeedState,
      nextCustomerSeq: nextState.nextCustomerSeq + 1,
      nextTicketSeq: nextState.nextTicketSeq + 1,
      activeTickets: [...nextState.activeTickets, first.ticket, second.ticket],
      recentRecipeIds: [second.ticket.recipeId, ...nextState.recentRecipeIds].slice(0, 4),
    };
  } else if (archetype.spawnsCompanion && openSlots >= 2) {
    const first = createSingleTicket({
      state: nextState,
      rngState: nextState.rngState,
      nowMs,
      phaseIndex: phase.index,
      archetype,
      customerName: namePick.value,
      appearanceSeed: seedPick.value,
    });

    nextState = {
      ...nextState,
      rngState: first.nextSeedState,
      nextCustomerSeq: nextState.nextCustomerSeq + 1,
      nextTicketSeq: nextState.nextTicketSeq + 1,
      recentRecipeIds: [first.ticket.recipeId, ...nextState.recentRecipeIds].slice(0, 4),
      recentQuotes: [first.ticket.quote, ...nextState.recentQuotes].slice(0, 4),
    };

    const friendNamePick = pickFromArray(
      nextState.rngState,
      NPC_NAMES.filter((n) => n !== namePick.value),
    );
    const friendSeedPick = randomInt(friendNamePick.nextSeedState, 100, 999_999);

    const second = createSingleTicket({
      state: nextState,
      rngState: friendSeedPick.nextSeedState,
      nowMs,
      phaseIndex: phase.index,
      archetype,
      customerName: friendNamePick.value,
      appearanceSeed: friendSeedPick.value,
    });

    nextState = {
      ...nextState,
      rngState: second.nextSeedState,
      nextCustomerSeq: nextState.nextCustomerSeq + 1,
      nextTicketSeq: nextState.nextTicketSeq + 1,
      activeTickets: [...nextState.activeTickets, first.ticket, second.ticket],
      recentRecipeIds: [second.ticket.recipeId, ...nextState.recentRecipeIds].slice(0, 4),
    };
  } else {
    const single = createSingleTicket({
      state: nextState,
      rngState: nextState.rngState,
      nowMs,
      phaseIndex: phase.index,
      archetype,
      customerName: namePick.value,
      appearanceSeed: seedPick.value,
    });

    nextState = {
      ...nextState,
      rngState: single.nextSeedState,
      nextCustomerSeq: nextState.nextCustomerSeq + 1,
      nextTicketSeq: nextState.nextTicketSeq + 1,
      activeTickets: [...nextState.activeTickets, single.ticket],
      recentRecipeIds: [single.ticket.recipeId, ...nextState.recentRecipeIds].slice(0, 4),
      recentQuotes: [single.ticket.quote, ...nextState.recentQuotes].slice(0, 4),
    };
  }

  // Calcola il prossimo intervallo di spawn in base alla fase e al numero di giocatori
  const phaseFactor = phase.index === 1 ? 1.08 : phase.index === 2 ? 0.92 : 0.8;
  const jitter = randomInt(nextState.rngState, -900, 900);
  const interval = Math.max(
    scaling.minSpawnIntervalMs,
    Math.round(scaling.baseSpawnIntervalMs * phaseFactor + jitter.value),
  );

  return {
    ...nextState,
    rngState: jitter.nextSeedState,
    nextSpawnAtMs: nowMs + interval,
  };
}

/**
 * Avanza la simulazione temporale (scadenza clienti, conferma indecisi, nuovi arrivi).
 */
export function advanceSimulation(state, nowMs) {
  if (!state) return state;
  const clampedNow = Math.min(nowMs, state.endsAtMs);
  let next = { ...state, lastTickAtMs: clampedNow };

  // 1. Verifica clienti che hanno esaurito la pazienza
  const remainingTickets = [];
  const expiredTickets = [];
  for (const tkt of next.activeTickets) {
    if (clampedNow >= tkt.expiresAtMs) {
      expiredTickets.push(tkt);
    } else {
      // Se un cliente indeciso ha superato la finestra di riflessione, conferma l'ordine
      if (tkt.thinkingUntilMs && clampedNow >= tkt.thinkingUntilMs) {
        remainingTickets.push({ ...tkt, thinkingUntilMs: null });
      } else {
        remainingTickets.push(tkt);
      }
    }
  }

  if (expiredTickets.length > 0) {
    next.activeTickets = remainingTickets;
    // Scollega eventuali banchi puntati a ticket scaduti
    next.prepBoards = next.prepBoards.map((b) =>
      expiredTickets.some((e) => e.id === b.targetTicketId)
        ? { ...b, targetTicketId: remainingTickets[0]?.id || null }
        : b,
    );

    for (const exp of expiredTickets) {
      const penalty = 25;
      next.score = Math.max(0, next.score - penalty);
      next.combo = 0;
      next.stats = {
        ...next.stats,
        customersLost: next.stats.customersLost + 1,
      };
      next = recordScoreEvent(next, {
        atMs: clampedNow,
        delta: -penalty,
        type: 'penalty',
        message: `${exp.customerName} ha perso la pazienza (${exp.recipeName}) (-${penalty} pt)`,
      });
    }
  } else {
    next.activeTickets = remainingTickets;
  }

  // 2. Genera nuovi ordini se il round non è terminato
  if (clampedNow < next.endsAtMs) {
    const scaling = getScalingForPlayers(next.playerCount);
    let safety = 0;
    while (
      clampedNow >= next.nextSpawnAtMs &&
      next.activeTickets.length < scaling.maxActiveTickets &&
      safety < 4
    ) {
      next = spawnCustomerWave(next, next.nextSpawnAtMs);
      safety += 1;
    }

    // Se non ci sono ticket attivi, fai entrare un cliente entro 1.2s per non lasciare tempi morti
    if (next.activeTickets.length === 0 && next.nextSpawnAtMs > clampedNow + 1200) {
      next = spawnCustomerWave(next, clampedNow);
    }
  }

  return next;
}

/**
 * Confronta gli ingredienti sul banco con quelli richiesti dal ticket.
 */
export function validateSandwichIngredients(assembled = [], target = []) {
  if (!Array.isArray(assembled) || !Array.isArray(target)) {
    return { ok: false, missing: target || [], extra: [] };
  }
  const countsTarget = {};
  for (const id of target) countsTarget[id] = (countsTarget[id] || 0) + 1;

  const countsAssembled = {};
  for (const id of assembled) countsAssembled[id] = (countsAssembled[id] || 0) + 1;

  const missing = [];
  const extra = [];

  for (const [id, needed] of Object.entries(countsTarget)) {
    const have = countsAssembled[id] || 0;
    if (have < needed) {
      for (let i = 0; i < needed - have; i += 1) missing.push(id);
    }
  }

  for (const [id, have] of Object.entries(countsAssembled)) {
    const needed = countsTarget[id] || 0;
    if (have > needed) {
      for (let i = 0; i < have - needed; i += 1) extra.push(id);
    }
  }

  return {
    ok: missing.length === 0 && extra.length === 0 && assembled.length === target.length,
    missing,
    extra,
  };
}

/**
 * Analizza in dettaglio un tagliere rispetto a un ticket cliente, restituendo:
 * - checklist ordinata degli ingredienti richiesti (presente / mancante)
 * - elenco degli strati sul tagliere marcati come validi o in eccesso/errati (`isExtra`)
 * - stato complessivo (`empty` | `in_progress` | `has_errors` | `ready_to_serve`)
 */
export function inspectBoardAgainstTicket(boardIngredients = [], ticket = null) {
  const assembled = Array.isArray(boardIngredients) ? boardIngredients : [];
  if (!ticket || !Array.isArray(ticket.targetIngredients)) {
    return {
      status: assembled.length === 0 ? 'empty' : 'in_progress',
      ok: false,
      checklist: [],
      assembledLayers: assembled.map((ingredientId, index) => ({
        index,
        ingredientId,
        isExtra: false,
      })),
      missing: [],
      extra: [],
    };
  }

  const target = ticket.targetIngredients;
  const validation = validateSandwichIngredients(assembled, target);

  // Conta le occorrenze disponibili sul tagliere per marcare la checklist
  const remainingHave = {};
  for (const id of assembled) {
    remainingHave[id] = (remainingHave[id] || 0) + 1;
  }

  const checklist = target.map((ingredientId) => {
    if ((remainingHave[ingredientId] || 0) > 0) {
      remainingHave[ingredientId] -= 1;
      return { ingredientId, present: true };
    }
    return { ingredientId, present: false };
  });

  // Conta le occorrenze richieste per individuare esattamente quali strati sul tagliere sono extra/errati
  const remainingNeeded = {};
  for (const id of target) {
    remainingNeeded[id] = (remainingNeeded[id] || 0) + 1;
  }

  const assembledLayers = assembled.map((ingredientId, index) => {
    if ((remainingNeeded[ingredientId] || 0) > 0) {
      remainingNeeded[ingredientId] -= 1;
      return { index, ingredientId, isExtra: false };
    }
    return { index, ingredientId, isExtra: true };
  });

  let status = 'in_progress';
  if (assembled.length === 0) {
    status = 'empty';
  } else if (validation.extra.length > 0) {
    status = 'has_errors';
  } else if (validation.ok) {
    status = 'ready_to_serve';
  }

  return {
    status,
    ok: validation.ok,
    checklist,
    assembledLayers,
    missing: validation.missing,
    extra: validation.extra,
  };
}

/**
 * Applica un'azione di gioco in modo idempotente e autorevole.
 * Ritorna `{ state, notice, conflict, duplicate }`.
 */
export function applyPlayerAction(rawState, action = {}, nowMs = Date.now()) {
  let state = advanceSimulation(rawState, nowMs);

  const actionId = typeof action.actionId === 'string' ? action.actionId.trim() : '';
  if (actionId && state.processedActions.includes(actionId)) {
    return { state, duplicate: true, conflict: false, notice: null };
  }

  if (nowMs >= state.endsAtMs) {
    return {
      state,
      duplicate: false,
      conflict: true,
      notice: 'Tempo scaduto! Il turno in cucina è concluso.',
    };
  }

  const recordActionId = (s) => {
    if (!actionId) return s;
    return {
      ...s,
      processedActions: [actionId, ...s.processedActions].slice(0, MAX_PROCESSED_ACTIONS),
    };
  };

  const playerId = action.playerId || null;
  const type = action.type;

  switch (type) {
    case 'START_COOK': {
      const ingredientId = action.ingredientId;
      const ing = getIngredient(ingredientId);
      if (!ing || !ing.requiresGrill) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Questo ingrediente non va sulla piastra.',
        };
      }

      const requestedSlot = Number.isInteger(action.slotIndex) ? action.slotIndex : null;
      let targetSlotIndex = -1;
      if (
        requestedSlot !== null &&
        requestedSlot >= 0 &&
        requestedSlot < state.grillSlots.length &&
        !state.grillSlots[requestedSlot].ingredientId
      ) {
        targetSlotIndex = requestedSlot;
      } else {
        targetSlotIndex = state.grillSlots.findIndex((s) => !s.ingredientId);
      }

      if (targetSlotIndex === -1) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'La piastra è piena! Raccogli o libera uno slot.',
        };
      }

      const grillSlots = state.grillSlots.map((slot, idx) =>
        idx === targetSlotIndex
          ? {
              slotIndex: idx,
              ingredientId: ing.id,
              startedAtMs: nowMs,
              cookTimeMs: ing.cookTimeMs,
              burnWindowMs: ing.burnWindowMs,
              startedByPlayerId: playerId,
            }
          : slot,
      );

      return {
        state: recordActionId({ ...state, grillSlots }),
        conflict: false,
        notice: `${ing.shortName} sulla piastra!`,
      };
    }

    case 'COLLECT_GRILL': {
      const slotIndex = Number(action.slotIndex);
      const slot = state.grillSlots[slotIndex];
      if (!slot || !slot.ingredientId) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Slot piastra già raccolto da un compagno.',
        };
      }

      const status = getGrillSlotStatus(slot, nowMs);
      const ing = getIngredient(slot.ingredientId);

      if (status.state === COOK_STATES.COOKING) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: `${ing?.shortName || 'Ingrediente'} è ancora crudo, aspetta che sia pronto!`,
        };
      }

      const emptySlot = {
        slotIndex,
        ingredientId: null,
        startedAtMs: null,
        cookTimeMs: 0,
        burnWindowMs: 0,
        startedByPlayerId: null,
      };

      if (status.state === COOK_STATES.BURNED) {
        const penalty = 15;
        let next = {
          ...state,
          score: Math.max(0, state.score - penalty),
          grillSlots: state.grillSlots.map((s, idx) => (idx === slotIndex ? emptySlot : s)),
          stats: {
            ...state.stats,
            burnedCount: state.stats.burnedCount + 1,
          },
        };
        next = incrementPlayerStat(next, playerId, 'mistakes', 1);
        next = recordScoreEvent(next, {
          atMs: nowMs,
          delta: -penalty,
          type: 'penalty',
          message: `${ing?.shortName || 'Cottura'} bruciata rimossa dalla piastra (-${penalty} pt)`,
          playerId,
        });
        return {
          state: recordActionId(next),
          conflict: false,
          notice: `${ing?.shortName || 'Cottura'} bruciata buttata (-${penalty} pt).`,
        };
      }

      // Stato COOKED (pronto!)
      const boardIndex = Number.isInteger(action.toBoardIndex) ? action.toBoardIndex : null;
      if (boardIndex !== null && state.prepBoards[boardIndex]) {
        const board = state.prepBoards[boardIndex];
        const prepBoards = state.prepBoards.map((b, idx) =>
          idx === boardIndex
            ? {
                ...b,
                ingredients: [...b.ingredients, slot.ingredientId],
                updatedByPlayerId: playerId,
              }
            : b,
        );
        let next = {
          ...state,
          grillSlots: state.grillSlots.map((s, idx) => (idx === slotIndex ? emptySlot : s)),
          prepBoards,
        };
        next = incrementPlayerStat(next, playerId, 'ingredientsCooked', 1);
        next = incrementPlayerStat(next, playerId, 'ingredientsAssembled', 1);
        return {
          state: recordActionId(next),
          conflict: false,
          notice: `${ing.shortName} cotto a puntino e aggiunto al banco ${boardIndex + 1}!`,
        };
      }

      if (state.cookedTray.length >= COOKED_TRAY_LIMIT) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Vassoio caldi pieno! Usa gli ingredienti pronti sui banchi.',
        };
      }

      let next = {
        ...state,
        grillSlots: state.grillSlots.map((s, idx) => (idx === slotIndex ? emptySlot : s)),
        cookedTray: [
          ...state.cookedTray,
          {
            id: `cooked-${nowMs}-${slotIndex}`,
            ingredientId: slot.ingredientId,
            cookedAtMs: nowMs,
            cookedByPlayerId: playerId,
          },
        ],
      };
      next = incrementPlayerStat(next, playerId, 'ingredientsCooked', 1);

      return {
        state: recordActionId(next),
        conflict: false,
        notice: `${ing.shortName} pronto nel vassoio caldo!`,
      };
    }

    case 'DISCARD_GRILL': {
      const slotIndex = Number(action.slotIndex);
      const slot = state.grillSlots[slotIndex];
      if (!slot || !slot.ingredientId) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Lo slot piastra è già libero.',
        };
      }
      const status = getGrillSlotStatus(slot, nowMs);
      const ing = getIngredient(slot.ingredientId);
      const emptySlot = {
        slotIndex,
        ingredientId: null,
        startedAtMs: null,
        cookTimeMs: 0,
        burnWindowMs: 0,
        startedByPlayerId: null,
      };
      let next = {
        ...state,
        grillSlots: state.grillSlots.map((s, idx) => (idx === slotIndex ? emptySlot : s)),
      };
      if (status.state === COOK_STATES.BURNED) {
        const penalty = 15;
        next.score = Math.max(0, next.score - penalty);
        next.stats = { ...next.stats, burnedCount: next.stats.burnedCount + 1 };
        next = recordScoreEvent(next, {
          atMs: nowMs,
          delta: -penalty,
          type: 'penalty',
          message: `${ing?.shortName || 'Cottura'} bruciata rimossa (-${penalty} pt)`,
          playerId,
        });
      }
      return {
        state: recordActionId(next),
        conflict: false,
        notice: `${ing?.shortName || 'Ingrediente'} rimosso dalla piastra.`,
      };
    }

    case 'SELECT_TICKET': {
      const boardIndex = Number(action.boardIndex) || 0;
      const ticketId = action.ticketId;
      if (!state.prepBoards[boardIndex]) {
        return { state: recordActionId(state), conflict: true, notice: 'Banco non valido.' };
      }
      const ticket = state.activeTickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Questo ticket non è più attivo.',
        };
      }

      // Conferma immediatamente l'ordine se il cliente era "Indeciso"
      const activeTickets = state.activeTickets.map((t) =>
        t.id === ticketId ? { ...t, thinkingUntilMs: null, prepStarted: true } : t,
      );
      const prepBoards = state.prepBoards.map((b, idx) =>
        idx === boardIndex ? { ...b, targetTicketId: ticketId, updatedByPlayerId: playerId } : b,
      );

      return {
        state: recordActionId({ ...state, activeTickets, prepBoards }),
        conflict: false,
        notice: `Banco ${boardIndex + 1} collegato a ${ticket.customerName} (${ticket.recipeName}).`,
      };
    }

    case 'ADD_INGREDIENT': {
      const boardIndex = Number(action.boardIndex) || 0;
      const ingredientId = action.ingredientId;
      const board = state.prepBoards[boardIndex];
      const ing = getIngredient(ingredientId);

      if (!board || !ing) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Ingrediente o banco non valido.',
        };
      }

      if (board.ingredients.length >= 9) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Il panino su questo banco è già pieno!',
        };
      }

      let nextCookedTray = state.cookedTray;
      let nextGrillSlots = state.grillSlots;
      let tookFromGrill = false;

      // Se l'ingrediente richiede cottura, prelevalo dal vassoio caldi o direttamente da uno slot PRONTO
      if (ing.requiresGrill) {
        const trayIdx = state.cookedTray.findIndex((item) => item.ingredientId === ingredientId);
        if (trayIdx !== -1) {
          nextCookedTray = state.cookedTray.filter((_, idx) => idx !== trayIdx);
        } else {
          const readySlotIdx = state.grillSlots.findIndex(
            (s) =>
              s.ingredientId === ingredientId &&
              getGrillSlotStatus(s, nowMs).state === COOK_STATES.COOKED,
          );
          if (readySlotIdx !== -1) {
            tookFromGrill = true;
            nextGrillSlots = state.grillSlots.map((s, idx) =>
              idx === readySlotIdx
                ? {
                    slotIndex: idx,
                    ingredientId: null,
                    startedAtMs: null,
                    cookTimeMs: 0,
                    burnWindowMs: 0,
                    startedByPlayerId: null,
                  }
                : s,
            );
          } else {
            return {
              state: recordActionId(state),
              conflict: true,
              notice: `Cuoci prima "${ing.shortName}" sulla piastra finché diventa pronto!`,
            };
          }
        }
      }

      // Se il banco non ha ancora un ticket associato, aggancialo al primo attivo
      const targetTicketId =
        board.targetTicketId && state.activeTickets.some((t) => t.id === board.targetTicketId)
          ? board.targetTicketId
          : state.activeTickets[0]?.id || null;

      const activeTickets = state.activeTickets.map((t) =>
        t.id === targetTicketId ? { ...t, prepStarted: true } : t,
      );

      const prepBoards = state.prepBoards.map((b, idx) =>
        idx === boardIndex
          ? {
              ...b,
              targetTicketId,
              ingredients: [...b.ingredients, ingredientId],
              updatedByPlayerId: playerId,
            }
          : b,
      );

      let next = {
        ...state,
        activeTickets,
        cookedTray: nextCookedTray,
        grillSlots: nextGrillSlots,
        prepBoards,
      };
      if (tookFromGrill) {
        next = incrementPlayerStat(next, playerId, 'ingredientsCooked', 1);
      }
      next = incrementPlayerStat(next, playerId, 'ingredientsAssembled', 1);

      return {
        state: recordActionId(next),
        conflict: false,
        notice: `${ing.shortName} aggiunto al banco ${boardIndex + 1}.`,
      };
    }

    case 'REMOVE_INGREDIENT': {
      const boardIndex = Number(action.boardIndex) || 0;
      const board = state.prepBoards[boardIndex];
      if (!board || board.ingredients.length === 0) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Il banco è già vuoto.',
        };
      }

      const removeIdx = Number.isInteger(action.ingredientIndex)
        ? action.ingredientIndex
        : board.ingredients.length - 1;

      if (removeIdx < 0 || removeIdx >= board.ingredients.length) {
        return { state: recordActionId(state), conflict: true, notice: 'Indice non valido.' };
      }

      const removedId = board.ingredients[removeIdx];
      const removedIng = getIngredient(removedId);
      const nextIngredients = board.ingredients.filter((_, idx) => idx !== removeIdx);

      // Se era una proteina già cotta, rimettila nel vassoio caldi se c'è posto
      let nextCookedTray = state.cookedTray;
      if (removedIng?.requiresGrill && state.cookedTray.length < COOKED_TRAY_LIMIT) {
        nextCookedTray = [
          ...state.cookedTray,
          {
            id: `returned-${nowMs}-${removeIdx}`,
            ingredientId: removedId,
            cookedAtMs: nowMs,
            cookedByPlayerId: playerId,
          },
        ];
      }

      const prepBoards = state.prepBoards.map((b, idx) =>
        idx === boardIndex
          ? { ...b, ingredients: nextIngredients, updatedByPlayerId: playerId }
          : b,
      );

      return {
        state: recordActionId({ ...state, cookedTray: nextCookedTray, prepBoards }),
        conflict: false,
        notice: `${removedIng?.shortName || 'Ingrediente'} rimosso dal panino.`,
      };
    }

    case 'CLEAR_BOARD': {
      const boardIndex = Number(action.boardIndex) || 0;
      const board = state.prepBoards[boardIndex];
      if (!board || board.ingredients.length === 0) {
        return { state: recordActionId(state), conflict: false, notice: 'Banco già pulito.' };
      }

      const prepBoards = state.prepBoards.map((b, idx) =>
        idx === boardIndex ? { ...b, ingredients: [], updatedByPlayerId: playerId } : b,
      );

      return {
        state: recordActionId({ ...state, prepBoards }),
        conflict: false,
        notice: `Banco ${boardIndex + 1} svuotato.`,
      };
    }

    case 'SERVE_ORDER': {
      const boardIndex = Number(action.boardIndex) || 0;
      const board = state.prepBoards[boardIndex];
      if (!board || board.ingredients.length === 0) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Assembla prima il panino sul banco!',
        };
      }

      const ticketId = action.ticketId || board.targetTicketId || state.activeTickets[0]?.id;
      const ticket = state.activeTickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: 'Ordine già consegnato o scaduto!',
        };
      }

      if (ticket.thinkingUntilMs && nowMs < ticket.thinkingUntilMs) {
        return {
          state: recordActionId(state),
          conflict: true,
          notice: `${ticket.customerName} sta ancora decidendo! Fissa prima la comanda.`,
        };
      }

      const validation = validateSandwichIngredients(board.ingredients, ticket.targetIngredients);
      const clearedBoards = state.prepBoards.map((b, idx) =>
        idx === boardIndex
          ? { ...b, ingredients: [], targetTicketId: null, updatedByPlayerId: playerId }
          : b,
      );

      if (!validation.ok) {
        const penalty = 20;
        const missingNames = validation.missing
          .slice(0, 2)
          .map((id) => getIngredient(id)?.shortName || id)
          .join(', ');
        const extraNames = validation.extra
          .slice(0, 2)
          .map((id) => getIngredient(id)?.shortName || id)
          .join(', ');
        const detail = missingNames
          ? `mancava: ${missingNames}`
          : extraNames
            ? `di troppo: ${extraNames}`
            : 'ingredienti errati';

        let next = {
          ...state,
          score: Math.max(0, state.score - penalty),
          combo: 0,
          prepBoards: clearedBoards,
          stats: {
            ...state.stats,
            wrongDeliveries: state.stats.wrongDeliveries + 1,
          },
        };
        next = incrementPlayerStat(next, playerId, 'mistakes', 1);
        next = recordScoreEvent(next, {
          atMs: nowMs,
          delta: -penalty,
          type: 'penalty',
          message: `Consegna errata a ${ticket.customerName} (${detail}) (-${penalty} pt)`,
          playerId,
        });
        return {
          state: recordActionId(next),
          conflict: false,
          notice: `Panino errato (${detail})! -${penalty} pt`,
        };
      }

      // Consegna corretta! Calcolo punti, mancia velocità, bonus archetipo e combo squadra
      const remainingMs = Math.max(0, ticket.expiresAtMs - nowMs);
      const patienceRatio = ticket.patienceMs > 0 ? remainingMs / ticket.patienceMs : 0;
      const speedTip = Math.round(patienceRatio * 40);

      let archetypeBonus = 0;
      if (ticket.linkedGroupId) {
        // Per ordine doppio, il bonus scatta quando anche l'altro ticket del gruppo è completato
        const siblingsLeft = state.activeTickets.filter(
          (t) => t.linkedGroupId === ticket.linkedGroupId && t.id !== ticket.id,
        );
        if (siblingsLeft.length === 0) {
          archetypeBonus = ticket.bonusPoints || 50;
        }
      } else if (patienceRatio >= (ticket.bonusPatienceRatio || 0.35)) {
        archetypeBonus = ticket.bonusPoints || 0;
      }

      const withinComboWindow =
        state.lastServeAtMs !== null && nowMs - state.lastServeAtMs <= COMBO_WINDOW_MS;
      const nextCombo = withinComboWindow ? state.combo + 1 : 1;
      const comboBonus = nextCombo > 1 ? Math.min(60, (nextCombo - 1) * 15) : 0;

      const totalEarned = ticket.basePoints + speedTip + archetypeBonus + comboBonus;
      const remainingTickets = state.activeTickets.filter((t) => t.id !== ticket.id);

      // Riassegna il prossimo ticket libero al banco
      const nextTargetId = remainingTickets[0]?.id || null;
      const finalBoards = clearedBoards.map((b, idx) =>
        idx === boardIndex ? { ...b, targetTicketId: nextTargetId } : b,
      );

      let next = {
        ...state,
        activeTickets: remainingTickets,
        prepBoards: finalBoards,
        score: state.score + totalEarned,
        combo: nextCombo,
        maxCombo: Math.max(state.maxCombo, nextCombo),
        lastServeAtMs: nowMs,
        stats: {
          ...state.stats,
          ordersServed: state.stats.ordersServed + 1,
          tipsEarned: state.stats.tipsEarned + speedTip + archetypeBonus,
          comboBonusEarned: state.stats.comboBonusEarned + comboBonus,
        },
      };

      next = incrementPlayerStat(next, playerId, 'ordersServed', 1);

      const parts = [`+${ticket.basePoints} base`];
      if (speedTip > 0) parts.push(`+${speedTip} velocità`);
      if (archetypeBonus > 0) parts.push(`+${archetypeBonus} bonus ${ticket.badgeLabel}`);
      if (comboBonus > 0) parts.push(`+${comboBonus} combo ×${nextCombo}`);

      next = recordScoreEvent(next, {
        atMs: nowMs,
        delta: totalEarned,
        type: 'reward',
        message: `${ticket.recipeName} servito a ${ticket.customerName}! +${totalEarned} pt (${parts.join(' · ')})`,
        playerId,
      });

      // Se tutti i ticket sono stati evasi prima della fine, fai entrare subito il prossimo cliente
      if (next.activeTickets.length === 0 && nowMs < next.endsAtMs) {
        next = spawnCustomerWave(next, nowMs);
      }

      return {
        state: recordActionId(next),
        conflict: false,
        notice: `Servito ${ticket.recipeName}! +${totalEarned} pt`,
      };
    }

    default:
      return {
        state: recordActionId(state),
        conflict: true,
        notice: 'Azione non riconosciuta.',
      };
  }
}
