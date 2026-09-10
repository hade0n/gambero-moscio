import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { getShrimpRatingState } from '../utils/ratingUtils.js';
import { formatRating } from '../utils/ratings.js';
import { EASE } from '../lib/motion.js';
import AnimatedNumber from './AnimatedNumber.jsx';

/**
 * Sistema di valutazione PNDR: i **Gamberi Mosci**.
 *
 * 5 gamberi, ognuno vale 2.0 punti su 10. Il riempimento è continuo: il gambero
 * parziale mostra esattamente la percentuale corrispondente al voto (8.1 → 5%,
 * 8.5 → 25%, 9.0 → 50%…), tramite `clip-path` sull'asset ufficiale
 * `public/shrimp.svg` sovrapposto alla sua versione "vuota" (attenuata).
 * Il numero resta la fonte precisa e ha una gerarchia leggermente superiore.
 *
 * Con `animateValue` il numero E i gamberi si riempiono progressivamente da 0
 * al voto, come una barra di caricamento (rispetta `prefers-reduced-motion`).
 *
 * @param {number}  rating           voto 0.0–10.0 (qualsiasi decimale)
 * @param {'sm'|'md'|'lg'|number} [size='md']
 * @param {boolean} [showValue=true] mostra il numero accanto ai gamberi
 * @param {string}  [className]
 * @param {string}  [valueClassName] classi del numero (default: text-sm bold)
 * @param {string}  [ariaLabel]      override dell'etichetta accessibile
 * @param {boolean} [decorative=false] se true l'intero blocco è aria-hidden
 * @param {boolean} [animateValue=false] riempimento progressivo di numero + gamberi
 * @param {number}  [valueDelay=0]   ritardo del riempimento progressivo (s)
 */
const SHRIMP_SRC = '/shrimp.svg';

const SIZE_MAP = { sm: 15, md: 20, lg: 28 };
const FILL_MS = 0.85;

function Shrimp({ px, fill }) {
  return (
    <span className="relative inline-block shrink-0 align-middle" style={{ width: px, height: px }}>
      <img
        src={SHRIMP_SRC}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full select-none"
        style={{ opacity: 0.24, filter: 'saturate(0.2)' }}
      />
      {fill > 0 && (
        <img
          src={SHRIMP_SRC}
          alt=""
          aria-hidden="true"
          draggable="false"
          className="absolute inset-0 h-full w-full select-none"
          style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
        />
      )}
    </span>
  );
}

/** Gambero il cui riempimento segue la motion value `mv` (voto animato 0→N). */
function AnimatedShrimp({ px, mv, index }) {
  const fill = useTransform(mv, (r) => getShrimpRatingState(r).fills[index] ?? 0);
  const clip = useTransform(fill, (f) => `inset(0 ${(100 - f).toFixed(2)}% 0 0)`);
  return (
    <span className="relative inline-block shrink-0 align-middle" style={{ width: px, height: px }}>
      <img
        src={SHRIMP_SRC}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full select-none"
        style={{ opacity: 0.24, filter: 'saturate(0.2)' }}
      />
      <motion.img
        src={SHRIMP_SRC}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full select-none"
        style={{ clipPath: clip }}
      />
    </span>
  );
}

export default function ShrimpRating({
  rating = 0,
  size = 'md',
  showValue = true,
  className = '',
  valueClassName = 'text-sm',
  ariaLabel,
  decorative = false,
  animateValue = false,
  valueDelay = 0,
}) {
  const state = getShrimpRatingState(rating);
  const px = typeof size === 'number' ? size : SIZE_MAP[size] || SIZE_MAP.md;
  const label = ariaLabel || `Valutazione ${formatRating(state.value)} su 10`;

  const reduce = useReducedMotion();
  const mv = useMotionValue(animateValue && !reduce ? 0 : state.value);

  useEffect(() => {
    if (!animateValue || reduce) {
      mv.set(state.value);
      return undefined;
    }
    mv.set(0);
    const controls = animate(mv, state.value, { duration: FILL_MS, delay: valueDelay, ease: EASE.out });
    return controls.stop;
  }, [state.value, animateValue, reduce, valueDelay, mv]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      {...(decorative
        ? { 'aria-hidden': 'true' }
        : { role: 'img', 'aria-label': label })}
    >
      <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
        {state.fills.map((fill, i) =>
          animateValue && !reduce ? (
            <AnimatedShrimp key={i} px={px} mv={mv} index={i} />
          ) : (
            <Shrimp key={i} px={px} fill={fill} />
          ),
        )}
      </span>
      {showValue &&
        (animateValue ? (
          <AnimatedNumber
            value={state.value}
            duration={FILL_MS}
            delay={valueDelay}
            className={`tabular font-bold leading-none text-brown ${valueClassName}`}
          />
        ) : (
          <span className={`tabular font-bold leading-none text-brown ${valueClassName}`}>
            {formatRating(state.value)}
          </span>
        ))}
    </span>
  );
}
