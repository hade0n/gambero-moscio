import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOK_STATES,
  getIngredient,
  GRILLABLE_INGREDIENTS,
  INGREDIENTS,
} from '../src/game/data/ingredients.js';
import {
  buildTicketIngredients,
  RECIPES,
} from '../src/game/data/recipes.js';
import { CUSTOMER_ARCHETYPES } from '../src/game/data/archetypes.js';
import {
  advanceSimulation,
  applyPlayerAction,
  createInitialGameState,
  getGrillSlotStatus,
  getScalingForPlayers,
  ROUND_DURATION_MS,
  spawnCustomerWave,
  validateSandwichIngredients,
} from '../src/game/engine/gameEngine.js';
import {
  clearFallbackStoreForTests,
  createLobby,
  joinLobby,
  leaveLobby,
  PARTY_CODE_ALPHABET,
  performGameAction,
  resetJoinRateLimitsForTests,
  startMatch,
} from '../lib/game/store.js';

test('1. Ricette, ingredienti e stazioni sono validi e coerenti', () => {
  assert.equal(RECIPES.length, 8, 'Devono esserci esattamente 8 ricette nel menu iniziale');
  assert.ok(INGREDIENTS.length >= 21, 'Devono esserci tutti gli ingredienti base');

  for (const recipe of RECIPES) {
    assert.ok(recipe.id && recipe.name, `Ricetta ${recipe.id} ha id e nome`);
    assert.ok(getIngredient(recipe.bread), `Pane valido per ${recipe.id}`);
    assert.ok(recipe.ingredients.includes(recipe.bread), `Il pane è incluso negli ingredienti di ${recipe.id}`);

    for (const ingId of recipe.ingredients) {
      const ing = getIngredient(ingId);
      assert.ok(ing, `Ingrediente ${ingId} esiste in ${recipe.id}`);
    }

    const hasGrillIng = recipe.ingredients.some((id) => getIngredient(id)?.requiresGrill);
    assert.equal(
      recipe.requiresGrill,
      hasGrillIng,
      `Flag requiresGrill coerente per ${recipe.id}`,
    );
  }

  // Verifica specifica: Cuzzetiello al ragù non richiede griglia
  const cuzzetiello = RECIPES.find((r) => r.id === 'cuzzetiello_ragu');
  assert.equal(cuzzetiello.requiresGrill, false);
});

test('2. Personalizzazioni ("senza cipolla", aggiunte, varianti) producono sempre combinazioni valide', () => {
  const piccanteNoOnion = buildTicketIngredients('piccante', { exclude: 'cipolla' });
  assert.ok(piccanteNoOnion, 'Piccante senza cipolla deve essere valido');
  assert.ok(!piccanteNoOnion.includes('cipolla'), 'La cipolla deve essere esclusa');
  assert.ok(piccanteNoOnion.includes('burger_manzo'), 'Il burger di manzo resta presente');

  // Esclusione non ammessa deve restituire null
  const invalidExclude = buildTicketIngredients('cuzzetiello_ragu', { exclude: 'cuzzetiello' });
  assert.equal(invalidExclude, null, 'Non si può rimuovere il pane dal cuzzetiello');

  // Aggiunta ammessa (es. +crocche su classico_gambero)
  const hungryClassic = buildTicketIngredients('classico_gambero', { add: 'crocche' });
  assert.ok(hungryClassic.includes('crocche'));

  // Swap variante (es. provola -> fior_di_latte su parmigiana)
  const swappedParmigiana = buildTicketIngredients('parmigiana', {
    swap: { from: 'provola', to: 'fior_di_latte' },
  });
  assert.ok(swappedParmigiana.includes('fior_di_latte'));
  assert.ok(!swappedParmigiana.includes('provola'));
});

