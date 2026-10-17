/**
 * Endpoint serverless `/api/game` per "Il Banco del Gambero" (Gioco Co-Op).
 * Tutte le letture di stato e le mutazioni validano il token partecipante lato server.
 * Nessun segreto (SUPABASE_SERVICE_ROLE_KEY) viene mai esposto al client.
 */
import {
  createLobby,
  GameHttpError,
  getRoomSnapshot,
  joinLobby,
  leaveLobby,
  performGameAction,
  returnToLobby,
  startMatch,
  updateLobbyPlayer,
} from '../lib/game/store.js';

function extractClientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'local';
}

function extractBearerToken(req, body = {}) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers?.['x-player-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  if (typeof body?.playerToken === 'string' && body.playerToken.trim()) {
    return body.playerToken.trim();
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code') || '';
      const playerId = url.searchParams.get('playerId') || req.headers?.['x-player-id'] || '';
      const playerToken = extractBearerToken(req);

      const result = await getRoomSnapshot({
        code,
        playerId,
        playerToken,
      });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const op = body.op;
      const playerToken = extractBearerToken(req, body);
      const clientIp = extractClientIp(req);

      switch (op) {
        case 'createLobby': {
          const result = await createLobby({
            nickname: body.nickname,
            avatar: body.avatar,
          });
          return res.status(201).json(result);
        }

        case 'joinLobby': {
          const result = await joinLobby({
            code: body.code,
            nickname: body.nickname,
            avatar: body.avatar,
            existingPlayerId: body.existingPlayerId || null,
            existingToken: playerToken || body.existingToken || null,
            clientIp,
          });
          return res.status(200).json(result);
        }

        case 'updatePlayer': {
          const result = await updateLobbyPlayer({
            code: body.code,
            playerId: body.playerId,
            playerToken,
            isReady: body.isReady,
            nickname: body.nickname,
            avatar: body.avatar,
          });
          return res.status(200).json(result);
        }

        case 'startMatch': {
          const result = await startMatch({
            code: body.code,
            playerId: body.playerId,
            playerToken,
          });
          return res.status(200).json(result);
        }

        case 'gameAction': {
          const result = await performGameAction({
            code: body.code,
            playerId: body.playerId,
            playerToken,
            action: body.action,
          });
          return res.status(200).json(result);
        }

        case 'returnToLobby': {
          const result = await returnToLobby({
            code: body.code,
            playerId: body.playerId,
            playerToken,
          });
          return res.status(200).json(result);
        }

        case 'leaveLobby': {
          const result = await leaveLobby({
            code: body.code,
            playerId: body.playerId,
            playerToken,
          });
          return res.status(200).json(result);
        }

        default:
          return res.status(400).json({
            code: 'UNKNOWN_OPERATION',
            error: 'Operazione di gioco non supportata.',
          });
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  } catch (err) {
    if (err instanceof GameHttpError) {
      return res.status(err.status).json({
        code: err.code,
        error: err.message,
      });
    }
    return res.status(500).json({
      code: 'SERVER_ERROR',
      error: err?.message || 'Errore interno del server di gioco.',
    });
  }
}
