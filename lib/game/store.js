/**
 * Store autorevole lato server per "Il Banco del Gambero" (Lobby + Partita Co-Op).
 *
 * Architettura di persistenza:
 * 1. Driver primario: tabelle Postgres `public.game_rooms` e `public.game_players`
 *    su Supabase (definite in `supabase/migrations/20261017000100_gambero_moscio_game.sql`),
 *    con controllo di concorrenza Compare-And-Swap (CAS) sulla colonna `version`.
 * 2. Fallback automatico (sviluppo / preview prima dell'esecuzione della migrazione SQL):
 *    se `public.game_rooms` restituisce `PGRST205` (tabella non ancora migrata) o le
 *    variabili Supabase non sono presenti in ambiente di test, usa uno store transazionale
 *    CAS identico su file temporaneo (`os.tmpdir()`), mantenendo invariati tutti i controlli
 *    di sicurezza (token SHA-256, rate limit, CAS version, TTL cleanup).
 * 3. Segnale Realtime: a ogni mutazione invia un segnale leggero (senza stato sensibile)
 *    sul `realtime_topic` non prevedibile della stanza via REST API di Supabase Realtime.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomInt as cryptoRandomInt } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizePlayerAvatar } from '../../src/game/data/characters.js';
import {
  advanceSimulation,
  applyPlayerAction,
  createInitialGameState,
} from '../../src/game/engine/gameEngine.js';

export const PARTY_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // senza 0/O e 1/I
export const PARTY_CODE_LENGTH = 6;
export const MAX_PLAYERS_PER_ROOM = 4;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 ore
export const PLAYER_ONLINE_TIMEOUT_MS = 25_000; // 25s
export const CAS_MAX_RETRIES = 5;

// Rate limit tentativi di join per IP (anti brute-force sui party code)
const JOIN_RATE_WINDOW_MS = 60_000;
const JOIN_MAX_ATTEMPTS_PER_WINDOW = 14;
const joinAttemptsByIp = new Map();

const FALLBACK_FILE = path.join(os.tmpdir(), 'pndr-gambero-moscio-game-store.json');

export class GameHttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GameHttpError';
    this.status = status;
    this.code = code;
  }
}

let supabaseClient = null;
let postgresTablesAvailable = null; // null = da verificare, true = ok, false = PGRST205

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}

export function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export function generatePartyCode() {
  let code = '';
  for (let i = 0; i < PARTY_CODE_LENGTH; i += 1) {
    const idx = cryptoRandomInt(0, PARTY_CODE_ALPHABET.length);
    code += PARTY_CODE_ALPHABET[idx];
  }
  return code;
}

export function generateSecretToken() {
  return randomBytes(24).toString('hex');
}

export function generateRealtimeTopic() {
  return `gm-room-${randomBytes(18).toString('hex')}`;
}

export function validateNickname(raw) {
  if (typeof raw !== 'string') {
    throw new GameHttpError(400, 'INVALID_NICKNAME', 'Inserisci un nickname valido (2–16 caratteri).');
  }
  const cleaned = raw.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > 16) {
    throw new GameHttpError(400, 'INVALID_NICKNAME', 'Il nickname deve avere tra 2 e 16 caratteri.');
  }
  return cleaned;
}

export function normalizePartyCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, '')
    .slice(0, PARTY_CODE_LENGTH);
}

export function checkJoinRateLimit(clientKey = 'local', nowMs = Date.now()) {
  const key = String(clientKey || 'local');
  const record = joinAttemptsByIp.get(key);
  if (!record || nowMs - record.windowStartMs > JOIN_RATE_WINDOW_MS) {
    joinAttemptsByIp.set(key, { windowStartMs: nowMs, count: 1 });
    return;
  }
  record.count += 1;
  if (record.count > JOIN_MAX_ATTEMPTS_PER_WINDOW) {
    throw new GameHttpError(
      429,
      'RATE_LIMITED',
      'Troppi tentativi ravvicinati. Attendi qualche secondo prima di riprovare.',
    );
  }
}

export function resetJoinRateLimitsForTests() {
  joinAttemptsByIp.clear();
}

/**
 * Invia un segnale Realtime non autorevole sul topic segreto della stanza.
 * I client iscritti usano il segnale solo per richiedere uno snapshot autenticato.
 */
