import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

/**
 * Quadrante del Food Picker — prodotto 2D premium (nessun 3D).
 *
 * La sofisticazione viene da composizione, tipografia, spaziatura, bordi
 * sottili, gradienti trattenuti, ombre UI leggere e micro-interazioni — mai da
 * prospettiva, bevel, translateZ, materiali metallici o simulazione di oggetti
 * fisici. Tutti i colori/bordi/ombre sono token del design system PNDR: la ruota
 * è una superficie del sito (cream-soft + --pndr-border), accenti terracotta e
 * verde come nel resto dell'app.
 *
 * MATEMATICA DEL VINCITORE INVARIATA: `rotation` (da `useGamberoWheel`) porta il
 * centro del segmento vincente sotto il puntatore fisso a ore 12. Il disco ruota
 * di un valore SOLO CRESCENTE `spin`, con `spin ≡ (360 − rotation mod 360) (mod
 * 360)`. Lo swap tipologie→locali resta forward-only.
 */

const VB = 200;
const C = 100;
const R = 100;

const rad = (d) => (d * Math.PI) / 180;
const pt = (r, aDeg) => [C + r * Math.sin(rad(aDeg)), C - r * Math.cos(rad(aDeg))];

const FILL_A = '#FFF9F1'; // cream-soft
const FILL_B = '#FFF3E2'; // cream
const DIVIDER = 'rgba(58,42,34,0.12)'; // --pndr-border
const INK = '#3A2A22'; // brown

