/**
 * Generatore pseudocasuale deterministico (Mulberry32) condiviso server/client.
 * Dato uno stato intero `seedState`, produce un float in [0, 1) e il nuovo `seedState`.
 */

export function normalizeSeed(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n) || n === 0) return 0x6d2b79f5;
  return (Math.trunc(n) >>> 0) || 0x6d2b79f5;
}

export function nextRandom(seedState) {
  let t = (normalizeSeed(seedState) + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeedState: nextState };
}

export function randomInt(seedState, min, maxInclusive) {
  const { value, nextSeedState } = nextRandom(seedState);
  const span = Math.max(1, maxInclusive - min + 1);
  return {
    value: min + Math.floor(value * span),
    nextSeedState,
  };
}

export function pickFromArray(seedState, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { value: null, nextSeedState: seedState };
  }
  const { value: idx, nextSeedState } = randomInt(seedState, 0, items.length - 1);
  return { value: items[idx], nextSeedState };
}