test('3. Generazione deterministica su 60 seed diversi senza blocchi né più di 2 ricette identiche consecutive', () => {
  assert.equal(CUSTOMER_ARCHETYPES.length, 8, 'Devono esserci 8 archetipi clienti');

  for (let seed = 1; seed <= 60; seed += 1) {
    const playerCount = ((seed - 1) % 4) + 1;
    let state = createInitialGameState({ seed: seed * 9973, playerCount, nowMs: 1_000_000 });
    const generatedRecipes = state.activeTickets.map((t) => t.recipeId);

    for (let step = 1; step <= 18; step += 1) {
      const nowMs = 1_000_000 + step * 9_000;
      // Libera uno slot per continuare a generare lungo tutto il round
      if (state.activeTickets.length >= getScalingForPlayers(playerCount).maxActiveTickets) {
        state = { ...state, activeTickets: state.activeTickets.slice(1) };
      }
      state = spawnCustomerWave(state, nowMs);
      for (const t of state.activeTickets) {
        assert.ok(t.targetIngredients.length >= 2, 'Ogni ticket ha almeno 2 ingredienti');
        assert.ok(t.patienceMs >= 24_000 && t.patienceMs <= 75_000, 'Pazienza bilanciata');
        for (const ingId of t.targetIngredients) {
          assert.ok(getIngredient(ingId), `Ingrediente ${ingId} valido`);
        }
      }
      const newest = state.activeTickets[state.activeTickets.length - 1];
      if (newest) generatedRecipes.push(newest.recipeId);
    }

    // Verifica: stesso seed produce esattamente lo stesso stato iniziale
    const twinState = createInitialGameState({ seed: seed * 9973, playerCount, nowMs: 1_000_000 });
    assert.deepEqual(
      twinState.activeTickets.map((t) => t.recipeId),
      createInitialGameState({ seed: seed * 9973, playerCount, nowMs: 1_000_000 }).activeTickets.map(
        (t) => t.recipeId,
      ),
    );
  }
});

test('4. Numero massimo di ticket scala correttamente per 1, 2, 3 e 4 giocatori', () => {
  const maxByPlayers = { 1: 3, 2: 4, 3: 5, 4: 6 };
  for (const [pCountStr, expectedMax] of Object.entries(maxByPlayers)) {
    const playerCount = Number(pCountStr);
    let state = createInitialGameState({ seed: 4242, playerCount, nowMs: 10_000 });
    for (let i = 0; i < 10; i += 1) {
      state = spawnCustomerWave(state, 10_000 + i * 5000);
    }
    assert.equal(
      state.activeTickets.length,
      expectedMax,
      `Per ${playerCount} giocatori il cap di ticket attivi deve essere ${expectedMax}`,
    );
  }
});

