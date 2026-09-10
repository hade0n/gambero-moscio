/**
 * Client dell'archivio centrale (`/api/restaurants` → Supabase).
 * Nessun segreto qui: solo chiamate HTTP. La fonte autorevole è il server.
 */

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data || {};
  }
}

async function parse(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* risposta senza corpo JSON */
  }
  return data;
}

/** GET dell'intera collezione: { version, updatedAt, restaurants }. */
export async function getCollection() {
  let res;
  try {
    res = await fetch('/api/restaurants', { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError('Non è stato possibile contattare il server.', 0);
  }
  const data = await parse(res);
  if (!res.ok) {
    throw new ApiError(data.error || 'Errore nel recupero dei dati.', res.status, data);
  }
  return {
    version: Number.isFinite(data.version) ? data.version : 0,
    updatedAt: data.updatedAt ?? null,
    signature: typeof data.signature === 'string' ? data.signature : '',
    restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
  };
}

/** Invia una mutazione; ritorna il nuovo documento completo. Lancia `ApiError`. */
export async function sendMutation(method, body) {
  let res;
  try {
    res = await fetch('/api/restaurants', {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Non è stato possibile contattare il server.', 0);
  }
  const data = await parse(res);
  if (!res.ok) {
    const msg =
      res.status === 401
        ? 'Sessione scaduta. Effettua di nuovo l’accesso.'
        : data.error || 'Operazione non riuscita.';
    throw new ApiError(msg, res.status, data);
  }
  return {
    version: Number.isFinite(data.version) ? data.version : 0,
    updatedAt: data.updatedAt ?? null,
    signature: typeof data.signature === 'string' ? data.signature : '',
    restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
  };
}

/** Carica un'immagine (data URL) su Supabase Storage; ritorna l'URL pubblico. */
export async function uploadImage(dataUrl, kind) {
  if (typeof dataUrl === 'string' && /^https?:\/\//i.test(dataUrl)) return dataUrl; // già un URL
  let res;
  try {
    res = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, kind }),
    });
  } catch {
    throw new ApiError('Non è stato possibile contattare il server.', 0);
  }
  const data = await parse(res);
  if (!res.ok || !data.url) {
    throw new ApiError(data.error || 'Caricamento immagine non riuscito.', res.status, data);
  }
  return data.url;
}

export { ApiError };
