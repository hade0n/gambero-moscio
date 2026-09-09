import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';

/**
 * Quadrante del Food Picker — versione premium.
 *
 * NON tocca la matematica del vincitore: `rotation` (da `useGamberoWheel`) porta
 * il centro del segmento vincente sotto il puntatore fisso a ore 12. Il disco
 * ruota di un valore SOLO CRESCENTE `s` con `s ≡ (360 − rotation mod 360) (mod
 * 360)`, quindi il segmento vincente finisce esattamente in cima. Lo swap
 * tipologie→locali (rotation che cambia di colpo) resta forward-only.
 *
 * Extra: cornice a livelli concentrici, prospettiva 3D che segue il mouse
 * (solo desktop, ±5°), micro-blur mappato dalla velocità angolare, puntatore
 * fisico con "tick" all'arresto, idle float impercettibile. Tutto azzerato da
 * `prefers-reduced-motion` e alleggerito su touch.
 */

const VB = 200;
const C = 100;
const R = 88;

const rad = (d) => (d * Math.PI) / 180;
const pt = (r, aDeg) => [C + r * Math.sin(rad(aDeg)), C - r * Math.cos(rad(aDeg))];

// Toni caldi, food-oriented, bassa saturazione — derivati dal design system PNDR.
const FILLS = ['#FFF9F1', '#F6E7CD', '#ECF1E0'];

function segPath(i, seg) {
  const [x0, y0] = pt(R, i * seg);
  const [x1, y1] = pt(R, (i + 1) * seg);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function labelSpec(n) {
  if (n <= 4) return { fs: 9, max: 15 };
  if (n <= 6) return { fs: 8, max: 13 };
  if (n <= 8) return { fs: 6.9, max: 11 };
  return { fs: 6, max: 9 };
}
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s || '');

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return coarse;
}