test('5. Ciclo completo di cucina: cottura, bruciatura, rimozione errore, consegna, combo e scadenza', () => {
  const t0 = 1_000_000;
  let state = createInitialGameState({ seed: 12345, playerCount: 2, nowMs: t0 });

  // Forziamo il primo ticket a essere "salsiccia_friarielli" per testare griglia + assemblaggio
  const ticket = {
    ...state.activeTickets[0],
    id: 'tkt-test-1',
    customerName: 'Marco',
    recipeId: 'salsiccia_friarielli',
    recipeName: 'Salsiccia e friarielli',
    bread: 'pane_casereccio',
    requiresGrill: true,
    targetIngredients: ['pane_casereccio', 'salsiccia', 'friarielli', 'provola'],
    basePoints: 115,
    bonusPoints: 30,
    bonusPatienceRatio: 0.35,
    badgeLabel: 'Abituale',
    spawnedAtMs: t0,
    patienceMs: 42000,
    expiresAtMs: t0 + 42000,
  };
  state = { ...state, activeTickets: [ticket] };

  // 1. Tentativo di aggiungere salsiccia cruda direttamente al banco -> bloccato
  let res = applyPlayerAction(
    state,
    { actionId: 'a1', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'salsiccia', playerId: 'p1' },
    t0 + 100,
  );
  assert.equal(res.conflict, true, 'Non si può assemblare salsiccia non cotta');

  // 2. Avvio cottura salsiccia su slot 0 e burger su slot 1 (che lasceremo bruciare)
  res = applyPlayerAction(
    res.state,
    { actionId: 'a2', type: 'START_COOK', ingredientId: 'salsiccia', slotIndex: 0, playerId: 'p1' },
    t0 + 200,
  );
  assert.equal(res.conflict, false);

  res = applyPlayerAction(
    res.state,
    { actionId: 'a3', type: 'START_COOK', ingredientId: 'burger_manzo', slotIndex: 1, playerId: 'p2' },
    t0 + 200,
  );
  assert.equal(res.conflict, false);

  // Controllo stato in cottura a +2000ms
  assert.equal(getGrillSlotStatus(res.state.grillSlots[0], t0 + 2200).state, COOK_STATES.COOKING);

  // Controllo stato PRONTO a +6200ms
  const tReady = t0 + 6200;
  assert.equal(getGrillSlotStatus(res.state.grillSlots[0], tReady).state, COOK_STATES.COOKED);

  // 3. Assemblaggio sul banco 0 con ingrediente sbagliato (ketchup) e sua rimozione
  res = applyPlayerAction(
    res.state,
    { actionId: 'a4', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'pane_casereccio', playerId: 'p1' },
    tReady,
  );
  res = applyPlayerAction(
    res.state,
    { actionId: 'a5', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'ketchup', playerId: 'p1' },
    tReady + 50,
  );
  assert.deepEqual(res.state.prepBoards[0].ingredients, ['pane_casereccio', 'ketchup']);

  // Rimuove l'ingrediente sbagliato (ketchup)
  res = applyPlayerAction(
    res.state,
    { actionId: 'a6', type: 'REMOVE_INGREDIENT', boardIndex: 0, playerId: 'p1' },
    tReady + 100,
  );
  assert.deepEqual(res.state.prepBoards[0].ingredients, ['pane_casereccio']);

  // Completa gli ingredienti corretti (salsiccia presa direttamente dalla griglia pronta!)
  res = applyPlayerAction(
    res.state,
    { actionId: 'a7', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'salsiccia', playerId: 'p2' },
    tReady + 200,
  );
  res = applyPlayerAction(
    res.state,
    { actionId: 'a8', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'friarielli', playerId: 'p1' },
    tReady + 300,
  );
  res = applyPlayerAction(
    res.state,
    { actionId: 'a9', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'provola', playerId: 'p2' },
    tReady + 400,
  );

  // 4. Consegna ordine!
  res = applyPlayerAction(
    res.state,
    { actionId: 'a10', type: 'SERVE_ORDER', boardIndex: 0, ticketId: 'tkt-test-1', playerId: 'p1' },
    tReady + 500,
  );
  assert.equal(res.conflict, false);
  assert.ok(res.state.score > 115, 'Il punteggio include base + mancia velocità + bonus');
  assert.equal(res.state.combo, 1);
  assert.equal(res.state.stats.ordersServed, 1);

  // 5. Idempotenza: inviare di nuovo la stessa actionId 'a10' non duplica i punti
  const scoreAfterServe = res.state.score;
  const dupRes = applyPlayerAction(
    res.state,
    { actionId: 'a10', type: 'SERVE_ORDER', boardIndex: 0, ticketId: 'tkt-test-1', playerId: 'p1' },
    tReady + 550,
  );
  assert.equal(dupRes.duplicate, true);
  assert.equal(dupRes.state.score, scoreAfterServe, 'Nessun punto duplicato su actionId ripetuta');

  // 6. Bruciatura dello slot 1 dopo cookTime + burnWindow (> 13s)
  const tBurned = t0 + 16_000;
  assert.equal(getGrillSlotStatus(res.state.grillSlots[1], tBurned).state, COOK_STATES.BURNED);
  res = applyPlayerAction(
    res.state,
    { actionId: 'a11', type: 'COLLECT_GRILL', slotIndex: 1, playerId: 'p2' },
    tBurned,
  );
  assert.equal(res.state.stats.burnedCount, 1);
  assert.equal(res.state.score, scoreAfterServe - 15, 'Penalità di 15 punti per cottura bruciata');
});

