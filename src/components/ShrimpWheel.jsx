/**
 * La ruota vera e propria (SVG) + il Gambero Moscio come lancetta FISSA.
 *
 * Convenzioni (devono restare allineate a `useShrimpWheel`):
 *  - segmenti disegnati in senso ORARIO da ore 12;
 *  - il gruppo dei segmenti ruota di `rotation` gradi (positivo = orario);
 *  - il Gambero sta fuori dal gruppo che ruota: resta fermo a ore 12.
 */

const C = 100;
const R = 95;

// Tonalità derivate dalla palette PNDR: tutte reggono testo in Warm Brown.
const TONES = ['#FFF9F1', '#E5EFD8']; // cream-soft, verde chiaro
const ODD_TONE = '#F7E7CE'; // tan chiaro (solo per l'ultimo segmento se n è dispari)

const LEAD_WORD =
  /^(ristorante|trattoria|pizzeria|osteria|hosteria|paninoteca|agriturismo|locanda|bottega|antica)\s+/i;

function toneFor(i, n) {
  if (n % 2 === 1 && i === n - 1) return ODD_TONE;
  return TONES[i % 2];
}

function labelSpec(n) {
  if (n <= 4) return { max: 18, size: 10.5 };
  if (n <= 6) return { max: 14, size: 9 };
  if (n <= 9) return { max: 11, size: 8 };
  if (n <= 14) return { max: 9, size: 7 };
  return { max: 6, size: 6.2 };
}

function shortLabel(name, max) {
  let s = String(name || '').trim();
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

export default function ShrimpWheel({
  restaurants = [],
  rotation = 0,
  spinning = false,
  durationMs = 4800,
}) {
  const n = restaurants.length;
  const seg = n > 0 ? 360 / n : 360;
  const { max, size } = labelSpec(Math.max(n, 1));

  return (
    <div className="relative mx-auto aspect-square w-[min(84vw,320px)] sm:w-[352px] lg:w-[392px]">
      {/* Lancetta: il Gambero Moscio. Fisso a ore 12, NON ruota con la ruota. */}
      <div
        className={`shrimp-pointer pointer-events-none absolute left-1/2 top-0 z-20 w-[27%] -translate-x-1/2 -translate-y-[38%]${
          spinning ? ' is-spinning' : ''
        }`}
      >
        <img
          src="/shrimp.svg"
          alt=""
          aria-hidden="true"
          draggable="false"
          className="h-full w-full select-none [filter:drop-shadow(0_4px_6px_rgba(58,42,34,0.22))]"
          style={{ transform: 'rotate(215deg)' }}
        />
      </div>

      <svg
        viewBox="0 0 200 200"
        className="h-full w-full [filter:drop-shadow(0_10px_22px_rgba(58,42,34,0.14))]"
        role="img"
        aria-label={
          n > 0
            ? `Ruota della fortuna con ${n} ${n === 1 ? 'locale' : 'locali'}`
            : 'Ruota della fortuna, nessun locale'
        }
      >
        {/* cerchio esterno */}
        <circle cx={C} cy={C} r={R + 3.5} fill="#385C32" />

        <g
          style={{
            transformBox: 'view-box',
            transformOrigin: '100px 100px',
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${durationMs}ms cubic-bezier(0.16, 0.86, 0.28, 1)`
              : 'none',
          }}
        >
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
            restaurants.map((r, i) => {
              const a0 = i * seg;
              const a1 = (i + 1) * seg;
              const [x0, y0] = point(C, C, R, a0);
              const [x1, y1] = point(C, C, R, a1);
              const large = a1 - a0 > 180 ? 1 : 0;
              return (
                <path
                  key={r.id}
                  d={`M ${C} ${C} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(
                    3,
                  )} ${y1.toFixed(3)} Z`}
                  fill={toneFor(i, n)}
                  stroke="#FCF3E6"
                  strokeWidth="1.1"
                >
                  <title>{r.name}</title>
                </path>
              );
            })
          )}

          {n > 1 &&
            restaurants.map((r, i) => {
              const a = (i + 0.5) * seg;
              const flip = a > 90 && a < 270;
              const ly = C - R * 0.62;
              return (
                <g key={`${r.id}-label`} transform={`rotate(${a} ${C} ${C})`} aria-hidden="true">
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
                    {shortLabel(r.name, max)}
                  </text>
                </g>
              );
            })}
        </g>

        {/* mozzo centrale */}
        <circle cx={C} cy={C} r="12" fill="#BB5A20" stroke="#FFF9F1" strokeWidth="3" />
      </svg>
    </div>
  );
}