async function broadcastRoomWakeup(realtimeTopic, version, event = 'room_updated') {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !realtimeTopic) return;
  try {
    await fetch(`${url.replace(/\/+$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: realtimeTopic,
            event,
            payload: { version, atMs: Date.now() },
          },
        ],
      }),
    });
  } catch {
    // Il segnale Realtime è un acceleratore: se fallisce, il client sincronizza via snapshot
  }
}

// ---------------------------------------------------------------------------
// Driver di storage (Postgres `game_rooms` + `game_players` con fallback CAS
// cloud su bucket privato Supabase `game-rooms` o file locale in test)
// ---------------------------------------------------------------------------

const GAME_STORAGE_BUCKET = 'game-rooms';
const GAME_STORAGE_PREFIX = 'snapshots';
let storageBucketEnsured = false;
let snapshotSeq = 0;

async function ensureGameStorageBucket(sb) {
  if (storageBucketEnsured || !sb) return;
  try {
    await sb.storage.createBucket(GAME_STORAGE_BUCKET, { public: false });
  } catch {
    // Il bucket esiste già o verrà gestito al prossimo tentativo
  }
  storageBucketEnsured = true;
}

function readLocalFallbackFile() {
  try {
    if (!fs.existsSync(FALLBACK_FILE)) {
      return { rooms: {}, players: {} };
    }
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      rooms: parsed?.rooms && typeof parsed.rooms === 'object' ? parsed.rooms : {},
      players: parsed?.players && typeof parsed.players === 'object' ? parsed.players : {},
    };
  } catch {
    return { rooms: {}, players: {} };
  }
}

function writeLocalFallbackFile(store) {
  try {
    const tmp = `${FALLBACK_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
    fs.renameSync(tmp, FALLBACK_FILE);
  } catch {
    // Fallback best-effort su ambienti read-only
  }
}

async function readFallbackStore() {
  // In ambiente di test locale usiamo sempre il file CAS locale per isolamento
  if (process.env.NODE_ENV === 'test' || process.env.GAMBERO_FORCE_LOCAL_STORE === '1') {
    return readLocalFallbackFile();
  }
  const sb = getSupabase();
  if (sb) {
    try {
      await ensureGameStorageBucket(sb);
      const { data: files, error: listErr } = await sb.storage
        .from(GAME_STORAGE_BUCKET)
        .list(GAME_STORAGE_PREFIX, {
          limit: 5,
          sortBy: { column: 'name', order: 'desc' },
        });
      if (!listErr && Array.isArray(files)) {
        const validFiles = files.filter((f) => f.name && f.name.endsWith('.json'));
        if (validFiles.length === 0) {
          return { rooms: {}, players: {} };
        }
        const latestName = validFiles[0].name;
        const { data, error } = await sb.storage
          .from(GAME_STORAGE_BUCKET)
          .download(`${GAME_STORAGE_PREFIX}/${latestName}`);
        if (!error && data) {
          const text = await data.text();
          const parsed = JSON.parse(text);
          return {
            rooms: parsed?.rooms && typeof parsed.rooms === 'object' ? parsed.rooms : {},
            players: parsed?.players && typeof parsed.players === 'object' ? parsed.players : {},
          };
        }
      }
    } catch {
      // Fallback al file locale se lo storage non è raggiungibile
    }
  }
  return readLocalFallbackFile();
}

async function writeFallbackStore(store) {
  writeLocalFallbackFile(store);
  if (process.env.NODE_ENV === 'test' || process.env.GAMBERO_FORCE_LOCAL_STORE === '1') {
    return;
  }
  const sb = getSupabase();
  if (sb) {
    try {
      await ensureGameStorageBucket(sb);
      snapshotSeq = (snapshotSeq + 1) % 100000;
      const ts = String(Date.now()).padStart(14, '0');
      const seq = String(snapshotSeq).padStart(5, '0');
      const rnd = randomBytes(3).toString('hex');
      const objectPath = `${GAME_STORAGE_PREFIX}/s-${ts}-${seq}-${rnd}.json`;

      await sb.storage
        .from(GAME_STORAGE_BUCKET)
        .upload(objectPath, JSON.stringify(store), {
          upsert: false,
          contentType: 'application/json',
          cacheControl: '0',
        });

      // Pulizia best-effort degli snapshot più vecchi (mantiene gli ultimi 3 per letture concorrenti)
      const { data: files } = await sb.storage
        .from(GAME_STORAGE_BUCKET)
        .list(GAME_STORAGE_PREFIX, {
          limit: 30,
          sortBy: { column: 'name', order: 'desc' },
        });
      if (Array.isArray(files) && files.length > 3) {
        const stalePaths = files
          .slice(3)
          .filter((f) => f.name && f.name.endsWith('.json'))
          .map((f) => `${GAME_STORAGE_PREFIX}/${f.name}`);
        if (stalePaths.length > 0) {
          await sb.storage.from(GAME_STORAGE_BUCKET).remove(stalePaths);
        }
      }
    } catch {
      // Fallback best-effort
    }
  }
}

export function clearFallbackStoreForTests() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) fs.unlinkSync(FALLBACK_FILE);
  } catch {
    // ignore
  }
}

