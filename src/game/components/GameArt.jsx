/**
 * Sistema di illustrazioni 2.5D per "Il Banco del Gambero" (`/game`):
 * - `ChefAvatarSvg` — Personaggi cuoco a mezzo busto (Gennaro, Chiara, Tano, Sofia + custom) con divisa, grembiule, bandana/toque e badge ruolo
 * - `CustomerAvatarSvg` — Clienti adulti stilizzati a mezzo busto con pose ed espressioni legate alla pazienza (`happy`, `thinking`, `impatient`, `angry`, `ready`)
 * - `IngredientIconSvg` — 23 illustrazioni 2.5D ricche di profondità e texture per tutti gli ID in `ingredients.js`
 * - `RecipePlateSvg` — Piatti finiti su ceramica vietrese dal manifest `/game/art/recipes/`
 * - `GrillBurnerSvg` — Fuoco della piastra in ghisa 2.5D con stati Crudo / Sfrigola / Pronto / Quasi bruciato / Bruciato
 * - `SandwichStackSvg` — Tagliere in legno 2.5D con panino stratificato che cresce visivamente + rimozione rapida errori
 * - `GameUiIcon` — Set unico di icone SVG lineari (zero emoji strutturali)
 */
import {
  APRON_COLORS,
  getBrigadeRole,
  HAIR_COLORS,
  normalizePlayerAvatar,
  SKIN_TONES,
} from '../data/characters.js';
import { COOK_STATES, getIngredient } from '../data/ingredients.js';
import { getIngredientArtUrl, getRecipeArtUrl } from '../data/artManifest.js';
import { inspectBoardAgainstTicket } from '../engine/gameEngine.js';

