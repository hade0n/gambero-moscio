import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDiscoveryTypes, drawCandidates } from '../utils/discovery.js';
import { randomInt, pickOne } from '../utils/random.js';
import {
  PLACE_SPIN_MESSAGES,
  RESULT_EYEBROW,
  RESULT_MESSAGES,
  RESULT_SINGLE_EYEBROW,
  REVEAL_MESSAGES,
  TYPE_SPIN_MESSAGES,
} from '../config/wheelMessages.js';

const SPIN_MS = 4600;
const REVEAL_MS = 1500;
const REDUCED_SPIN_MS = 320;
const REDUCED_REVEAL_MS = 500;
const CANDIDATE_COUNT = 6;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Angolo che porta il centro del segmento `index` (di `n`) sotto il "muso"
 *  del Gambero (ore 12), più `turns` giri e uno scarto interno al segmento. */
function targetRotation(current, index, n, turns) {
  const seg = 360 / n;
  const jitter = (randomInt(1000) / 1000 - 0.5) * seg * 0.5; // |jitter| < 0.25·seg
  const base = (index + 0.5) * seg;
  const currentMod = ((current % 360) + 360) % 360;
  const forward = (((base - currentMod) % 360) + 360) % 360;
  return current + turns * 360 + forward + jitter;
}

/**
 * Pipeline del Gambero Moscio Food Picker:
 *   idle → type-spin → type-reveal → place-spin → result
 *
 * Fase 1: ruota delle TIPOLOGIE (dal database discovery).
 * Fase 2: estrazione casuale di max 6 locali tra i top 25 della tipologia,
 *         poi ruota dei 6 → 1 vincitore. Tutto uniforme, il rank non conta.
 */
export function useGamberoWheel({ active }) {
  const types = useMemo(() => getDiscoveryTypes(), []);

  const [phase, setPhase] = useState('idle'); // idle | type-spin | type-reveal | place-spin | result | empty
  const [typeRotation, setTypeRotation] = useState(0);
  const [placeRotation, setPlaceRotation] = useState(0);
  const [pickedType, setPickedType] = useState(null); // categoria (string)
  const [candidates, setCandidates] = useState([]); // max 6 locali
  const [result, setResult] = useState(null); // { place, eyebrow, message }
  const [statusMessage, setStatusMessage] = useState('');

  const timers = useRef([]);
  const typeRotRef = useRef(0);
  const placeRotRef = useRef(0);
  const rafRef = useRef(0);
  typeRotRef.current = typeRotation;
  placeRotRef.current = placeRotation;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(rafRef.current);
  }, []);

  const hardReset = useCallback(() => {
    clearTimers();
    setPhase(types.length === 0 ? 'empty' : 'idle');
    setPickedType(null);
    setCandidates([]);
    setResult(null);
    setStatusMessage('');
  }, [clearTimers, types.length]);

  // Quando il modal si chiude: pulizia totale (nessun timer/animazione residua).
  useEffect(() => {
    if (!active) hardReset();
    return clearTimers;
  }, [active, hardReset, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const finishWithPlace = useCallback((place, eyebrow) => {
    setResult({ place, eyebrow, message: pickOne(RESULT_MESSAGES) });
    setPhase('result');
  }, []);

  const runPlacePhase = useCallback(
    (list) => {
      const reduced = prefersReducedMotion();

      if (list.length === 0) {
        // Nessun candidato (non dovrebbe capitare): torna a idle.
        setPhase('idle');
        return;
      }
      if (list.length === 1) {
        finishWithPlace(list[0], RESULT_SINGLE_EYEBROW);
        return;
      }

      const index = randomInt(list.length);
      const chosen = list[index];
      const turns = reduced ? 2 : 4 + randomInt(3);
      const next = targetRotation(placeRotRef.current, index, list.length, turns);

      setStatusMessage(pickOne(PLACE_SPIN_MESSAGES));
      setPhase('place-spin');
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setPlaceRotation(next));

      const t = setTimeout(
        () => finishWithPlace(chosen, RESULT_EYEBROW),
        (reduced ? REDUCED_SPIN_MS : SPIN_MS) + 80,
      );
      timers.current.push(t);
    },
    [finishWithPlace],
  );

  const start = useCallback(() => {
    if (phase !== 'idle' || types.length === 0) return;
    const reduced = prefersReducedMotion();

    const typeIndex = randomInt(types.length);
    const category = types[typeIndex].id;
    const turns = reduced ? 2 : 4 + randomInt(3);
    const next = targetRotation(typeRotRef.current, typeIndex, types.length, turns);

    setPickedType(category);
    setResult(null);
    setStatusMessage(pickOne(TYPE_SPIN_MESSAGES));
    setPhase('type-spin');
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setTypeRotation(next));

    const toReveal = setTimeout(
      () => {
        const list = drawCandidates(category, CANDIDATE_COUNT);
        setCandidates(list);
        setStatusMessage(pickOne(REVEAL_MESSAGES));
        setPhase('type-reveal');

        const toPlace = setTimeout(
          () => runPlacePhase(list),
          reduced ? REDUCED_REVEAL_MS : REVEAL_MS,
        );
        timers.current.push(toPlace);
      },
      (reduced ? REDUCED_SPIN_MS : SPIN_MS) + 80,
    );
    timers.current.push(toReveal);
  }, [phase, types, runPlacePhase]);

  /** «Fallo girare di nuovo»: nuova sessione, nuova tipologia. Le rotazioni
   *  restano dove sono (nessun salto visivo al prossimo spin). */
  const respin = useCallback(() => {
    clearTimers();
    setPickedType(null);
    setCandidates([]);
    setResult(null);
    setStatusMessage('');
    setPhase(types.length === 0 ? 'empty' : 'idle');
  }, [clearTimers, types.length]);

  const isSpinning = phase === 'type-spin' || phase === 'place-spin';

  return {
    phase,
    isSpinning,
    types,
    typeRotation,
    placeRotation,
    pickedType,
    candidates,
    result,
    statusMessage,
    start,
    respin,
    spinDurationMs: SPIN_MS,
  };
}