async function isPostgresReady() {
  const sb = getSupabase();
  if (!sb) return false;
  if (postgresTablesAvailable !== null) return postgresTablesAvailable;

  const { error } = await sb.from('game_rooms').select('id').limit(1);
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
    postgresTablesAvailable = false;
    return false;
  }
  if (error) {
    postgresTablesAvailable = false;
    return false;
  }
  postgresTablesAvailable = true;
  return true;
}

async function cleanupExpiredRooms(nowMs = Date.now()) {
  const nowIso = new Date(nowMs).toISOString();
  if (await isPostgresReady()) {
    const sb = getSupabase();
    await sb.from('game_rooms').delete().lt('expires_at', nowIso);
    return;
  }
  const store = await readFallbackStore();
  let changed = false;
  for (const [roomId, room] of Object.entries(store.rooms)) {
    if (new Date(room.expires_at).getTime() < nowMs) {
      delete store.rooms[roomId];
      for (const [pid, p] of Object.entries(store.players)) {
        if (p.room_id === roomId) delete store.players[pid];
      }
      changed = true;
    }
  }
  if (changed) await writeFallbackStore(store);
}

async function fetchRoomByCode(code) {
  const cleanCode = normalizePartyCode(code);
  if (!cleanCode) return null;

  if (await isPostgresReady()) {
    const sb = getSupabase();
    const { data: room, error } = await sb
      .from('game_rooms')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();
    if (error || !room) return null;
    const { data: players } = await sb
      .from('game_players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true });
    return { room, players: players || [], storageBackend: 'supabase-postgres' };
  }

  const store = await readFallbackStore();
  const room = Object.values(store.rooms).find((r) => r.code === cleanCode) || null;
  if (!room) return null;
  const players = Object.values(store.players)
    .filter((p) => p.room_id === room.id)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  return {
    room: structuredClone(room),
    players: structuredClone(players),
    storageBackend: getSupabase() ? 'supabase-cloud-cas' : 'local-cas-fallback',
  };
}

async function insertRoomAndHost(roomRow, hostRow) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    const { error: rErr } = await sb.from('game_rooms').insert(roomRow);
    if (rErr) return { ok: false, error: rErr };
    const { error: pErr } = await sb.from('game_players').insert(hostRow);
    if (pErr) {
      await sb.from('game_rooms').delete().eq('id', roomRow.id);
      return { ok: false, error: pErr };
    }
    return { ok: true };
  }

  const store = await readFallbackStore();
  if (Object.values(store.rooms).some((r) => r.code === roomRow.code)) {
    return { ok: false, error: { code: '23505' } };
  }
  store.rooms[roomRow.id] = structuredClone(roomRow);
  store.players[hostRow.id] = structuredClone(hostRow);
  await writeFallbackStore(store);
  return { ok: true };
}

async function casUpdateRoom(roomId, expectedVersion, roomPatch) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('game_rooms')
      .update({
        ...roomPatch,
        version: expectedVersion + 1,
      })
      .eq('id', roomId)
      .eq('version', expectedVersion)
      .select('id, version');
    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  }

  const store = await readFallbackStore();
  const current = store.rooms[roomId];
  if (!current || current.version !== expectedVersion) return false;
  store.rooms[roomId] = {
    ...current,
    ...structuredClone(roomPatch),
    version: expectedVersion + 1,
  };
  await writeFallbackStore(store);
  return true;
}

