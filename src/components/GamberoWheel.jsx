/**
 * La ruota (SVG) con il **Gambero Moscio al centro come selettore rotante**.
 *
 * - i segmenti sono FISSI, disegnati in senso orario da ore 12;
 * - il Gambero sta al centro e RUOTA: il suo "muso" (la faccia) punta verso il
 *   segmento selezionato. La matematica in `useGamberoWheel` calcola l'angolo
 *   così che il muso a ore 12 = segmento vincente.
 */

const C = 100;
const R = 94;

// Tonalità derivate dalla palette PNDR: tutte reggono testo in Warm Brown.
const TONES = ['#FFF9F1', '#E5EFD8'];
const ODD_TONE = '#F7E7CE';

// Offset che orienta l'asset: con questo valore il "muso" del Gambero punta
// verso l'alto (ore 12) quando rotation = 0, e verso il segmento vincente
// quando la matematica lo posiziona lì. Non è un hack sul calcolo: sposta solo
// il disegno dell'immagine, non l'angolo logico.
const SHRIMP_NOSE_DEG = 90;

const LEAD_WORD =
  /^(ristorante|trattoria|pizzeria|osteria|hosteria|paninoteca|agriturismo|antica|braceria)\s+/i;

function toneFor(i, n) {
  if (n % 2 === 1 && i === n - 1) return ODD_TONE;
  return TONES[i % 2];
}

function labelSpec(n) {
  if (n <= 4) return { max: 20, size: 8.6 };
  if (n <= 6) return { max: 17, size: 8 };
  if (n <= 9) return { max: 13, size: 7 };
  if (n <= 14) return { max: 10, size: 6.2 };
  return { max: 8, size: 5.6 };
}

function shortLabel(text, max) {
  let s = String(text || '').trim();
  const stripped = s.replace(LEAD_WORD, '');
  if (stripped.length >= 2) s = stripped;
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

const rad = (deg) => (deg * Math.PI) / 180;
const point = (cx, cy, r, angleDeg) => [
  cx + r * Math.sin(rad(angleDeg)),
  cy - r * Math.cos(rad(angleDeg)),
];

export default function GamberoWheel({
  items = [],
  rotation = 0,
  spinning = false,
  durationMs = 4600,
  ariaLabel,
}) {
  const n = items.length;
  const seg = n > 0 ? 360 / n : 360;
  const { max, size } = labelSpec(Math.max(n, 1));

  return (
    <div className="relative mx-auto aspect-square w-[min(86vw,340px)] sm:w-[360px] lg:w-[400px]">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full [filter:drop-shadow(0_12px_26px_rgba(58,42,34,0.16))]"
        role="img"
        aria-label={ariaLabel || (n > 0 ? `Ruota con ${n} opzioni` : 'Ruota vuota')}
      >
        {/* bordo esterno */}
        <circle cx={C} cy={C} r={R + 4} fill="#385C32" />

        {/* segmenti FISSI */}
        {n <= 1 ? (
          <circle
            cx={C}
            cy={C}
            r={R}
            fill={n === 1 ? TONES[0] : '#F0E6D5'}
            stroke="#FCF3E6"
            strokeWidth="1.5"
          />
        ) : (
          items.map((it, i) => {
            const a0 = i * seg;
            const a1 = (i + 1) * seg;
            const [x0, y0] = point(C, C, R, a0);
            const [x1, y1] = point(C, C, R, a1);
            const large = a1 - a0 > 180 ? 1 : 0;
            return (
              <path
                key={it.id}
                d={`M ${C} ${C} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(
                  3,
                )} ${y1.toFixed(3)} Z`}
                fill={toneFor(i, n)}
                stroke="#FCF3E6"
                strokeWidth="1.1"
              >
                <title>{it.label}</title>
              </path>
            );
          })
        )}

        {n > 1 &&
          items.map((it, i) => {
            const a = (i + 0.5) * seg;
            const flip = a > 90 && a < 270;
            const ly = C - R * 0.66;
            return (
              <g key={`${it.id}-label`} transform={`rotate(${a} ${C} ${C})`} aria-hidden="true">
                <text
                  x={C}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={flip ? `rotate(180 ${C} ${ly})` : undefined}
                  fontSize={size}
                  fontWeight="600"
                  fill="#3A2A22"
                  style={{ fontFamily: "'Karla', system-ui, -apple-system, sans-serif" }}
                >
                  {shortLabel(it.label, max)}
                </text>
              </g>
            );
          })}

        {/* alone del mozzo, per staccare il Gambero dai segmenti */}
        <circle cx={C} cy={C} r="30" fill="#FFF9F1" opacity="0.92" />
        <circle cx={C} cy={C} r="30" fill="none" stroke="#385C32" strokeOpacity="0.2" strokeWidth="1" />
      </svg>

      {/* IL GAMBERO: al centro, ruota come un selettore. Il muso indica il vincitore. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[42%]"
        style={{
          transform: `translate(-50%, -50%) rotate(${rotation + SHRIMP_NOSE_DEG}deg)`,
          transformOrigin: 'center',
          transition: spinning
            ? `transform ${durationMs}ms cubic-bezier(0.16, 0.86, 0.28, 1)`
            : 'none',
        }}
      >
        <img
          src="/shrimp.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
          className="h-full w-full select-none [filter:drop-shadow(0_4px_7px_rgba(58,42,34,0.28))]"
        />
      </div>

      {/* perno */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terracotta-deep ring-2 ring-cream-soft" />
    </div>
  );
}
