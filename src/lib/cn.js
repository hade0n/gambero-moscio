/**
 * Unisce classi condizionali senza dipendenze.
 * Accetta stringhe, falsy (ignorati) e oggetti { classe: bool }.
 *   cn('a', cond && 'b', { c: isC })
 */
export function cn(...parts) {
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string') {
      out.push(part);
    } else if (typeof part === 'object') {
      for (const [key, value] of Object.entries(part)) {
        if (value) out.push(key);
      }
    }
  }
  return out.join(' ');
}
