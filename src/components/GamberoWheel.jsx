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
 * Quadrante del Food Picker — un oggetto fisico, non un widget.
 *
 * Riscritto da zero. Il CONCETTO (ruota come fulcro, mozzo con la mascotte che
 * decide, puntatore in alto, cornice a livelli) resta; lo STILE è interamente
 * quello di Gambero Moscio: un solo bisello caldo con un unico sistema d'ombra,
 * quadrante calmo a due toni, tacche incise al bordo, mozzo concentrico con la
 * mascotte a intarsio. Nessun nome nel quadrante — i nomi vivono nella legenda
 * esterna (regola PNDR). Nessuna estetica da casinò.
 *
 * MATEMATICA DEL VINCITORE INVARIATA: `rotation` (da `useGamberoWheel`) porta il
 * centro del segmento vincente sotto il puntatore fisso a ore 12. Il disco ruota
 * di un valore SOLO CRESCENTE `spin`, con `spin ≡ (360 − rotation mod 360) (mod
 * 360)`. Lo swap tipologie→locali resta forward-only.
 */

const VB = 200;
const C = 100;
const R = 92;

const rad = (d) => (d * Math.PI) / 180;
const pt = (r, aDeg) => [C + r * Math.sin(rad(aDeg)), C - r * Math.cos(rad(aDeg))];

// SOLO token del design system PNDR: i due unici toni "superficie" (cream-soft /
// cream) alternati, separati dallo stesso bordo di ogni altra superficie del
// sito (--pndr-border = brown 12%). Nessun colore nuovo.
const FILL_A = '#FFF9F1'; // cream-soft
const FILL_B = '#FFF3E2'; // cream
const SEG_STROKE = 'rgba(58,42,34,0.14)';