export function ChefAvatarSvg({
  avatar,
  size = 64,
  showRoleBadge = false,
  className = '',
}) {
  const clean = normalizePlayerAvatar(avatar);
  const skinHex = SKIN_TONES.find((s) => s.id === clean.skinTone)?.hex || '#E3B18A';
  const hairHex = HAIR_COLORS.find((h) => h.id === clean.hairColor)?.hex || '#543526';
  const apronHex = APRON_COLORS.find((a) => a.id === clean.apronColor)?.hex || '#D96B32';
  const roleObj = getBrigadeRole(clean.role);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="overflow-visible drop-shadow-xs"
      >
        {/* Ombra morbida sotto il busto */}
        <ellipse cx="60" cy="122" rx="42" ry="6" fill="#3A2A22" fillOpacity="0.18" />

        {/* Spalle + Casacca da cucina doppiopetto */}
        <path
          d="M16 122C19 90 35 78 60 78C85 78 101 90 104 122H16Z"
          fill="#FFFDF9"
          stroke="#3A2A22"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Colletto casacca */}
        <path
          d="M44 78L60 94L76 78"
          fill="#F4E8D6"
          stroke="#3A2A22"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Grembiule da banco con bretelle e tasca */}
        <path
          d="M33 84H87L92 122H28L33 84Z"
          fill={apronHex}
          stroke="#3A2A22"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d="M42 84V72M78 84V72"
          stroke={apronHex}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M42 84V72M78 84V72"
          stroke="#3A2A22"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <rect
          x="43"
          y="98"
          width="34"
          height="16"
          rx="4"
          fill="#FFF9F1"
          fillOpacity="0.32"
          stroke="#3A2A22"
          strokeWidth="1.8"
        />

        {/* Accessorio: Foulard da brigata */}
        {clean.accessory === 'foulard' && (
          <path
            d="M42 76Q60 88 78 76L83 91L60 84L37 91L42 76Z"
            fill="#B23B2E"
            stroke="#3A2A22"
            strokeWidth="2"
          />
        )}

        {/* Collo e Orecchie */}
        <rect
          x="51"
          y="64"
          width="18"
          height="16"
          rx="6"
          fill={skinHex}
          stroke="#3A2A22"
          strokeWidth="2.2"
        />
        <circle cx="34" cy="50" r="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2.2" />
        <circle cx="86" cy="50" r="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2.2" />

        {/* Volto espressivo */}
        <ellipse
          cx="60"
          cy="48"
          rx="24"
          ry="26"
          fill={skinHex}
          stroke="#3A2A22"
          strokeWidth="2.8"
        />
        <circle cx="43" cy="54" r="4.5" fill="#D96B32" fillOpacity="0.28" />
        <circle cx="77" cy="54" r="4.5" fill="#D96B32" fillOpacity="0.28" />

        {/* Acconciature */}
        {clean.hairStyle === 'chignon' && (
          <circle cx="60" cy="14" r="11.5" fill={hairHex} stroke="#3A2A22" strokeWidth="2.5" />
        )}
        {clean.hairStyle === 'ricci' ? (
          <path
            d="M32 43C28 24 41 13 60 13C79 13 92 24 88 43C81 32 72 28 60 28C48 28 39 32 32 43Z"
            fill={hairHex}
            stroke="#3A2A22"
            strokeWidth="2.6"
          />
        ) : (
          <path
            d="M35 41C36 23 46 16 60 16C74 16 84 23 85 41C77 32 69 29 60 29C51 29 43 32 35 41Z"
            fill={hairHex}
            stroke="#3A2A22"
            strokeWidth="2.6"
          />
        )}

        {clean.hairStyle === 'bandana' && (
          <path
            d="M34 34C42 25 78 25 86 34L84 42C74 35 46 35 36 42L34 34Z"
            fill="#D96B32"
            stroke="#3A2A22"
            strokeWidth="2.2"
          />
        )}

        {/* Sopracciglia, occhi con punto luce, naso e sorriso */}
        <path d="M45 41Q50 38 55 41" stroke="#3A2A22" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M65 41Q70 38 75 41" stroke="#3A2A22" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="50" cy="48" r="3.6" fill="#3A2A22" />
        <circle cx="70" cy="48" r="3.6" fill="#3A2A22" />
        <circle cx="48.8" cy="46.8" r="1.2" fill="#FFF9F1" />
        <circle cx="68.8" cy="46.8" r="1.2" fill="#FFF9F1" />
        <path
          d="M60 48L58 55L62 56"
          stroke="#3A2A22"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M51 60Q60 67 69 60"
          stroke="#3A2A22"
          strokeWidth="2.6"
          strokeLinecap="round"
        />

        {/* Accessorio: Occhiali */}
        {clean.accessory === 'occhiali' && (
          <g stroke="#3A2A22" strokeWidth="2.2" fill="#FFF9F1" fillOpacity="0.18">
            <circle cx="49.5" cy="48" r="7.5" />
            <circle cx="70.5" cy="48" r="7.5" />
            <line x1="57" y1="48" x2="63" y2="48" />
          </g>
        )}

        {/* Accessorio: Toque da chef */}
        {clean.accessory === 'cappello_chef' && (
          <path
            d="M37 29C33 12 43 3 60 3C77 3 87 12 83 29H37Z"
            fill="#FFFDF9"
            stroke="#3A2A22"
            strokeWidth="2.6"
          />
        )}

        {/* Accessorio: Rametto di basilico */}
        {clean.accessory === 'rametto_basilico' && (
          <g transform="translate(76, 18)">
            <ellipse
              cx="6"
              cy="6"
              rx="8.5"
              ry="5"
              transform="rotate(-25 6 6)"
              fill="#5F8F3A"
              stroke="#3A2A22"
              strokeWidth="1.8"
            />
            <ellipse
              cx="14"
              cy="10"
              rx="7"
              ry="4"
              transform="rotate(15 14 10)"
              fill="#487A2E"
              stroke="#3A2A22"
              strokeWidth="1.8"
            />
          </g>
        )}
      </svg>

      {showRoleBadge && (
        <span
          className={`absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white px-2 py-0.5 text-[10px] font-extrabold shadow-xs ${roleObj.badgeClass}`}
        >
          {roleObj.shortLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Determina l'umore visivo del cliente in base a `isThinking`, `isReady` e alla frazione di pazienza.
 */
export function getCustomerMood(patienceRatio = 1, isThinking = false, isReady = false) {
  if (isReady) return 'ready';
  if (isThinking) return 'thinking';
  if (patienceRatio > 0.55) return 'happy';
  if (patienceRatio > 0.28) return 'impatient';
  return 'angry';
}

export function CustomerAvatarSvg({
  appearance = {},
  patienceRatio = 1,
  isThinking = false,
  isReady = false,
  archetypeId = '',
  size = 56,
  className = '',
}) {
  const skinHex = appearance.skinHex || '#E3B18A';
  const hairHex = appearance.hairHex || '#3A2A22';
  const jacketHex = appearance.jacketHex || '#4A6B82';
  const hairStyle = appearance.hairStyle || 'corti';
  const mood = getCustomerMood(patienceRatio, isThinking, isReady);

  const statusColor =
    mood === 'ready'
      ? '#5F8F3A'
      : mood === 'thinking'
        ? '#6B564B'
        : mood === 'happy'
          ? '#5F8F3A'
          : mood === 'impatient'
            ? '#E39A2D'
            : '#B23B2E';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-visible shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Halo discreto di stato dietro le spalle */}
      <ellipse
        cx="60"
        cy="66"
        rx="48"
        ry="50"
        fill={
          mood === 'angry'
            ? '#FDECEC'
            : mood === 'impatient'
              ? '#FFF6E3'
              : mood === 'ready'
                ? '#E9F5E1'
                : '#FFF9F1'
        }
        stroke={statusColor}
        strokeWidth="3"
      />

      {/* Busto e giacca articolata */}
      <path
        d="M18 118C21 88 36 76 60 76C84 76 99 88 102 118H18Z"
        fill={jacketHex}
        stroke="#3A2A22"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M46 76L60 98L74 76Z"
        fill="#FFF9F1"
        stroke="#3A2A22"
        strokeWidth="2"
      />
      {/* Mani appoggiate al bancone */}
      <ellipse cx="34" cy="116" rx="8.5" ry="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />
      <ellipse cx="86" cy="116" rx="8.5" ry="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />

      {appearance.hasBag && (
        <line
          x1="34"
          y1="80"
          x2="78"
          y2="116"
          stroke="#3A2A22"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      )}

      {/* Collo, orecchie e viso */}
      <rect x="52" y="62" width="16" height="16" rx="6" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />
      <circle cx="35" cy="48" r="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />
      <circle cx="85" cy="48" r="5.5" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />
      <ellipse cx="60" cy="46" rx="23" ry="25" fill={skinHex} stroke="#3A2A22" strokeWidth="2.8" />
      <circle cx="44" cy="52" r="4.5" fill="#D96B32" fillOpacity="0.25" />
      <circle cx="76" cy="52" r="4.5" fill="#D96B32" fillOpacity="0.25" />

      {/* Capelli */}
      {hairStyle === 'chignon' && (
        <circle cx="60" cy="13" r="11" fill={hairHex} stroke="#3A2A22" strokeWidth="2.4" />
      )}
      <path
        d="M34 40C35 22 45 14 60 14C75 14 85 22 86 40C78 30 69 27 60 27C51 27 42 30 34 40Z"
        fill={hairHex}
        stroke="#3A2A22"
        strokeWidth="2.5"
      />

      {/* Espressione sopracciglia */}
      {mood === 'angry' ? (
        <>
          <line x1="43" y1="36" x2="54" y2="41" stroke="#B23B2E" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="77" y1="36" x2="66" y2="41" stroke="#B23B2E" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M90 24L99 19M92 31L101 29" stroke="#B23B2E" strokeWidth="2.8" strokeLinecap="round" />
        </>
      ) : mood === 'impatient' ? (
        <>
          <line x1="44" y1="38" x2="54" y2="40" stroke="#3A2A22" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="66" y1="40" x2="76" y2="38" stroke="#3A2A22" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M44 39Q49 35 54 39" stroke="#3A2A22" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M66 39Q71 35 76 39" stroke="#3A2A22" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      {mood === 'thinking' && (
        <>
          <circle cx="91" cy="26" r="3.2" fill="#FFF9F1" stroke="#3A2A22" strokeWidth="1.8" />
          <circle cx="99" cy="17" r="5.2" fill="#FFF9F1" stroke="#3A2A22" strokeWidth="1.8" />
        </>
      )}

      {/* Occhi e Naso */}
      <circle cx="50" cy="46" r="3.6" fill="#3A2A22" />
      <circle cx="70" cy="46" r="3.6" fill="#3A2A22" />
      <circle cx="48.8" cy="44.8" r="1.2" fill="#FFF9F1" />
      <circle cx="68.8" cy="44.8" r="1.2" fill="#FFF9F1" />
      <path d="M60 46L58 53L62 54" stroke="#3A2A22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Bocca dinamica */}
      {mood === 'ready' && (
        <path d="M50 57Q60 68 70 57Z" fill="#B23B2E" stroke="#3A2A22" strokeWidth="2" />
      )}
      {mood === 'happy' && (
        <path d="M51 58Q60 65 69 58" stroke="#3A2A22" strokeWidth="2.6" strokeLinecap="round" />
      )}
      {mood === 'thinking' && <circle cx="62" cy="59" r="3.2" fill="#3A2A22" />}
      {mood === 'impatient' && (
        <line x1="51" y1="60" x2="69" y2="59" stroke="#3A2A22" strokeWidth="2.6" strokeLinecap="round" />
      )}
      {mood === 'angry' && (
        <path d="M51 62Q60 55 69 62" stroke="#B23B2E" strokeWidth="2.8" strokeLinecap="round" />
      )}

      {appearance.hasGlasses && (
        <g stroke="#3A2A22" strokeWidth="2" fill="#FFF9F1" fillOpacity="0.16">
          <circle cx="50" cy="46" r="7.2" />
          <circle cx="70" cy="46" r="7.2" />
          <line x1="57.2" y1="46" x2="62.8" y2="46" />
        </g>
      )}

      {/* Badge archetipo in basso a destra */}
      {archetypeId === 'di_fretta' && (
        <g transform="translate(84, 86)">
          <circle cx="14" cy="14" r="13" fill="#D96B32" stroke="#FFF9F1" strokeWidth="2" />
          <path d="M15 6L9 15H14L12 22L19 13H14L15 6Z" fill="#FFF9F1" />
        </g>
      )}
      {archetypeId === 'senza_cipolla' && (
        <g transform="translate(84, 86)">
          <circle cx="14" cy="14" r="13" fill="#B23B2E" stroke="#FFF9F1" strokeWidth="2" />
          <line x1="8" y1="14" x2="20" y2="14" stroke="#FFF9F1" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      )}
      {archetypeId === 'ordine_doppio' && (
        <g transform="translate(80, 88)">
          <rect x="0" y="0" width="32" height="22" rx="11" fill="#BB5A20" stroke="#FFF9F1" strokeWidth="2" />
          <text
            x="16"
            y="15"
            textAnchor="middle"
            fill="#FFF9F1"
            fontSize="12"
            fontWeight="bold"
            fontFamily="Karla, sans-serif"
          >
            ×2
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Illustrazione 2.5D per ognuno dei 23 ingredienti (usa l'asset pack `/game/art/ingredients/`).
 */
export function IngredientIconSvg({
  ingredientId,
  cookState = null,
  size = 34,
  className = '',
}) {
  const artUrl = getIngredientArtUrl(ingredientId, cookState);
  const ing = getIngredient(ingredientId);

  if (artUrl) {
    return (
      <img
        src={artUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        className={`inline-block shrink-0 object-contain select-none pointer-events-none ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="18"
        cy="18"
        r="13"
        fill={ing?.color || '#D96B32'}
        stroke="#3A2A22"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Piatto finito illustrato in 2.5D per le 8 ricette in `recipes.js`.
 */
export function RecipePlateSvg({ recipeId, size = 64, className = '' }) {
  const url = getRecipeArtUrl(recipeId);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={Math.round(size * 0.875)}
      loading="eager"
      decoding="async"
      className={`inline-block shrink-0 object-contain select-none pointer-events-none ${className}`}
      style={{ width: size, height: Math.round(size * 0.875) }}
    />
  );
}

/**
 * Fuoco della Piastra in Ghisa 2.5D con indicatore non solo cromatico (forma, texture, icona stato).
 */
export function GrillBurnerSvg({
  ingredientId = null,
  cookState = COOK_STATES.RAW,
  aboutToBurn = false,
  size = 56,
}) {
  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Piastra in ghisa pesante con nervature */}
        <rect
          x="4"
          y="8"
          width="64"
          height="56"
          rx="14"
          fill="#231B18"
          stroke={
            !ingredientId
              ? '#5A473E'
              : cookState === COOK_STATES.BURNED
                ? '#B23B2E'
                : aboutToBurn
                  ? '#FF6B4A'
                  : cookState === COOK_STATES.COOKED
                    ? '#5F8F3A'
                    : '#E39A2D'
          }
          strokeWidth="3"
        />
        {/* Griglia in ghisa */}
        <line x1="16" y1="15" x2="16" y2="57" stroke="#382C27" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="29" y1="15" x2="29" y2="57" stroke="#382C27" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="43" y1="15" x2="43" y2="57" stroke="#382C27" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="56" y1="15" x2="56" y2="57" stroke="#382C27" strokeWidth="3.2" strokeLinecap="round" />

        {/* Bagliore brace sotto la griglia quando acceso */}
        {ingredientId && cookState !== COOK_STATES.BURNED && (
          <ellipse
            cx="36"
            cy="38"
            rx="22"
            ry="14"
            fill={aboutToBurn ? '#FF5238' : cookState === COOK_STATES.COOKED ? '#76B054' : '#FF9E3B'}
            fillOpacity="0.24"
          />
        )}

        {!ingredientId && (
          <circle
            cx="36"
            cy="36"
            r="11"
            stroke="#6E5A4F"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}
      </svg>

      {ingredientId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <IngredientIconSvg
            ingredientId={ingredientId}
            cookState={cookState}
            size={Math.round(size * 0.76)}
          />
        </div>
      )}

      {/* Badge non-solo-colore (✓ pronto, ! attenzione brucia, ✕ bruciato) */}
      {ingredientId && cookState === COOK_STATES.COOKED && !aboutToBurn && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green text-[11px] font-extrabold text-white ring-2 ring-white">
          ✓
        </span>
      )}
      {ingredientId && cookState === COOK_STATES.COOKED && aboutToBurn && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[11px] font-extrabold text-white ring-2 ring-white">
          !
        </span>
      )}
      {ingredientId && cookState === COOK_STATES.BURNED && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brown text-[11px] font-extrabold text-white ring-2 ring-danger">
          ✕
        </span>
      )}
    </div>
  );
}

/**
 * Tagliere di assemblaggio 2.5D in legno d'ulivo con pila visuale degli strati del panino
 * e chip interattive per rimuovere al volo un eventuale ingrediente errato.
 */
export function SandwichStackSvg({ boardIngredients = [], ticket = null, onRemoveLayer }) {
  const analysis = inspectBoardAgainstTicket(boardIngredients, ticket);
  const layers = analysis.assembledLayers;

  return (
    <div className="relative rounded-2xl border border-brown/20 bg-gradient-to-b from-cream/90 to-cream-soft p-3 shadow-2xs">
      {/* Intestazione stato tagliere */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brown-soft">
          Tagliere in legno ({layers.length} {layers.length === 1 ? 'strato' : 'strati'})
        </span>
        {analysis.status === 'ready_to_serve' && (
          <span className="rounded-full bg-green px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-2xs">
            ✓ Ricetta perfetta!
          </span>
        )}
        {analysis.status === 'has_errors' && (
          <span className="rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-2xs">
            ⚠ Rimuovi ingrediente in rosso
          </span>
        )}
      </div>

      {/* Rappresentazione visuale 2.5D del tagliere e del panino che cresce */}
      <div className="relative mx-auto flex h-28 w-full max-w-[260px] items-center justify-center overflow-hidden rounded-xl bg-brown/5">
        <svg
          viewBox="0 0 240 110"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Ombra e tagliere in legno con manico */}
          <ellipse cx="120" cy="92" rx="92" ry="14" fill="#3A2A22" fillOpacity="0.18" />
          <ellipse cx="120" cy="87" rx="88" ry="14" fill="#B87D4B" stroke="#3A2A22" strokeWidth="2.5" />
          <ellipse cx="120" cy="84" rx="82" ry="11" fill="#D9A36C" stroke="#8C582B" strokeWidth="1.5" />
          {/* Carta paglia sul tagliere */}
          <polygon
            points="64,84 120,73 176,84 120,94"
            fill="#F7E4BC"
            stroke="#C6985A"
            strokeWidth="1.2"
          />
        </svg>

        {layers.length === 0 ? (
          <p className="absolute inset-x-4 bottom-2 text-center text-[11px] font-semibold text-brown-soft">
            Tagliere vuoto · Tocca gli ingredienti con <strong>★ Serve</strong>
          </p>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {layers.slice(0, 8).map((layer, idx) => (
              <div
                key={`vis-${layer.ingredientId}-${layer.index}`}
                className="absolute transition-transform duration-150"
                style={{
                  transform: `translateY(${22 - idx * 8}px) scale(${layer.isExtra ? 1.05 : 1})`,
                  zIndex: idx + 1,
                }}
              >
                <IngredientIconSvg ingredientId={layer.ingredientId} size={58} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chip interattive degli strati (per rimuovere qualsiasi ingrediente con 1 tocco) */}
      {layers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-brown/10">
          {layers.map((layer) => {
            const ing = getIngredient(layer.ingredientId);
            return (
              <button
                key={`${layer.ingredientId}-${layer.index}`}
                type="button"
                onClick={() => onRemoveLayer?.(layer.index)}
                title={
                  layer.isExtra
                    ? `Ingrediente NON richiesto dal cliente (${ing?.shortName}). Tocca per rimuovere!`
                    : `Tocca per togliere ${ing?.shortName}`
                }
                className={`press inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 text-xs font-bold min-h-[38px] ${
                  layer.isExtra
                    ? 'border-danger bg-danger/15 text-danger ring-2 ring-danger/30'
                    : 'border-brown/20 bg-white text-brown hover:border-terracotta'
                }`}
              >
                <IngredientIconSvg ingredientId={layer.ingredientId} size={22} />
                <span>{ing?.shortName || layer.ingredientId}</span>
                {layer.isExtra && (
                  <span className="rounded-sm bg-danger px-1 py-0.5 text-[10px] font-extrabold text-white">
                    ERRATO
                  </span>
                )}
                <span className="text-danger font-extrabold ml-0.5">×</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GameUiIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {name === 'flame' && (
        <path d="M12 2c1.5 3.5 4 5.5 4 9a4 4 0 1 1-8 0c0-2 1-3.5 2-5.5 1 1.5 2 2 2-3.5Z" />
      )}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </>
      )}
      {name === 'users' && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === 'copy' && (
        <>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
      {name === 'check' && <polyline points="20 6 9 17 4 12" />}
      {name === 'volume-on' && (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
      {name === 'volume-off' && (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
      {name === 'bell' && (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      )}
      {name === 'undo' && (
        <>
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </>
      )}
      {name === 'trash' && (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      )}
      {name === 'arrow-left' && (
        <>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </>
      )}
      {name === 'sparkle' && (
        <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z" />
      )}
    </svg>
  );
}