async function upsertPlayerRow(playerRow) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    const { error } = await sb.from('game_players').upsert(playerRow, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    return;
  }
  const store = await readFallbackStore();
  store.players[playerRow.id] = structuredClone(playerRow);
  await writeFallbackStore(store);
}

async function updatePlayerRow(playerId, patch) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    const { error } = await sb.from('game_players').update(patch).eq('id', playerId);
    if (error) throw new Error(error.message);
    return;
  }
  const store = await readFallbackStore();
  if (store.players[playerId]) {
    store.players[playerId] = { ...store.players[playerId], ...structuredClone(patch) };
    await writeFallbackStore(store);
  }
}

async function deletePlayerRow(playerId) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    await sb.from('game_players').delete().eq('id', playerId);
    return;
  }
  const store = await readFallbackStore();
  delete store.players[playerId];
  await writeFallbackStore(store);
}

async function deleteRoomRow(roomId) {
  if (await isPostgresReady()) {
    const sb = getSupabase();
    await sb.from('game_rooms').delete().eq('id', roomId);
    return;
  }
  const store = await readFallbackStore();
  delete store.rooms[roomId];
  for (const [pid, p] of Object.entries(store.players)) {
    if (p.room_id === roomId) delete store.players[pid];
  }
  await writeFallbackStore(store);
}

// ---------------------------------------------------------------------------
// Costruzione snapshot sicuro per il client (senza token_hash altrui o seed interni)
// ---------------------------------------------------------------------------

function buildPublicRoomSnapshot({ room, players, viewerPlayerId, nowMs = Date.now(), storageBackend }) {
  const gameState = room.game_state || {};
  const playerStats = gameState.playerStats || {};

  const publicPlayers = players.map((p) => {
    const lastSeenMs = new Date(p.last_seen_at).getTime();
    const isOnline = Boolean(p.connected) && nowMs - lastSeenMs <= PLAYER_ONLINE_TIMEOUT_MS;
    const stats = playerStats[p.id] || p.contributions || {
      ordersServed: 0,
      ingredientsCooked: 0,
      ingredientsAssembled: 0,
      mistakes: 0,
    };
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isHost: p.id === room.host_player_id,
      isReady: Boolean(p.is_ready),
      isOnline,
      lastSeenAt: p.last_seen_at,
      contributions: stats,
    };
  });

  // Se la partita è in corso o terminata, esponi lo stato cucina sincronizzato al tempo server
  let publicGameState = null;
  if (room.status === 'playing' || room.status === 'finished') {
    publicGameState = {
      startedAtMs: gameState.startedAtMs,
      endsAtMs: gameState.endsAtMs,
      serverNowMs: nowMs,
      remainingMs: Math.max(0, (gameState.endsAtMs || nowMs) - nowMs),
      playerCount: gameState.playerCount || players.length,
      activeTickets: gameState.activeTickets || [],
      grillSlots: gameState.grillSlots || [],
      cookedTray: gameState.cookedTray || [],
      prepBoards: gameState.prepBoards || [],
      score: gameState.score || 0,
      combo: gameState.combo || 0,
      maxCombo: gameState.maxCombo || 0,
      stats: gameState.stats || {
        ordersServed: 0,
        wrongDeliveries: 0,
        customersLost: 0,
        burnedCount: 0,
        tipsEarned: 0,
        comboBonusEarned: 0,
      },
      scoreEvents: gameState.scoreEvents || [],
    };
  }

  return {
    roomId: room.id,
    code: room.code,
    status: room.status,
    hostPlayerId: room.host_player_id,
    viewerPlayerId,
    version: room.version,
    serverNowMs: nowMs,
    updatedAt: room.updated_at,
    expiresAt: room.expires_at,
    realtimeTopic: room.realtime_topic,
    realtimeConfig: {
      supabaseUrl: process.env.SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null,
    },
    storageBackend,
    players: publicPlayers,
    game: publicGameState,
  };
}

