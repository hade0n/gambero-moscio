import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RESULT_MESSAGES,
  SPINNING_MESSAGES,
  WHEEL_RESULT_EYEBROW,
  WHEEL_SINGLE_EYEBROW,
} from '../config/wheelMessages.js';

const SPIN_MS = 4800;
const REDUCED_MS = 360;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Logica della Ruota del Gambero Moscio.
 *
 * MATEMATICA (documentata perché è un requisito critico che il risultato
 * mostrato corrisponda SEMPRE al segmento fermo sotto il Gambero):
 *  - i segmenti sono disegnati in senso ORARIO a partire dalle ore 12 (dove sta
 *    la lancetta / il Gambero, che è FISSO);
 *  - la rotazione CSS della ruota è positiva in senso orario;
 *  - il segmento `i` (0…n-1) occupa gli angoli [i·seg, (i+1)·seg) e ha centro a
 *    `(i + 0.5)·seg`;
 *  - per portare il centro del segmento `i` esattamente a ore 12 serve
 *    `rotation ≡ -(i + 0.5)·seg  (mod 360)`;
 *  - si aggiungono alcuni giri completi + uno scarto casuale limitato a
 *    ±0.275·seg, che NON può spostare il vincitore in un altro segmento;
 *  - la rotazione non viene mai azzerata: il prossimo spin parte da dov'è
 *    (nessun salto visivo).
 *
 * @param {Array<{id:string}>} restaurants  locali eleggibili (già filtrati)
 */
export function useShrimpWheel(restaurants) {
  const list = Array.isArray(restaurants) ? restaurants : [];
  const idsKey = useMemo(() => list.map((r) => r.id).join('|'), [list]);

  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'spinning' | 'result'
  const [result, setResult] = useState(null); // { restaurant, eyebrow, message }
  const [spinMessage, setSpinMessage] = useState('');

  const rotationRef = useRef(0);
  const phaseRef = useRef('idle');
  const timerRef = useRef(null);
  const rafRef = useRef(0);
  rotationRef.current = rotation;
  phaseRef.current = phase;

  // Se cambia l'insieme dei locali (filtro / CRUD) il risultato mostrato non è
  // più coerente → torna allo stato iniziale. Mai durante uno spin: lo snapshot
  // protegge lo spin in corso.
  useEffect(() => {
    if (phaseRef.current === 'spinning') return;
    setPhase('idle');
    setResult(null);
  }, [idsKey]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const spin = useCallback(() => {
    if (phaseRef.current === 'spinning') return;

    // Snapshot: eventuali modifiche esterne alla lista durante lo spin non
    // devono alterare la matematica di QUESTO spin.
    const snapshot = list.slice();
    if (snapshot.length === 0) return;

    if (snapshot.length === 1) {
      setResult({
        restaurant: snapshot[0],
        eyebrow: WHEEL_SINGLE_EYEBROW,
        message: pick(RESULT_MESSAGES),
      });
      setPhase('result');
      return;
    }

    const n = snapshot.length;
    const seg = 360 / n;
    const index = Math.floor(Math.random() * n); // uniforme: il rating non conta
    const picked = snapshot[index];

    const targetMod = ((((-(index + 0.5) * seg) % 360) + 360) % 360);
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const forward = (((targetMod - currentMod) % 360) + 360) % 360;
    const jitter = (Math.random() - 0.5) * seg * 0.55; // |jitter| < 0.275·seg
    const reduced = prefersReducedMotion();
    const turns = reduced ? 2 : 5 + Math.floor(Math.random() * 3);
    const finalRotation = rotationRef.current + turns * 360 + forward + jitter;

    setSpinMessage(pick(SPINNING_MESSAGES));
    setResult(null);
    setPhase('spinning');

    // Applica la rotazione al frame successivo, così la transition CSS è già
    // montata e l'animazione parte in modo affidabile.
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setRotation(finalRotation));

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => {
        const current = Array.isArray(restaurants) ? restaurants : [];
        if (!current.some((r) => r.id === picked.id)) {
          // il locale è stato eliminato mentre la ruota girava
          setPhase('idle');
          return;
        }
        setResult({
          restaurant: picked,
          eyebrow: WHEEL_RESULT_EYEBROW,
          message: pick(RESULT_MESSAGES),
        });
        setPhase('result');
      },
      (reduced ? REDUCED_MS : SPIN_MS) + 80,
    );
  }, [list, restaurants]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setResult(null);
    setPhase('idle');
    // la rotazione resta dov'è: il prossimo spin riparte da qui
  }, []);

  const status =
    phase === 'spinning'
      ? 'spinning'
      : phase === 'result'
        ? 'result'
        : list.length === 0
          ? 'empty'
          : list.length === 1
            ? 'single'
            : 'ready';

  return {
    status,
    rotation,
    isSpinning: phase === 'spinning',
    result,
    spinMessage,
    spin,
    reset,
    count: list.length,
    spinDurationMs: SPIN_MS,
  };
}