export default function GamberoWheel({
  items = [],
  rotation = 0,
  spinning = false,
  durationMs = 4600,
  ariaLabel,
  centerTitle = 'Il Gambero',
  centerDetail = 'decide',
}) {
  const count = items.length;
  const seg = count > 0 ? 360 / count : 360;
  const reduce = useReducedMotion();
  const coarse = useCoarsePointer();
  const flat = coarse || reduce;
  const L = labelSpec(Math.max(count, 1));
  const showLabels = count > 1 && count <= 8;

  // ---- prospettiva 3D che segue il puntatore (solo desktop) -------------------
  const boardRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [11, 1]), { stiffness: 120, damping: 18 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (flat) return undefined;
    const el = boardRef.current;
    if (!el) return undefined;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / r.width - 0.5);
      my.set((e.clientY - r.top) / r.height - 0.5);
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [flat, mx, my]);

  // ---- rotazione del disco: valore SOLO CRESCENTE, allineato al vincitore -----
  const spin = useMotionValue(0);
  const spinTarget = useRef(0);

  useEffect(() => {
    const w = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - w) % 360; // spin ≡ desiredMod (mod 360)
    const from = spinTarget.current;
    const turns = spinning && !reduce ? (4 + Math.floor(Math.random() * 3)) * 360 : 0;
    let target = from + turns;
    const add = (desiredMod - (((target % 360) + 360) % 360) + 360) % 360;
    target += add;
    if (turns > 0 && target <= from + 1) target += 360;
    spinTarget.current = target;

    if (reduce) {
      spin.set(target);
      return undefined;
    }
    const controls = animate(spin, target, {
      duration: spinning ? durationMs / 1000 : 0.3,
      ease: spinning ? [0.33, 0, 0.15, 1] : [0.2, 0.7, 0.2, 1],
    });
    return controls.stop;
  }, [rotation, spinning, durationMs, reduce, spin]);

  const spinVel = useVelocity(spin);
  const discFilter = useTransform(spinVel, (v) => {
    if (flat) return 'none';
    const b = Math.min(1.6, Math.abs(v) / 950);
    return b < 0.05 ? 'none' : `blur(${b.toFixed(2)}px)`;
  });

  // ---- "tick" del puntatore all'arresto -------------------------------------
  const wasSpinning = useRef(spinning);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (wasSpinning.current && !spinning) setTick((t) => t + 1);
    wasSpinning.current = spinning;
  }, [spinning]);

  const idle = !spinning && !reduce;

  return (
    <div
      className="relative mx-auto aspect-square w-[min(78vw,320px)] sm:w-[356px] lg:w-[380px]"
      style={{ perspective: 1100 }}
    >
      {/* ombra a terra che "respira" durante l'idle */}
      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-[85%] h-[15%] w-[76%] -translate-x-1/2 rounded-[50%] bg-brown/25 blur-xl"
        animate={idle ? { scale: [1, 1.05, 1], opacity: [0.5, 0.36, 0.5] } : { scale: 1, opacity: 0.5 }}
        transition={idle ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      />

      <motion.div
        ref={boardRef}
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          rotateX: flat ? 6 : rotX,
          rotateY: flat ? 0 : rotY,
        }}
        animate={idle ? { y: [0, -3, 0] } : { y: 0 }}
        transition={idle ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      >
        {/* cornice: livelli concentrici, profondità via shadow / inset */}
        <div
          className="absolute inset-0 rounded-full bg-green-deep"
          style={{
            boxShadow:
              '0 22px 46px rgba(58,42,34,0.30), inset 0 3px 6px rgba(255,255,255,0.22), inset 0 -12px 24px rgba(0,0,0,0.30)',
          }}
        />
        <div
          className="absolute inset-[5.5%] rounded-full bg-cream-soft"
          style={{ boxShadow: 'inset 0 2px 5px rgba(58,42,34,0.22)' }}
        />
        <div className="absolute inset-[8.5%] rounded-full bg-brown/10" />

        {/* disco dei segmenti — un solo layer, rotazione + micro-blur */}
        <motion.div
          className="absolute inset-[9%] rounded-full"
          style={{ rotate: spin, filter: discFilter, willChange: 'transform, filter' }}
        >
          <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full">
            {count <= 1 ? (
              <circle cx={C} cy={C} r={R} fill={FILLS[0]} />
            ) : (
              items.map((it, i) => (
                <path
                  key={it.id}
                  d={segPath(i, seg)}
                  fill={FILLS[i % FILLS.length]}
                  stroke="#FCF3E6"
                  strokeWidth="1"
                />
              ))
            )}
            {showLabels &&
              items.map((it, i) => {
                const a = (i + 0.5) * seg;
                const [lx, ly] = pt(R * 0.6, a);
                return (
                  <text
                    key={`t-${it.id}`}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-sans"
                    fontSize={L.fs}
                    fontWeight="700"
                    fill="#3A2A22"
                  >
                    {clip(it.label, L.max)}
                  </text>
                );
              })}
          </svg>
        </motion.div>

        {/* mozzo — cappuccio fisico centrale */}
        <div
          className="absolute left-1/2 top-1/2 z-20 flex h-[31%] w-[31%] flex-col items-center justify-center rounded-full bg-cream-soft text-center"
          style={{
            transform: 'translate(-50%, -50%) translateZ(8px)',
            boxShadow:
              '0 7px 16px rgba(58,42,34,0.24), inset 0 2px 4px rgba(255,255,255,0.65), inset 0 -4px 9px rgba(58,42,34,0.14)',
          }}
        >
          <span className="px-1 font-display text-[0.78rem] font-bold leading-none text-brown sm:text-sm">
            {centerTitle}
          </span>
          {centerDetail && (
            <span className="mt-1 text-[0.52rem] font-bold uppercase tracking-[0.12em] text-brown-soft">
              {centerDetail}
            </span>
          )}
        </div>

        {/* puntatore fisico — fisso in alto, punta verso il centro */}
        <motion.div
          className="absolute left-1/2 top-[-3%] z-30"
          style={{ transform: 'translateX(-50%) translateZ(16px)' }}
          animate={spinning ? { rotate: -7 } : { rotate: 0 }}
          transition={{ type: 'spring', stiffness: 210, damping: 15 }}
        >
          <motion.div
            key={tick}
            style={{ originX: 0.5, originY: 0 }}
            animate={tick ? { rotate: [0, -15, 8, -4, 0] } : {}}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          >
            <svg
              width="34"
              height="42"
              viewBox="0 0 34 42"
              aria-hidden="true"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(58,42,34,0.32))' }}
            >
              <path
                d="M17 40 C9 27 2 21 2 13 A15 15 0 0 1 32 13 C32 21 25 27 17 40 Z"
                fill="#BB5A20"
              />
              <path
                d="M6 9 A12 12 0 0 1 28 9"
                fill="none"
                stroke="#FCF3E6"
                strokeOpacity="0.5"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="17" cy="13" r="4.5" fill="#FCF3E6" opacity="0.92" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>

      <span
        className="sr-only"
        role="img"
        aria-label={
          ariaLabel || (count > 0 ? `Quadrante con ${count} opzioni` : 'Quadrante vuoto')
        }
      />
    </div>
  );
}