function authenticatePlayer(players, playerId, rawToken) {
  if (!playerId || !rawToken) {
    throw new GameHttpError(401, 'UNAUTHORIZED', 'Sessione giocatore mancante o non valida.');
  }
  const player = players.find((p) => p.id === playerId);
  if (!player) {
    throw new GameHttpError(401, 'PLAYER_NOT_IN_ROOM', 'Non fai parte di questa lobby.');
  }
  const expectedHash = hashToken(rawToken);
  if (player.token_hash !== expectedHash) {
    throw new GameHttpError(401, 'INVALID_TOKEN', 'Token di sessione non valido.');
  }
  return player;
}

// ---------------------------------------------------------------------------
// API ad alto livello per le operazioni su Lobby e Partita
// ---------------------------------------------------------------------------

export async function createLobby({ nickname, avatar, nowMs = Date.now() }) {
  await cleanupExpiredRooms(nowMs);
  const cleanName = validateNickname(nickname);
  const cleanAvatar = normalizePlayerAvatar(avatar);

  const playerId = `plr-${randomBytes(8).toString('hex')}`;
  const playerToken = generateSecretToken();
  const tokenHash = hashToken(playerToken);
  const nowIso = new Date(nowMs).toISOString();
  const expiresIso = new Date(nowMs + ROOM_TTL_MS).toISOString();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roomId = randomBytes(16).toString('hex').replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
      '$1-$2-$3-$4-$5',
    );
    const code = generatePartyCode();
    const realtimeTopic = generateRealtimeTopic();
    const seed = cryptoRandomInt(10_000, 2_147_483_000);

    const roomRow = {
      id: roomId,
      code,
      status: 'lobby',
      host_player_id: playerId,
      seed,
      version: 1,
      realtime_topic: realtimeTopic,
      game_state: {},
      created_at: nowIso,
      updated_at: nowIso,
      started_at: null,
      finished_at: null,
      expires_at: expiresIso,
    };

    const hostRow = {
      id: playerId,
      room_id: roomId,
      nickname: cleanName,
      avatar: cleanAvatar,
      token_hash: tokenHash,
      is_host: true,
      is_ready: true,
      connected: true,
      contributions: { ordersServed: 0, ingredientsCooked: 0, ingredientsAssembled: 0, mistakes: 0 },
      joined_at: nowIso,
      last_seen_at: nowIso,
    };

    // eslint-disable-next-line no-await-in-loop
    const res = await insertRoomAndHost(roomRow, hostRow);
    if (res.ok) {
      // eslint-disable-next-line no-await-in-loop
      const fetched = await fetchRoomByCode(code);
      return {
        playerId,
        playerToken,
        snapshot: buildPublicRoomSnapshot({
          room: fetched.room,
          players: fetched.players,
          viewerPlayerId: playerId,
          nowMs,
          storageBackend: fetched.storageBackend,
        }),
      };
    }
  }

  throw new GameHttpError(500, 'CREATE_FAILED', 'Impossibile generare una nuova lobby. Riprova.');
}