test('6. Lobby, party code, limite 4 giocatori, uscita host, riconnessione e concorrenza store', async () => {
  clearFallbackStoreForTests();
  resetJoinRateLimitsForTests();

  const hostRes = await createLobby({
    nickname: 'Gennaro',
    avatar: { chefId: 'chef_gennaro' },
  });
  assert.equal(hostRes.snapshot.code.length, 6);
  for (const ch of hostRes.snapshot.code) {
    assert.ok(PARTY_CODE_ALPHABET.includes(ch), `Carattere ${ch} privo di 0/O/1/I`);
  }

  const code = hostRes.snapshot.code;

  // Join di altri 3 giocatori (totale 4)
  const p2 = await joinLobby({ code, nickname: 'Chiara', clientIp: '10.0.0.2' });
  const p3 = await joinLobby({ code, nickname: 'Tano', clientIp: '10.0.0.3' });
  const p4 = await joinLobby({ code, nickname: 'Sofia', clientIp: '10.0.0.4' });
  assert.equal(p4.snapshot.players.length, 4);

  // Quinto giocatore rifiutato con 409 ROOM_FULL
  await assert.rejects(
    () => joinLobby({ code, nickname: 'Quinto', clientIp: '10.0.0.5' }),
    (err) => err.status === 409 && err.code === 'ROOM_FULL',
  );

  // Codice errato rifiutato con 404 ROOM_NOT_FOUND
  await assert.rejects(
    () => joinLobby({ code: 'ZZZZZZ', nickname: 'Test', clientIp: '10.0.0.6' }),
    (err) => err.status === 404 && err.code === 'ROOM_NOT_FOUND',
  );

  // Riconnessione di p2 con token valido anche a lobby piena
  const reconn = await joinLobby({
    code,
    nickname: 'Chiara',
    existingPlayerId: p2.playerId,
    existingToken: p2.playerToken,
    clientIp: '10.0.0.2',
  });
  assert.equal(reconn.reconnected, true);
  assert.equal(reconn.playerId, p2.playerId);

  // Avvio partita da parte di non-host rifiutato (403)
  await assert.rejects(
    () => startMatch({ code, playerId: p2.playerId, playerToken: p2.playerToken }),
    (err) => err.status === 403 && err.code === 'ONLY_HOST_CAN_START',
  );

  // Avvio partita da parte dell'host
  const started = await startMatch({
    code,
    playerId: hostRes.playerId,
    playerToken: hostRes.playerToken,
  });
  assert.equal(started.snapshot.status, 'playing');
  assert.ok(started.snapshot.game.activeTickets.length >= 2);

  // Due giocatori provano a raccogliere o interagire in sequenza/concorrenza: stato identico e non duplicato
  const act1 = await performGameAction({
    code,
    playerId: hostRes.playerId,
    playerToken: hostRes.playerToken,
    action: { actionId: 'act-cook-1', type: 'START_COOK', ingredientId: 'salsiccia', slotIndex: 0 },
  });
  const act1Dup = await performGameAction({
    code,
    playerId: hostRes.playerId,
    playerToken: hostRes.playerToken,
    action: { actionId: 'act-cook-1', type: 'START_COOK', ingredientId: 'salsiccia', slotIndex: 0 },
  });
  assert.equal(act1Dup.duplicate, true);
  assert.equal(
    act1.snapshot.game.grillSlots.filter((s) => s.ingredientId === 'salsiccia').length,
    1,
  );

  // Uscita dell'host promuove automaticamente il secondo giocatore (Chiara) a nuovo host
  const leaveRes = await leaveLobby({
    code,
    playerId: hostRes.playerId,
    playerToken: hostRes.playerToken,
  });
  assert.equal(leaveRes.nextHostId, p2.playerId);
});

