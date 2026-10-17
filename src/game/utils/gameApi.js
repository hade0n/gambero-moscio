/**
 * Client HTTP + Realtime helper per `/api/game`.
 * - Mantiene la sessione della scheda corrente in `sessionStorage` (così più schede
 *   possono testare il multiplayer in parallelo come giocatori distinti e il refresh
 *   della scheda riconnette automaticamente lo stesso giocatore).
 * - Salva le preferenze di profilo (nickname e avatar) in `localStorage`.
 * - Usa Supabase Realtime (Broadcast + Presence sul `realtimeTopic` segreto della
 *   stanza, se `supabaseAnonKey` è configurata) come segnale leggero per richiedere
 *   uno snapshot autenticato, affiancato da `BroadcastChannel` per la sincronizzazione
 *   immediata multi-scheda.
 */
import { createClient } from '@supabase/supabase-js';
import { CHEF_PERSONAS, normalizePlayerAvatar } from '../data/characters.js';

const SESSION_STORAGE_KEY = 'gm_coop_active_session_v1';
const PROFILE_STORAGE_KEY = 'gm_coop_player_profile_v1';
const LOCAL_BROADCAST_CHANNEL = 'gm_coop_room_wakeup_v1';

export class GameApiError extends Error {
  constructor(status, code, message) {
    super(message || 'Errore di comunicazione con il server di gioco.');
    this.name = 'GameApiError';
    this.status = status;
    this.code = code || 'API_ERROR';
  }
}

export function loadSavedProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return {
        nickname: '',
        avatar: normalizePlayerAvatar(CHEF_PERSONAS[0].defaultAvatar),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      nickname: typeof parsed?.nickname === 'string' ? parsed.nickname.slice(0, 16) : '',
      avatar: normalizePlayerAvatar(parsed?.avatar),
    };
  } catch {
    return {
      nickname: '',
      avatar: normalizePlayerAvatar(CHEF_PERSONAS[0].defaultAvatar),
    };
  }
}

export function saveProfile({ nickname, avatar }) {
  try {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        nickname: String(nickname || '').trim().slice(0, 16),
        avatar: normalizePlayerAvatar(avatar),
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export function loadActiveGameSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.playerId || !parsed?.playerToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveGameSession(session) {
  try {
    if (!session) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        code: session.code,
        playerId: session.playerId,
        playerToken: session.playerToken,
      }),
    );
  } catch {
    // ignore
  }
}

export function clearActiveGameSession() {
  saveActiveGameSession(null);
}

function notifyLocalBroadcast(code, version) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(LOCAL_BROADCAST_CHANNEL);
    ch.postMessage({ code, version, atMs: Date.now() });
    ch.close();
  } catch {
    // ignore
  }
}

async function requestGameApi(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new GameApiError(0, 'NETWORK_ERROR', 'Connessione assente. Riconnessione in corso…');
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new GameApiError(
      res.status,
      data.code || 'HTTP_ERROR',
      data.error || 'Impossibile completare l’operazione.',
    );
  }

  return data;
}

export async function apiCreateLobby({ nickname, avatar }) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    body: JSON.stringify({
      op: 'createLobby',
      nickname,
      avatar,
    }),
  });
  saveActiveGameSession({
    code: res.snapshot.code,
    playerId: res.playerId,
    playerToken: res.playerToken,
  });
  notifyLocalBroadcast(res.snapshot.code, res.snapshot.version);
  return res;
}

export async function apiJoinLobby({
  code,
  nickname,
  avatar,
  existingPlayerId = null,
  existingToken = null,
}) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {},
    body: JSON.stringify({
      op: 'joinLobby',
      code,
      nickname,
      avatar,
      existingPlayerId,
      existingToken,
    }),
  });
  saveActiveGameSession({
    code: res.snapshot.code,
    playerId: res.playerId,
    playerToken: res.playerToken,
  });
  notifyLocalBroadcast(res.snapshot.code, res.snapshot.version);
  return res;
}