// Nomi lunghi → forma corta leggibile dentro lo spicchio (il nome intero resta
// nell'headline e nella card del risultato).
const SHORT_LABEL = {
  'Ristorante Carne': 'Carne',
  'Ristorante Pesce': 'Pesce',
};
const labelText = (s) => SHORT_LABEL[s] || s || '';
const shorten = (s, n) => {
  const t = labelText(s).toUpperCase();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

function labelSpec(n) {
  if (n <= 4) return { fs: 8.6, max: 17 };
  if (n <= 6) return { fs: 7.4, max: 14 };
  if (n <= 8) return { fs: 6.5, max: 12 };
  return { fs: 5.6, max: 10 };
}

function wedge(i, seg, r = R) {
  const [x0, y0] = pt(r, i * seg);
  const [x1, y1] = pt(r, (i + 1) * seg);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

// Segmento fisso a ore 12: il vincitore atterra sempre qui.
function topWedge(seg, r = R) {
  const half = seg / 2;
  const [x0, y0] = pt(r, -half);
  const [x1, y1] = pt(r, half);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

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
  highlightTop = false,
}) {
  const count = items.length;
  const seg = count > 0 ? 360 / count : 360;
  const L = labelSpec(Math.max(count, 1));
  const showLabels = count > 1;
  const reduce = useReducedMotion();
  const coarse = useCoarsePointer();
  const flat = coarse || reduce;

  // ---- profondità 3D (solo desktop): tilt fisso + micro-parallax sul mouse ----
  const boardRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, 3]), { stiffness: 110, damping: 18 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]), { stiffness: 110, damping: 18 });

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
  const discBlur = useTransform(spinVel, (v) => {
    if (flat) return 'none';
    const b = Math.min(1.4, Math.abs(v) / 1100);
    return b < 0.06 ? 'none' : `blur(${b.toFixed(2)}px)`;
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
      className="relative mx-auto aspect-square w-[min(88vw,400px)] sm:w-[460px] lg:w-[500px]"
      style={{ perspective: 1300 }}
    >
      {/* ombra a terra — respira appena durante l'idle */}
      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-[86%] h-[13%] w-[74%] -translate-x-1/2 rounded-[50%] bg-brown/25 blur-xl"
        animate={
          idle ? { scale: [1, 1.04, 1], opacity: [0.45, 0.32, 0.45] } : { scale: 1, opacity: 0.45 }
        }
        transition={idle ? { duration: 7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      />

      <motion.div
        ref={boardRef}
        className="relative h-full w-full"
        style={{
          transformStyle: 'preserve-3d',
          rotateX: flat ? 7 : rotX,
          rotateY: flat ? 0 : rotY,
        }}
        animate={idle ? { y: [0, -2, 0] } : { y: 0 }}
        transition={idle ? { duration: 7, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
      >
        {/* Cornice = una superficie del sito: cream-soft + bordo --pndr-border +
            elevazione sulla scala shadow-lg del design system, con un bisello
            appena accennato per la fisicità. */}
        <div
          className="absolute inset-0 rounded-full border border-brown/12 bg-cream-soft"
          style={{
            boxShadow:
              '0 10px 24px rgba(58,42,34,0.10), 0 28px 64px rgba(58,42,34,0.16), inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -12px 22px rgba(58,42,34,0.09)',
          }}
        />
        {/* groove sottile prima del quadrante — stesso bordo delle altre superfici */}
        <div className="absolute inset-[6%] rounded-full border border-brown/12 bg-cream" />

        {/* quadrante rotante */}
        <motion.div
          className="absolute inset-[7.5%] rounded-full"
          style={{ rotate: spin, filter: discBlur, willChange: 'transform, filter' }}
        >
          <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full">
            {count <= 1 ? (
              <circle cx={C} cy={C} r={R} fill={FILL_A} />
            ) : (
              items.map((it, i) => (
                <path
                  key={it.id}
                  d={wedge(i, seg)}
                  fill={i % 2 === 0 ? FILL_A : FILL_B}
                  stroke={SEG_STROKE}
                  strokeWidth="0.75"
                />
              ))
            )}
            {/* tacche incise al bordo di ogni segmento */}
            {count > 1 &&
              items.map((it, i) => {
                const [ox, oy] = pt(R * 0.995, i * seg);
                const [ix, iy] = pt(R * 0.92, i * seg);
                return (
                  <line
                    key={`k-${it.id}`}
                    x1={ox}
                    y1={oy}
                    x2={ix}
                    y2={iy}
                    stroke="#3A2A22"
                    strokeOpacity="0.12"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                );
              })}
            {/* nomi dentro gli spicchi — radiali, mai capovolti */}
            {showLabels &&
              items.map((it, i) => {
                const a = (i + 0.5) * seg;
                const flip = a > 180;
                const rot = flip ? a - 270 : a - 90;
                const [lx, ly] = pt(R * 0.63, a);
                return (
                  <text
                    key={`t-${it.id}`}
                    x={lx.toFixed(2)}
                    y={ly.toFixed(2)}
                    transform={`rotate(${rot.toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-sans"
                    fontSize={L.fs}
                    fontWeight="700"
                    letterSpacing="0.05em"
                    fill="#3A2A22"
                  >
                    {shorten(it.label, L.max)}
                  </text>
                );
              })}
          </svg>
        </motion.div>

        {/* luce dall'alto — statica, non ruota col disco */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[7.5%] rounded-full"
          style={{
            background:
              'radial-gradient(120% 92% at 50% 18%, rgba(255,255,255,0.6), rgba(255,255,255,0) 52%, rgba(58,42,34,0.14) 100%)',
          }}
        />

        {/* selezione: appare SOLO alla rivelazione. Verde = lo stesso linguaggio
            "attivo/scelto" del resto del sito (categoria attiva in homepage). */}
        {highlightTop && count > 1 && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[7.5%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full">
              <path
                d={topWedge(seg)}
                fill="#5F8F3A"
                fillOpacity="0.14"
                stroke="#385C32"
                strokeOpacity="0.45"
                strokeWidth="1.25"
              />
            </svg>
          </motion.div>
        )}

        {/* mozzo — una superficie del sito (cream-soft + bordo --pndr-border),
            appena rialzata, con la mascotte a intarsio */}
        <div
          className="absolute left-1/2 top-1/2 z-20 flex h-[24%] w-[24%] items-center justify-center rounded-full border border-brown/12 bg-cream-soft"
          style={{
            transform: 'translate(-50%, -50%) translateZ(12px)',
            boxShadow:
              '0 4px 10px rgba(58,42,34,0.10), 0 12px 26px rgba(58,42,34,0.12), inset 0 2px 3px rgba(255,255,255,0.75)',
          }}
        >
          <img
            src="/shrimp.svg"
            alt=""
            aria-hidden="true"
            draggable="false"
            className="h-[68%] w-[68%] select-none object-contain"
          />
        </div>

        {/* puntatore — marcatore compatto in terracotta (stesso colore della CTA) */}
        <motion.div
          className="absolute left-1/2 top-[-2.5%] z-30"
          style={{ transform: 'translateX(-50%) translateZ(18px)' }}
          animate={spinning ? { rotate: -6 } : { rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <motion.div
            key={tick}
            style={{ originX: 0.5, originY: 0 }}
            animate={tick ? { rotate: [0, -13, 7, -3, 0] } : {}}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <svg
              width="38"
              height="40"
              viewBox="0 0 34 36"
              aria-hidden="true"
              style={{ filter: 'drop-shadow(0 3px 5px rgba(58,42,34,0.24))' }}
            >
              <rect x="7" y="0" width="20" height="9" rx="4.5" fill="#D96B32" />
              <path
                d="M7 6 H27 Q30.5 6 28.2 10.5 L19 28 Q17 31.5 15 28 L5.8 10.5 Q3.5 6 7 6 Z"
                fill="#BB5A20"
              />
              <path
                d="M10 9.5 H24"
                stroke="#FFF3E2"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinecap="round"
              />
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