export async function joinLobby({
  code,
  nickname,
  avatar,
  existingPlayerId = null,
  existingToken = null,
  clientIp = 'local',
  nowMs = Date.now(),
}) {
  checkJoinRateLimit(clientIp, nowMs);
  await cleanupExpiredRooms(nowMs);

  const cleanCode = normalizePartyCode(code);
  if (cleanCode.length !== PARTY_CODE_LENGTH) {
    throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Codice partita non valido. Controlla le 6 lettere/cifre.');
  }

  const fetched = await fetchRoomByCode(cleanCode);
  if (!fetched) {
    throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Lobby non trovata o scaduta.');
  }

  const { room, players, storageBackend } = fetched;
  if (new Date(room.expires_at).getTime() < nowMs || room.status === 'expired') {
    await deleteRoomRow(room.id);
    throw new GameHttpError(410, 'ROOM_EXPIRED', 'Questa sessione è scaduta.');
  }

  const nowIso = new Date(nowMs).toISOString();

  // Caso 1: Riconnessione di un giocatore già membro della lobby/partita
  if (existingPlayerId && existingToken) {
    const existing = players.find((p) => p.id === existingPlayerId);
    if (existing && existing.token_hash === hashToken(existingToken)) {
      const cleanName = nickname ? validateNickname(nickname) : existing.nickname;
      const cleanAvatar = avatar ? normalizePlayerAvatar(avatar) : existing.avatar;
      await updatePlayerRow(existing.id, {
        nickname: cleanName,
        avatar: cleanAvatar,
        connected: true,
        last_seen_at: nowIso,
      });
      await casUpdateRoom(room.id, room.version, { updated_at: nowIso });
      const updated = await fetchRoomByCode(cleanCode);
      await broadcastRoomWakeup(room.realtime_topic, updated.room.version, 'player_reconnected');
      return {
        playerId: existing.id,
        playerToken: existingToken,
        reconnected: true,
        snapshot: buildPublicRoomSnapshot({
          room: updated.room,
          players: updated.players,
          viewerPlayerId: existing.id,
          nowMs,
          storageBackend: updated.storageBackend,
        }),
      };
    }
  }

  // Caso 2: Nuovo partecipante
  const cleanName = validateNickname(nickname);
  const cleanAvatar = normalizePlayerAvatar(avatar);

  if (players.length >= MAX_PLAYERS_PER_ROOM) {
    throw new GameHttpError(409, 'ROOM_FULL', 'La lobby è piena (massimo 4 giocatori).');
  }

  if (room.status !== 'lobby') {
    throw new GameHttpError(
      409,
      'MATCH_ALREADY_STARTED',
      'La partita è già iniziata. Attendi il prossimo turno della squadra.',
    );
  }

  const playerId = `plr-${randomBytes(8).toString('hex')}`;
  const playerToken = generateSecretToken();
  const tokenHash = hashToken(playerToken);

  const playerRow = {
    id: playerId,
    room_id: room.id,
    nickname: cleanName,
    avatar: cleanAvatar,
    token_hash: tokenHash,
    is_host: false,
    is_ready: true,
    connected: true,
    contributions: { ordersServed: 0, ingredientsCooked: 0, ingredientsAssembled: 0, mistakes: 0 },
    joined_at: nowIso,
    last_seen_at: nowIso,
  };

  await upsertPlayerRow(playerRow);
  await casUpdateRoom(room.id, room.version, {
    updated_at: nowIso,
    expires_at: new Date(nowMs + ROOM_TTL_MS).toISOString(),
  });

  const updated = await fetchRoomByCode(cleanCode);
  await broadcastRoomWakeup(room.realtime_topic, updated.room.version, 'player_joined');

  return {
    playerId,
    playerToken,
    reconnected: false,
    snapshot: buildPublicRoomSnapshot({
      room: updated.room,
      players: updated.players,
      viewerPlayerId: playerId,
      nowMs,
      storageBackend,
    }),
  };
}

export async function getRoomSnapshot({ code, playerId, playerToken, nowMs = Date.now() }) {
  const fetched = await fetchRoomByCode(code);
  if (!fetched) {
    throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Lobby non trovata o sessione scaduta.');
  }

  const { room, players, storageBackend } = fetched;
  if (new Date(room.expires_at).getTime() < nowMs || room.status === 'expired') {
    await deleteRoomRow(room.id);
    throw new GameHttpError(410, 'ROOM_EXPIRED', 'La sessione della lobby è scaduta.');
  }

  authenticatePlayer(players, playerId, playerToken);
  const nowIso = new Date(nowMs).toISOString();

  // Aggiorna heartbeat presenza del giocatore
  await updatePlayerRow(playerId, {
    connected: true,
    last_seen_at: nowIso,
  });

  // Se la partita è in corso, fai avanzare in modo deterministico il timer/ordini
  let currentRoom = room;
  if (room.status === 'playing' && room.game_state?.startedAtMs) {
    const advancedState = advanceSimulation(room.game_state, nowMs);
    const hasFinished = nowMs >= advancedState.endsAtMs;
    const stateChanged =
      hasFinished ||
      advancedState.activeTickets.length !== (room.game_state.activeTickets || []).length ||
      advancedState.score !== room.game_state.score ||
      advancedState.nextTicketSeq !== room.game_state.nextTicketSeq;

    if (stateChanged) {
      const patch = {
        game_state: advancedState,
        status: hasFinished ? 'finished' : 'playing',
        finished_at: hasFinished ? nowIso : null,
        updated_at: nowIso,
      };
      const updatedOk = await casUpdateRoom(room.id, room.version, patch);
      if (updatedOk) {
        currentRoom = { ...room, ...patch, version: room.version + 1 };
      } else {
        const refetched = await fetchRoomByCode(code);
        if (refetched) currentRoom = refetched.room;
      }
    } else {
      currentRoom = { ...room, game_state: advancedState };
    }
  }

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, connected: true, last_seen_at: nowIso } : p,
  );

  return {
    snapshot: buildPublicRoomSnapshot({
      room: currentRoom,
      players: updatedPlayers,
      viewerPlayerId: playerId,
      nowMs,
      storageBackend,
    }),
  };
}