export async function apiFetchSnapshot({ code, playerId, playerToken }) {
  const params = new URLSearchParams({ code, playerId });
  return requestGameApi(`/api/game?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${playerToken}`,
    },
  });
}

export async function apiUpdatePlayer({ code, playerId, playerToken, isReady, nickname, avatar }) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({
      op: 'updatePlayer',
      code,
      playerId,
      isReady,
      nickname,
      avatar,
    }),
  });
  notifyLocalBroadcast(code, res.snapshot?.version);
  return res;
}

export async function apiStartMatch({ code, playerId, playerToken }) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({
      op: 'startMatch',
      code,
      playerId,
    }),
  });
  notifyLocalBroadcast(code, res.snapshot?.version);
  return res;
}

export async function apiSendGameAction({ code, playerId, playerToken, action }) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({
      op: 'gameAction',
      code,
      playerId,
      action,
    }),
  });
  notifyLocalBroadcast(code, res.snapshot?.version);
  return res;
}

export async function apiReturnToLobby({ code, playerId, playerToken }) {
  const res = await requestGameApi('/api/game', {
    method: 'POST',
    headers: { Authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({
      op: 'returnToLobby',
      code,
      playerId,
    }),
  });
  notifyLocalBroadcast(code, res.snapshot?.version);
  return res;
}

export async function apiLeaveLobby({ code, playerId, playerToken }) {
  try {
    await requestGameApi('/api/game', {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerToken}` },
      body: JSON.stringify({
        op: 'leaveLobby',
        code,
        playerId,
      }),
    });
  } finally {
    clearActiveGameSession();
    notifyLocalBroadcast(code, Date.now());
  }
}

/**
 * Sottoscrive i segnali di wakeup per una stanza:
 * 1. `BroadcastChannel` per sincronizzazione istantanea tra schede dello stesso browser.
 * 2. Canale Supabase Realtime (`realtimeTopic` non prevedibile) per Broadcast + Presence
 *    se sono disponibili `supabaseUrl` e `supabaseAnonKey` pubblica.
 *
 * Il callback `onWakeupSignal` non accetta mai stato cieco: scatena una lettura
 * autenticata dello snapshot server.
 */
export function subscribeRoomRealtime({
  code,
  realtimeTopic,
  realtimeConfig,
  playerId,
  nickname,
  onWakeupSignal,
  onPresenceSync,
}) {
  let localCh = null;
  let sbClient = null;
  let sbChannel = null;

  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      localCh = new BroadcastChannel(LOCAL_BROADCAST_CHANNEL);
      localCh.onmessage = (ev) => {
        if (ev?.data?.code === code) {
          onWakeupSignal?.(ev.data.version);
        }
      };
    } catch {
      localCh = null;
    }
  }

  const supabaseUrl =
    realtimeConfig?.supabaseUrl || import.meta.env?.VITE_SUPABASE_URL || null;
  const supabaseAnonKey =
    realtimeConfig?.supabaseAnonKey || import.meta.env?.VITE_SUPABASE_ANON_KEY || null;

  if (supabaseUrl && supabaseAnonKey && realtimeTopic) {
    try {
      sbClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      sbChannel = sbClient.channel(realtimeTopic, {
        config: {
          presence: { key: playerId },
          broadcast: { self: false },
        },
      });

      sbChannel
        .on('broadcast', { event: '*' }, (payload) => {
          onWakeupSignal?.(payload?.payload?.version);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = sbChannel.presenceState();
          onPresenceSync?.(Object.keys(state));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              await sbChannel.track({ playerId, nickname, onlineAt: new Date().toISOString() });
            } catch {
              // ignore presence track error
            }
          }
        });
    } catch {
      sbClient = null;
      sbChannel = null;
    }
  }

  return () => {
    if (localCh) {
      try {
        localCh.close();
      } catch {
        // ignore
      }
    }
    if (sbChannel && sbClient) {
      try {
        sbChannel.unsubscribe();
        sbClient.removeChannel(sbChannel);
      } catch {
        // ignore
      }
    }
  };
}