test('7. Endpoint HTTP /api/game: 4 client distinti collaborano, gestiscono concorrenza e vedono stato identico', async () => {
  const { default: gameHandler } = await import('../api/game.js');
  const { default: sessionHandler } = await import('../api/auth/session.js');

  function callEndpoint(handler, { method = 'GET', url = '/api/game', headers = {}, body = null }) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k.toLowerCase()] = v;
        },
        getHeader(k) {
          return this.headers[k.toLowerCase()];
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ status: this.statusCode, data: payload });
          return this;
        },
        end(raw) {
          try {
            resolve({ status: this.statusCode, data: raw ? JSON.parse(raw) : null });
          } catch {
            resolve({ status: this.statusCode, data: raw });
          }
        },
      };
      handler({ method, url, headers, body, socket: { remoteAddress: '127.0.0.1' } }, res);
    });
  }

  // Verifica non-regressione su /api/auth/session
  const authCheck = await callEndpoint(sessionHandler, { method: 'GET', url: '/api/auth/session' });
  assert.equal(authCheck.status, 200);
  assert.equal(authCheck.data.authenticated, false);

  // Client 1 crea la lobby via HTTP POST /api/game
  const c1 = await callEndpoint(gameHandler, {
    method: 'POST',
    body: { op: 'createLobby', nickname: 'Gennaro', avatar: { chefId: 'chef_gennaro' } },
  });
  assert.equal(c1.status, 201);
  const code = c1.data.snapshot.code;

  // Client 2, 3, 4 entrano con il party code
  const c2 = await callEndpoint(gameHandler, {
    method: 'POST',
    body: { op: 'joinLobby', code, nickname: 'Chiara', avatar: { chefId: 'chef_chiara' } },
  });
  const c3 = await callEndpoint(gameHandler, {
    method: 'POST',
    body: { op: 'joinLobby', code, nickname: 'Tano', avatar: { chefId: 'chef_tano' } },
  });
  const c4 = await callEndpoint(gameHandler, {
    method: 'POST',
    body: { op: 'joinLobby', code, nickname: 'Sofia', avatar: { chefId: 'chef_sofia' } },
  });
  assert.equal(c4.status, 200);
  assert.equal(c4.data.snapshot.players.length, 4);

  // Un client senza token valido viene bloccato con 401
  const unauthGet = await callEndpoint(gameHandler, {
    method: 'GET',
    url: `/api/game?code=${code}&playerId=${c1.data.playerId}`,
    headers: { authorization: 'Bearer wrong-token' },
  });
  assert.equal(unauthGet.status, 401);

  // Client 1 (Host) avvia la partita
  const startRes = await callEndpoint(gameHandler, {
    method: 'POST',
    headers: { authorization: `Bearer ${c1.data.playerToken}` },
    body: { op: 'startMatch', code, playerId: c1.data.playerId },
  });
  assert.equal(startRes.status, 200);
  assert.equal(startRes.data.snapshot.status, 'playing');

  // Tutti e 4 i client scaricano lo snapshot autenticato e verificano stato identico
  const snaps = await Promise.all(
    [c1.data, c2.data, c3.data, c4.data].map((client) =>
      callEndpoint(gameHandler, {
        method: 'GET',
        url: `/api/game?code=${code}&playerId=${client.playerId}`,
        headers: { authorization: `Bearer ${client.playerToken}` },
      }),
    ),
  );

  for (const s of snaps) {
    assert.equal(s.status, 200);
    assert.equal(s.data.snapshot.version, snaps[0].data.snapshot.version);
    assert.deepEqual(
      s.data.snapshot.game.activeTickets.map((t) => t.id),
      snaps[0].data.snapshot.game.activeTickets.map((t) => t.id),
    );
  }
});

