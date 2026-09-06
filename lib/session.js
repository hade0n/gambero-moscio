/**
 * Sessione di autenticazione — codice SERVER-SIDE.
 *
 * Usato solo dalle Vercel Functions in `api/`. Non viene mai incluso nel
 * bundle del frontend. Nessuna password è hardcoded qui: le password reali
 * dei due account (`ilenia`, `salvatore`) arrivano da
 * `process.env.ILENIA_PASSWORD` / `process.env.SALVATORE_PASSWORD`
 * (Environment Variables di Vercel in produzione, `.env.local` in sviluppo).
 * Gli username non sono segreti: sono valori noti dell'applicazione.
 *
 * La sessione è un token opaco firmato via HMAC-SHA256 e trasportato in un
 * cookie HttpOnly: non richiede database né server sempre acceso.
 */
import crypto from 'node:crypto';

const COOKIE_NAME = 'pndr_session';
const TTL_SECONDS = 8 * 60 * 60; // 8 ore

/** Password per username (server-side). Username noti, password solo da env. */
const ACCOUNTS = {
  ilenia: () => process.env.ILENIA_PASSWORD,
  salvatore: () => process.env.SALVATORE_PASSWORD,
};

/** Chiave di firma derivata dai segreti d'ambiente (nessun valore in chiaro nel repo). */
function signingKey() {
  const secret =
    process.env.AUTH_SECRET ||
    `${process.env.ILENIA_PASSWORD || ''}::${process.env.SALVATORE_PASSWORD || ''}`;
  return crypto.createHash('sha256').update(`fmrl::session::${secret}`).digest();
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Confronto delle credenziali: ESCLUSIVAMENTE lato server, a tempo costante.
 * @returns {'ilenia'|'salvatore'|null} lo username autenticato, oppure null.
 */
export function checkCredentials(username, password) {
  const key = String(username ?? '');
  const getExpected = Object.prototype.hasOwnProperty.call(ACCOUNTS, key) ? ACCOUNTS[key] : null;
  const expectedPass = getExpected ? getExpected() : null;

  const hash = (v) => crypto.createHash('sha256').update(String(v ?? '')).digest();
  // Confronto sempre eseguito (anche per username sconosciuti) per non variare i tempi.
  const passOk = crypto.timingSafeEqual(hash(password), hash(expectedPass ?? crypto.randomUUID()));

  return expectedPass && passOk ? key : null;
}

/** Crea un token di sessione firmato e con scadenza. Valore imprevedibile (nonce). */
export function createSessionToken(user) {
  const payload = {
    sub: user,
    user,
    iat: Date.now(),
    exp: Date.now() + TTL_SECONDS * 1000,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Verifica firma + scadenza. Ritorna il payload o null. */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Estrae e valida la sessione dalla request. */
export function getSession(req) {
  const header = req.headers?.cookie || '';
  const fromHeader = header
    .split(/;\s*/)
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = fromHeader
    ? decodeURIComponent(fromHeader.slice(COOKIE_NAME.length + 1))
    : req.cookies?.[COOKIE_NAME];
  return verifySessionToken(token);
}

function isSecure(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] || '');
  return proto.includes('https') || process.env.NODE_ENV === 'production';
}

/** Header Set-Cookie per creare la sessione. */
export function sessionCookieHeader(req, token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TTL_SECONDS}`,
  ];
  if (isSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

/** Header Set-Cookie per rimuovere la sessione. */
export function clearCookieHeader(req) {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

/** Legge e normalizza il body JSON (Vercel di solito lo fa già). */
export function readJsonBody(req) {
  const body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string' && body.length) {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}