export async function updateLobbyPlayer({
  code,
  playerId,
  playerToken,
  isReady,
  nickname,
  avatar,
  nowMs = Date.now(),
}) {
  const fetched = await fetchRoomByCode(code);
  if (!fetched) {
    throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Lobby non trovata.');
  }
  const { room, players } = fetched;
  const player = authenticatePlayer(players, playerId, playerToken);

  const nowIso = new Date(nowMs).toISOString();
  const patch = {
    connected: true,
    last_seen_at: nowIso,
  };
  if (typeof isReady === 'boolean') patch.is_ready = isReady;
  if (typeof nickname === 'string' && nickname.trim()) patch.nickname = validateNickname(nickname);
  if (avatar && typeof avatar === 'object') patch.avatar = normalizePlayerAvatar(avatar);

  await updatePlayerRow(player.id, patch);
  await casUpdateRoom(room.id, room.version, { updated_at: nowIso });

  const updated = await fetchRoomByCode(code);
  await broadcastRoomWakeup(room.realtime_topic, updated.room.version, 'player_updated');

  return {
    snapshot: buildPublicRoomSnapshot({
      room: updated.room,
      players: updated.players,
      viewerPlayerId: playerId,
      nowMs,
      storageBackend: updated.storageBackend,
    }),
  };
}

export async function startMatch({ code, playerId, playerToken, nowMs = Date.now() }) {
  for (let attempt = 0; attempt < CAS_MAX_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const fetched = await fetchRoomByCode(code);
    if (!fetched) throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Lobby non trovata.');

    const { room, players } = fetched;
    authenticatePlayer(players, playerId, playerToken);

    if (room.host_player_id !== playerId) {
      throw new GameHttpError(403, 'ONLY_HOST_CAN_START', 'Solo l’host può avviare la partita.');
    }

    if (players.length < 1 || players.length > MAX_PLAYERS_PER_ROOM) {
      throw new GameHttpError(400, 'INVALID_PLAYER_COUNT', 'Servono da 1 a 4 giocatori.');
    }

    const nextSeed = cryptoRandomInt(10_000, 2_147_483_000);
    const initialState = createInitialGameState({
      seed: nextSeed,
      playerCount: players.length,
      nowMs,
    });
    const nowIso = new Date(nowMs).toISOString();

    const patch = {
      status: 'playing',
      seed: nextSeed,
      game_state: initialState,
      started_at: nowIso,
      finished_at: null,
      updated_at: nowIso,
      expires_at: new Date(nowMs + ROOM_TTL_MS).toISOString(),
    };

    // eslint-disable-next-line no-await-in-loop
    const ok = await casUpdateRoom(room.id, room.version, patch);
    if (ok) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await fetchRoomByCode(code);
      // eslint-disable-next-line no-await-in-loop
      await broadcastRoomWakeup(room.realtime_topic, updated.room.version, 'match_started');
      return {
        snapshot: buildPublicRoomSnapshot({
          room: updated.room,
          players: updated.players,
          viewerPlayerId: playerId,
          nowMs,
          storageBackend: updated.storageBackend,
        }),
      };
    }
  }

  throw new GameHttpError(409, 'CONCURRENT_CONFLICT', 'Conflitto di avvio. Riprova.');
}