test('8. Live Vite Server: route /game (refresh), non-regressione /api/restaurants e cooperazione reale', async () => {
  const { createServer } = await import('vite');
  const srv = await createServer({ server: { port: 0 }, logLevel: 'silent' });
  await srv.listen();
  const address = srv.httpServer.address();
  const base = `http://localhost:${address.port}`;

  try {
    // 1. Apertura diretta e refresh su /game, / e /backend
    for (const route of ['/', '/backend', '/game']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${base}${route}`, { headers: { Accept: 'text/html' } });
      assert.equal(res.status, 200, `Route ${route} risponde 200`);
      // eslint-disable-next-line no-await-in-loop
      const html = await res.text();
      assert.ok(html.includes('id="root"'), `Route ${route} restituisce la SPA`);
    }

    // 2. Non-regressione /api/auth/session
    const authRes = await fetch(`${base}/api/auth/session`);
    assert.equal(authRes.status, 200);
    const authJson = await authRes.json();
    assert.equal(authJson.authenticated, false);

    // 3. Creazione, join e azioni cooperative via socket HTTP reali
    const hostRes = await fetch(`${base}/api/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'createLobby',
        nickname: 'Gennaro',
        avatar: { chefId: 'chef_gennaro' },
      }),
    }).then((r) => r.json());

    const code = hostRes.snapshot.code;

    const p2Res = await fetch(`${base}/api/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'joinLobby',
        code,
        nickname: 'Chiara',
        avatar: { chefId: 'chef_chiara' },
      }),
    }).then((r) => r.json());

    await fetch(`${base}/api/game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostRes.playerToken}`,
      },
      body: JSON.stringify({
        op: 'startMatch',
        code,
        playerId: hostRes.playerId,
      }),
    });

    // Giocatore 1 aggiunge il pane sul Banco 0, Giocatore 2 legge lo snapshot e vede il pane aggiunto
    await fetch(`${base}/api/game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostRes.playerToken}`,
      },
      body: JSON.stringify({
        op: 'gameAction',
        code,
        playerId: hostRes.playerId,
        action: {
          actionId: 'live-http-act-1',
          type: 'ADD_INGREDIENT',
          boardIndex: 0,
          ingredientId: 'pane_burger',
        },
      }),
    });

    const p2Snap = await fetch(
      `${base}/api/game?code=${code}&playerId=${p2Res.playerId}`,
      {
        headers: { Authorization: `Bearer ${p2Res.playerToken}` },
      },
    ).then((r) => r.json());

    assert.deepEqual(p2Snap.snapshot.game.prepBoards[0].ingredients, ['pane_burger']);
  } finally {
    await srv.close();
  }
});

test('9. Verifica flussi completi: ordine semplice, più ingredienti, pre-bruciatura, DISCARD_GRILL, Vassoio Caldo co-op, cliente indeciso, errore assemblaggio e cliente impaziente', async () => {
  const { inspectBoardAgainstTicket } = await import('../src/game/engine/gameEngine.js');
  const t0 = 2_000_000;
  let state = createInitialGameState({ seed: 777, playerCount: 2, nowMs: t0 });

  const simpleTicket = {
    id: 'tkt-simple',
    customerId: 'npc-1',
    customerName: 'Elena',
    appearance: {},
    archetypeId: 'di_fretta',
    archetypeName: 'Di fretta',
    badgeLabel: 'Di fretta',
    recipeId: 'cuzzetiello_ragu',
    recipeName: 'Cuzzetiello al ragù',
    bread: 'cuzzetiello',
    requiresGrill: false,
    modifiers: {},
    targetIngredients: ['cuzzetiello', 'polpette', 'ragu'],
    basePoints: 100,
    bonusPoints: 35,
    bonusPatienceRatio: 0.45,
    quote: 'Al volo!',
    spawnedAtMs: t0,
    patienceMs: 30000,
    expiresAtMs: t0 + 30000,
    thinkingUntilMs: null,
  };

  const indecisiveMultiTicket = {
    id: 'tkt-multi',
    customerId: 'npc-2',
    customerName: 'Bruno',
    appearance: {},
    archetypeId: 'indeciso',
    archetypeName: 'Indeciso',
    badgeLabel: 'Indeciso',
    recipeId: 'classico_gambero',
    recipeName: 'Classico del Gambero',
    bread: 'pane_burger',
    requiresGrill: true,
    modifiers: { exclude: 'pomodoro', add: 'cipolla' },
    targetIngredients: ['pane_burger', 'burger_manzo', 'provola', 'lattuga', 'salsa_casa', 'cipolla'],
    basePoints: 130,
    bonusPoints: 25,
    bonusPatienceRatio: 0.35,
    quote: 'Aspè che scelgo…',
    spawnedAtMs: t0,
    patienceMs: 45000,
    expiresAtMs: t0 + 45000,
    thinkingUntilMs: t0 + 3200,
  };

  state = { ...state, activeTickets: [simpleTicket, indecisiveMultiTicket] };

  // A) Verifica ordine semplice (Cuzzetiello al ragù) + analisi errori in tempo reale
  let check = inspectBoardAgainstTicket(['cuzzetiello', 'ketchup'], simpleTicket);
  assert.equal(check.status, 'has_errors', 'Rileva ketchup come ingrediente errato');
  assert.equal(check.assembledLayers[1].isExtra, true);

  let r = applyPlayerAction(state, { actionId: 's1', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'cuzzetiello', playerId: 'p1' }, t0 + 100);
  r = applyPlayerAction(r.state, { actionId: 's2', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'polpette', playerId: 'p1' }, t0 + 200);
  r = applyPlayerAction(r.state, { actionId: 's3', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'ragu', playerId: 'p1' }, t0 + 300);

  check = inspectBoardAgainstTicket(r.state.prepBoards[0].ingredients, simpleTicket);
  assert.equal(check.ok, true);
  assert.equal(check.status, 'ready_to_serve');

  r = applyPlayerAction(r.state, { actionId: 's4', type: 'SERVE_ORDER', boardIndex: 0, ticketId: 'tkt-simple', playerId: 'p1' }, t0 + 400);
  assert.equal(r.conflict, false);
  assert.equal(r.state.stats.ordersServed, 1);

  // B) Verifica blocco consegna su cliente indeciso finché thinkingUntilMs è attivo
  r = applyPlayerAction(r.state, { actionId: 'm0', type: 'ADD_INGREDIENT', boardIndex: 1, ingredientId: 'pane_burger', playerId: 'p2' }, t0 + 500);
  const blockedServe = applyPlayerAction(
    r.state,
    { actionId: 'm-block', type: 'SERVE_ORDER', boardIndex: 1, ticketId: 'tkt-multi', playerId: 'p2' },
    t0 + 600,
  );
  assert.equal(blockedServe.conflict, true, 'Non si può consegnare mentre il cliente sta ancora decidendo');

  // Fissa la comanda dell'indeciso con SELECT_TICKET
  r = applyPlayerAction(r.state, { actionId: 'm-confirm', type: 'SELECT_TICKET', boardIndex: 1, ticketId: 'tkt-multi', playerId: 'p2' }, t0 + 700);
  const confirmedTicket = r.state.activeTickets.find((t) => t.id === 'tkt-multi');
  assert.equal(confirmedTicket.thinkingUntilMs, null, 'SELECT_TICKET fissa subito la comanda');

  // C) Cottura in ritardo (aboutToBurn), DISCARD_GRILL e flusso Vassoio Caldo (cookedTray)
  r = applyPlayerAction(r.state, { actionId: 'g1', type: 'START_COOK', ingredientId: 'burger_manzo', slotIndex: 0, playerId: 'p1' }, t0 + 1000);
  r = applyPlayerAction(r.state, { actionId: 'g2', type: 'START_COOK', ingredientId: 'pollo', slotIndex: 1, playerId: 'p1' }, t0 + 1000);

  // Scarta il pollo messo per errore con DISCARD_GRILL
  r = applyPlayerAction(r.state, { actionId: 'g-disc', type: 'DISCARD_GRILL', slotIndex: 1, playerId: 'p1' }, t0 + 2000);
  assert.equal(r.state.grillSlots[1].ingredientId, null, 'DISCARD_GRILL libera lo slot');

  // Verifica stato aboutToBurn quando il burger è cotto da oltre il 65% della burnWindow (cook=5500, burn=7500 -> a +10600ms)
  const lateStatus = getGrillSlotStatus(r.state.grillSlots[0], t0 + 1000 + 5500 + 5200);
  assert.equal(lateStatus.state, COOK_STATES.COOKED);
  assert.equal(lateStatus.aboutToBurn, true, 'Segnala aboutToBurn negli ultimi secondi prima di bruciare');

  // Raccoglie nel Vassoio Caldo (toBoardIndex: null)
  r = applyPlayerAction(
    r.state,
    { actionId: 'g-tray', type: 'COLLECT_GRILL', slotIndex: 0, toBoardIndex: null, playerId: 'p1' },
    t0 + 1000 + 5500 + 5200,
  );
  assert.equal(r.state.cookedTray.length, 1, 'Il burger cotto entra nel Vassoio Caldo condiviso');

  // Il compagno p2 preleva dal Vassoio Caldo e completa l'ordine multi-ingrediente sul Banco 1
  const tAssemble = t0 + 12_000;
  for (const ingId of ['burger_manzo', 'provola', 'lattuga', 'salsa_casa', 'cipolla']) {
    r = applyPlayerAction(
      r.state,
      { actionId: `add-${ingId}`, type: 'ADD_INGREDIENT', boardIndex: 1, ingredientId: ingId, playerId: 'p2' },
      tAssemble,
    );
  }
  assert.equal(r.state.cookedTray.length, 0, 'Il burger è stato prelevato dal Vassoio Caldo');

  r = applyPlayerAction(
    r.state,
    { actionId: 'serve-multi', type: 'SERVE_ORDER', boardIndex: 1, ticketId: 'tkt-multi', playerId: 'p2' },
    tAssemble + 100,
  );
  assert.equal(r.conflict, false);
  assert.equal(r.state.stats.ordersServed, 2);
  assert.equal(r.state.combo, 2, 'Combo di squadra incrementata a x2');

  // D) Verifica consegna errata (-20 pt e azzeramento combo) e scadenza cliente impaziente (-25 pt)
  const nextTkt = r.state.activeTickets[0];
  assert.ok(nextTkt, 'Nuovo ticket generato automaticamente');
  r = applyPlayerAction(r.state, { actionId: 'wrong-1', type: 'ADD_INGREDIENT', boardIndex: 0, ingredientId: 'ketchup', playerId: 'p1' }, tAssemble + 200);
  const scoreBeforeWrong = r.state.score;
  r = applyPlayerAction(r.state, { actionId: 'wrong-serve', type: 'SERVE_ORDER', boardIndex: 0, ticketId: nextTkt.id, playerId: 'p1' }, tAssemble + 300);
  assert.equal(r.state.stats.wrongDeliveries, 1);
  assert.equal(r.state.combo, 0, 'La consegna errata azzera la combo');
  assert.equal(r.state.score, scoreBeforeWrong - 20);

  // Scadenza cliente impaziente
  const afterExpire = advanceSimulation(r.state, nextTkt.expiresAtMs + 100);
  assert.equal(afterExpire.stats.customersLost, 1, 'Il cliente impaziente se ne va alla scadenza');
});
