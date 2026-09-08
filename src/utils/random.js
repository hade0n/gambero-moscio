/**
 * Randomizzazione robusta lato frontend.
 * Usa `crypto.getRandomValues` (rejection sampling per uniformità), con
 * fallback a `Math.random` solo se la Crypto API non è disponibile.
 */

function cryptoUint32() {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0];
  }
  return null;
}

/** Intero uniforme in [0, n). */
export function randomInt(n) {
  const count = Math.floor(n);
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count === 1) return 0;

  const c = cryptoUint32();
  if (c === null) return Math.floor(Math.random() * count);

  // rejection sampling: scarta la coda che darebbe una distribuzione sbilanciata
  const limit = Math.floor(0x100000000 / count) * count;
  let value = c;
  while (value >= limit) {
    const next = cryptoUint32();
    if (next === null) return Math.floor(Math.random() * count);
    value = next;
  }
  return value % count;
}

/** Float uniforme in [0, 1). */
export function randomFloat() {
  const c = cryptoUint32();
  if (c === null) return Math.random();
  return c / 0x100000000;
}

/** Copia mescolata con Fisher–Yates (non muta l'array originale). */
export function shuffle(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Estrae `count` elementi distinti a caso (o tutti se sono meno di `count`). */
export function sample(list, count) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length <= count) return shuffle(arr);
  return shuffle(arr).slice(0, count);
}

/** Un elemento a caso, o `null` se la lista è vuota. */
export function pickOne(list) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length === 0) return null;
  return arr[randomInt(arr.length)];
}