export async function performGameAction({
  code,
  playerId,
  playerToken,
  action,
  nowMs = Date.now(),
}) {
  if (!action || typeof action !== 'object') {
    throw new GameHttpError(400, 'INVALID_ACTION', 'Azione di gioco mancante.');
  }

  for (let attempt = 0; attempt < CAS_MAX_RETRIES; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const fetched = await fetchRoomByCode(code);
    if (!fetched) throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Partita non trovata.');

    const { room, players } = fetched;
    authenticatePlayer(players, playerId, playerToken);

    if (room.status !== 'playing') {
      return {
        notice: 'La partita non è attiva.',
        conflict: true,
        snapshot: buildPublicRoomSnapshot({
          room,
          players,
          viewerPlayerId: playerId,
          nowMs,
          storageBackend: fetched.storageBackend,
        }),
      };
    }

    const result = applyPlayerAction(
      room.game_state,
      { ...action, playerId },
      nowMs,
    );

    const hasFinished = nowMs >= result.state.endsAtMs;
    const nowIso = new Date(nowMs).toISOString();

    const patch = {
      game_state: result.state,
      status: hasFinished ? 'finished' : 'playing',
      finished_at: hasFinished ? nowIso : null,
      updated_at: nowIso,
    };

    // eslint-disable-next-line no-await-in-loop
    const ok = await casUpdateRoom(room.id, room.version, patch);
    if (ok) {
      // Aggiorna last_seen_at e contributi amichevoli del giocatore
      const pStats = result.state.playerStats?.[playerId];
      // eslint-disable-next-line no-await-in-loop
      await updatePlayerRow(playerId, {
        connected: true,
        last_seen_at: nowIso,
        ...(pStats ? { contributions: pStats } : {}),
      });

      const updatedRoom = { ...room, ...patch, version: room.version + 1 };
      // eslint-disable-next-line no-await-in-loop
      await broadcastRoomWakeup(room.realtime_topic, updatedRoom.version, 'game_action');

      return {
        notice: result.notice,
        conflict: Boolean(result.conflict),
        duplicate: Boolean(result.duplicate),
        snapshot: buildPublicRoomSnapshot({
          room: updatedRoom,
          players,
          viewerPlayerId: playerId,
          nowMs,
          storageBackend: fetched.storageBackend,
        }),
      };
    }
  }

  throw new GameHttpError(409, 'CONCURRENT_CONFLICT', 'Azione concorrente in cucina, riprova!');
}

export async function returnToLobby({ code, playerId, playerToken, nowMs = Date.now() }) {
  const fetched = await fetchRoomByCode(code);
  if (!fetched) throw new GameHttpError(404, 'ROOM_NOT_FOUND', 'Lobby non trovata.');

  const { room, players } = fetched;
  authenticatePlayer(players, playerId, playerToken);

  const nowIso = new Date(nowMs).toISOString();
  await casUpdateRoom(room.id, room.version, {
    status: 'lobby',
    game_state: {},
    started_at: null,
    finished_at: null,
    updated_at: nowIso,
    expires_at: new Date(nowMs + ROOM_TTL_MS).toISOString(),
  });

  const updated = await fetchRoomByCode(code);
  await broadcastRoomWakeup(room.realtime_topic, updated.room.version, 'returned_to_lobby');

  return {
    snapshot: buildPublicRoomSnapshot({
      room: updated.room,
      players: updated.players,
      viewerPlayerId: playerId,
      nowMs,
      storageBackend: updated.storageBackend,
    }),
  };
}

export async function leaveLobby({ code, playerId, playerToken, nowMs = Date.now() }) {
  const fetched = await fetchRoomByCode(code);
  if (!fetched) return { left: true, roomDeleted: true };

  const { room, players } = fetched;
  authenticatePlayer(players, playerId, playerToken);

  await deletePlayerRow(playerId);
  const remaining = players.filter((p) => p.id !== playerId);

  if (remaining.length === 0) {
    await deleteRoomRow(room.id);
    return { left: true, roomDeleted: true };
  }

  const nowIso = new Date(nowMs).toISOString();
  let nextHostId = room.host_player_id;
  if (room.host_player_id === playerId) {
    nextHostId = remaining[0].id;
    await updatePlayerRow(nextHostId, { is_host: true, is_ready: true });
  }

  await casUpdateRoom(room.id, room.version, {
    host_player_id: nextHostId,
    updated_at: nowIso,
  });

  await broadcastRoomWakeup(room.realtime_topic, room.version + 1, 'player_left');
  return { left: true, roomDeleted: false, nextHostId };
}
