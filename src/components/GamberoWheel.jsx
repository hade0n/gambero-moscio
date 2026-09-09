/**
 * Quadrante del Food Picker.
 *
 * I segmenti sono fissi e iniziano da ore 12; il selettore ruota fino al
 * segmento scelto. I nomi non vengono compressi dentro la ruota: restano nella
 * lista esterna, dove sono leggibili su ogni schermo.
 */

const C = 100;
const R = 94;
const TONES = ['#FFF9F1', '#E5EFD8'];
const ODD_TONE = '#F7E7CE';

const rad = (deg) => (deg * Math.PI) / 180;
const point = (cx, cy, r, angleDeg) => [
  cx + r * Math.sin(rad(angleDeg)),
  cy - r * Math.cos(rad(angleDeg)),
];

function toneFor(index, count) {
  if (count % 2 === 1 && index === count - 1) return ODD_TONE;
  return TONES[index % 2];
}

export default function GamberoWheel({
  items = [],
  rotation = 0,
  spinning = false,
  durationMs = 4600,
  ariaLabel,
  centerTitle = 'Il Gambero',
  centerDetail = 'sceglie',
}) {
  const count = items.length;
  const segmentAngle = count > 0 ? 360 / count : 360;

  return (
    <div className="relative mx-auto aspect-square w-[min(82vw,312px)] sm:w-[340px] lg:w-[370px]">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full [filter:drop-shadow(0_10px_24px_rgba(58,42,34,0.12))]"
        role="img"
        aria-label={ariaLabel || (count > 0 ? `Quadrante con ${count} opzioni` : 'Quadrante vuoto')}
      >
        <circle cx={C} cy={C} r={R + 4} fill="#385C32" />

        {count <= 1 ? (
          <circle cx={C} cy={C} r={R} fill={count === 1 ? TONES[0] : '#F0E6D5'} />
        ) : (
          items.map((item, index) => {
            const start = index * segmentAngle;
            const end = (index + 1) * segmentAngle;
            const [x0, y0] = point(C, C, R, start);
            const [x1, y1] = point(C, C, R, end);
            return (
              <path
                key={item.id}
                d={`M ${C} ${C} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`}
                fill={toneFor(index, count)}
                stroke="#FCF3E6"
                strokeWidth="1.25"
              >
                <title>{item.label}</title>
              </path>
            );
          })
        )}

        <circle cx={C} cy={C} r="33" fill="#FFF9F1" opacity="0.96" />
        <circle cx={C} cy={C} r="33" fill="none" stroke="#385C32" strokeOpacity="0.18" strokeWidth="1" />
      </svg>

      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden="true"
      >
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '50% 50%',
            transition: spinning
              ? `transform ${durationMs}ms cubic-bezier(0.16, 0.86, 0.28, 1)`
              : 'none',
          }}
        >
          <line x1={C} y1={C} x2={C} y2="40" stroke="#6B564B" strokeWidth="2.25" strokeLinecap="round" />
          <circle cx={C} cy="40" r="3.5" fill="#5F8F3A" stroke="#FFF9F1" strokeWidth="1.5" />
        </g>
        <circle cx={C} cy={C} r="8.5" fill="#FFF9F1" stroke="#385C32" strokeOpacity="0.42" strokeWidth="1.5" />
      </svg>

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-[24%] text-center" aria-hidden="true">
        <div>
          <p className="font-display text-lg font-semibold leading-tight text-brown sm:text-xl">{centerTitle}</p>
          {centerDetail && (
            <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-brown-soft">
              {centerDetail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