// Glifi minimali per categoria — spazio 24×24, tratto `currentColor`, coerenti
// col set icone del sito (stroke 1.75, linecap/linejoin tondi). Nessuna
// illustrazione, nessuna emoji.
const CATEGORY_GLYPH = {
  Pizzeria: (
    <>
      <path d="M5 7c4-2 10-2 14 0l-7 13z" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="12.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  Trattoria: (
    <>
      <path d="M8 3v6a2 2 0 0 0 4 0V3M10 9v12" />
      <path d="M16 3c-1.4 1-2 3-2 5s.6 3 2 4v9" />
    </>
  ),
  Osteria: (
    <>
      <path d="M8 3h8l-1 6a4 4 0 0 1-6 0z" />
      <path d="M12 15v5M9 21h6" />
    </>
  ),
  'Ristorante Pesce': (
    <>
      <path d="M5 12c3-5 10-5 13 0-3 5-10 5-13 0z" />
      <path d="M18 12l4-3v6z" />
      <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'Ristorante Carne': (
    <>
      <path d="M13 4a5 5 0 0 1 3.5 8.5L11 18l-3-3 5.5-5.5A5 5 0 0 1 13 4z" />
      <path d="M8 15l-3 3M6.5 13.5 4 16" />
    </>
  ),
  Paninoteca: (
    <>
      <path d="M4 9c2.5-4 13.5-4 16 0" />
      <path d="M4 9h16M4 13h16" />
      <path d="M5 17h14a1 1 0 0 0 1-1v-3H4v3a1 1 0 0 0 1 1z" />
    </>
  ),
  Agriturismo: (
    <>
      <path d="M12 21V9" />
      <path d="M12 9C10 8 9 6 9 4c2 0 4 1 5 3M12 9c2-1 3-3 3-5-2 0-4 1-5 3M12 14c-2-1-3-3-3-5 2 0 4 1 5 3M12 14c2-1 3-3 3-5-2 0-4 1-5 3" />
    </>
  ),
  'Street Food': (
    <>
      <path d="M7 7h10l-3.2 13h-3.6z" />
      <path d="M9 3.5V7M12 3v4M15 3.5V7" />
    </>
  ),
};

function wedge(i, seg, r = R) {
  const [x0, y0] = pt(r, i * seg);
  const [x1, y1] = pt(r, (i + 1) * seg);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function topWedge(seg, r = R) {
  const h = seg / 2;
  const [x0, y0] = pt(r, -h);
  const [x1, y1] = pt(r, h);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

const SHORT_LABEL = { 'Ristorante Carne': 'Carne', 'Ristorante Pesce': 'Pesce' };
const labelText = (s) => SHORT_LABEL[s] || s || '';
const shorten = (s, n) => {
  const t = labelText(s).toUpperCase();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

function labelSpec(n) {
  if (n <= 4) return { fs: 8, max: 17 };
  if (n <= 6) return { fs: 6.8, max: 14 };
  if (n <= 8) return { fs: 5.9, max: 12 };
  return { fs: 5.2, max: 10 };
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

  // ---- rotazione: valore SOLO CRESCENTE, allineato al vincitore --------------
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

  // ---- micro-reazione del puntatore all'arresto -----------------------------
  const wasSpinning = useRef(spinning);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (wasSpinning.current && !spinning) setTick((t) => t + 1);
    wasSpinning.current = spinning;
  }, [spinning]);

  return (
    <div className="group relative mx-auto aspect-square w-[min(88vw,400px)] sm:w-[460px] lg:w-[500px]">
      {/* UN solo cerchio: la cornice. Superficie del sito, piatta, ombra UI leggera. */}
      <div className="absolute inset-0 rounded-full border border-brown/12 bg-cream-soft shadow-[0_8px_28px_rgba(58,42,34,0.08)] transition-colors duration-200 group-hover:border-brown/20" />

      {/* quadrante rotante — riempie la cornice, bordo tagliato netto */}
      <motion.div
        className="absolute inset-[3.5%] overflow-hidden rounded-full"
        style={{ rotate: spin, willChange: 'transform' }}
      >
        <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full">
          {count <= 1 ? (
            <circle cx={C} cy={C} r={R} fill={FILL_A} />
          ) : (
            items.map((it, i) => (
              <path key={it.id} d={wedge(i, seg)} fill={i % 2 === 0 ? FILL_A : FILL_B} />
            ))
          )}
          {/* divisori radiali sottili (linee, non cerchi) */}
          {count > 1 &&
            items.map((it, i) => {
              const [ox, oy] = pt(R, i * seg);
              return (
                <line
                  key={`d-${it.id}`}
                  x1={C}
                  y1={C}
                  x2={ox.toFixed(2)}
                  y2={oy.toFixed(2)}
                  stroke={DIVIDER}
                  strokeWidth="0.75"
                />
              );
            })}

          {/* icona + nome = un'unità radiale per segmento (solo ruota tipologie) */}
          {showLabels &&
            items.map((it, i) => {
              const a = (i + 0.5) * seg;
              const flip = a > 180;
              const rot = flip ? a - 270 : a - 90;
              const glyph = CATEGORY_GLYPH[it.label];
              const [gx, gy] = pt(R * 0.8, a);
              const [lx, ly] = pt(R * 0.5, a);
              const s = L.fs * 2.15;
              return (
                <g key={`seg-${it.id}`}>
                  {glyph && (
                    <g
                      transform={`rotate(${rot.toFixed(2)} ${gx.toFixed(2)} ${gy.toFixed(2)}) translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${(s / 24).toFixed(3)}) translate(-12 -12)`}
                      fill="none"
                      stroke={INK}
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.8"
                    >
                      {glyph}
                    </g>
                  )}
                  <text
                    x={lx.toFixed(2)}
                    y={ly.toFixed(2)}
                    transform={`rotate(${rot.toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-sans"
                    fontSize={L.fs}
                    fontWeight="700"
                    letterSpacing="0.06em"
                    fill={INK}
                  >
                    {shorten(it.label, L.max)}
                  </text>
                </g>
              );
            })}
        </svg>
      </motion.div>

      {/* selezione — piatta, verde (linguaggio "attivo" del sito), solo alla rivelazione */}
      {highlightTop && count > 1 && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3.5%]"
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
              strokeOpacity="0.4"
              strokeWidth="1.25"
            />
          </svg>
        </motion.div>
      )}

      {/* hub 2D — UN solo cerchio, mascotte al centro */}
      <div className="absolute left-1/2 top-1/2 z-20 flex h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brown/12 bg-cream-soft shadow-[0_2px_8px_rgba(58,42,34,0.08)]">
        <img
          src="/shrimp.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
          className="h-[64%] w-[64%] select-none object-contain"
        />
      </div>

      {/* puntatore 2D — richiamo trattenuto alla coda del gambero, in terracotta */}
      <motion.div
        className="absolute left-1/2 top-[-1.5%] z-30 -translate-x-1/2"
        animate={spinning ? { rotate: -6 } : { rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <motion.div
          key={tick}
          style={{ originX: 0.5, originY: 0 }}
          animate={tick ? { rotate: [0, -12, 6, -3, 0] } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 32 32"
            aria-hidden="true"
            style={{ filter: 'drop-shadow(0 2px 3px rgba(58,42,34,0.18))' }}
          >
            <path
              d="M16 29 C 12.5 20 8.5 14 7.5 8.5 C 11 9.5 13.5 7.5 16 4 C 18.5 7.5 21 9.5 24.5 8.5 C 23.5 14 19.5 20 16 29 Z"
              fill="#D96B32"
            />
            <path
              d="M16 25 L16 10.5"
              stroke="#FFF3E2"
              strokeOpacity="0.65"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
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
