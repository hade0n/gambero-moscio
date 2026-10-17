/**
 * Illustrazioni vettoriali originali per "Il Banco del Gambero":
 * - Avatar dei cuochi giocabili (pelle, capelli, grembiule, accessori)
 * - Avatar dei clienti NPC (generati da seed deterministico)
 * - Illustrazioni ingredienti napoletani e icone UI (zero emoji strutturali)
 */
import {
  APRON_COLORS,
  HAIR_COLORS,
  normalizePlayerAvatar,
  SKIN_TONES,
} from '../data/characters.js';
import { getIngredient } from '../data/ingredients.js';

export function ChefAvatarSvg({ avatar, size = 64, className = '' }) {
  const clean = normalizePlayerAvatar(avatar);
  const skinHex = SKIN_TONES.find((s) => s.id === clean.skinTone)?.hex || '#E3B18A';
  const hairHex = HAIR_COLORS.find((h) => h.id === clean.hairColor)?.hex || '#543526';
  const apronHex = APRON_COLORS.find((a) => a.id === clean.apronColor)?.hex || '#D96B32';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Sfondo medaglione */}
      <circle cx="40" cy="40" r="38" fill="#FFF3E2" stroke="#3A2A22" strokeOpacity="0.18" strokeWidth="2" />

      {/* Spalle + Maglia */}
      <path d="M16 72C18 57 28 52 40 52C52 52 62 57 64 72H16Z" fill="#FFF9F1" stroke="#3A2A22" strokeWidth="2" />

      {/* Grembiule */}
      <path d="M25 54H55L58 72H22L25 54Z" fill={apronHex} stroke="#3A2A22" strokeWidth="2" />
      <path d="M30 52V45M50 52V45" stroke={apronHex} strokeWidth="3" strokeLinecap="round" />

      {/* Accessorio: Foulard */}
      {clean.accessory === 'foulard' && (
        <path d="M31 48Q40 55 49 48L53 56L40 53L27 56L31 48Z" fill="#B23B2E" stroke="#3A2A22" strokeWidth="1.5" />
      )}

      {/* Collo e Viso */}
      <rect x="35" y="42" width="10" height="9" rx="4" fill={skinHex} />
      <ellipse cx="40" cy="33" rx="15" ry="16" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />

      {/* Capelli */}
      {clean.hairStyle === 'ricci' && (
        <path
          d="M24 31C22 22 29 14 40 14C51 14 58 22 56 31C53 26 48 23 40 23C32 23 27 26 24 31Z"
          fill={hairHex}
          stroke="#3A2A22"
          strokeWidth="1.8"
        />
      )}
      {clean.hairStyle === 'corti' && (
        <path
          d="M25 29C25 19 32 15 40 15C48 15 55 19 55 29C51 24 45 22 40 22C35 22 29 24 25 29Z"
          fill={hairHex}
          stroke="#3A2A22"
          strokeWidth="1.8"
        />
      )}
      {clean.hairStyle === 'chignon' && (
        <>
          <circle cx="40" cy="13" r="7" fill={hairHex} stroke="#3A2A22" strokeWidth="1.8" />
          <path
            d="M25 30C26 20 32 16 40 16C48 16 54 20 55 30C50 24 45 23 40 23C35 23 30 24 25 30Z"
            fill={hairHex}
            stroke="#3A2A22"
            strokeWidth="1.8"
          />
        </>
      )}
      {clean.hairStyle === 'bandana' && (
        <>
          <path
            d="M25 28C26 19 32 16 40 16C48 16 54 19 55 28H25Z"
            fill={hairHex}
          />
          <path
            d="M24 26C28 21 52 21 56 26L55 30C50 26 30 26 25 30L24 26Z"
            fill="#D96B32"
            stroke="#3A2A22"
            strokeWidth="1.6"
          />
        </>
      )}

      {/* Occhi e sorriso caldo */}
      <circle cx="34.5" cy="33" r="2" fill="#3A2A22" />
      <circle cx="45.5" cy="33" r="2" fill="#3A2A22" />
      <path d="M35 40Q40 44 45 40" stroke="#3A2A22" strokeWidth="2" strokeLinecap="round" />

      {/* Accessorio: Occhiali tondi */}
      {clean.accessory === 'occhiali' && (
        <g stroke="#3A2A22" strokeWidth="1.8" fill="none">
          <circle cx="34" cy="33" r="4.8" />
          <circle cx="46" cy="33" r="4.8" />
          <line x1="38.8" y1="33" x2="41.2" y2="33" />
        </g>
      )}

      {/* Accessorio: Cappello da chef */}
      {clean.accessory === 'cappello_chef' && (
        <path
          d="M27 21C25 13 31 8 40 8C49 8 55 13 53 21H27Z"
          fill="#FFF9F1"
          stroke="#3A2A22"
          strokeWidth="2"
        />
      )}

      {/* Accessorio: Rametto di basilico */}
      {clean.accessory === 'rametto_basilico' && (
        <g transform="translate(50, 18)">
          <ellipse cx="4" cy="4" rx="5" ry="3" transform="rotate(-25 4 4)" fill="#5F8F3A" stroke="#3A2A22" strokeWidth="1.4" />
          <ellipse cx="9" cy="7" rx="4" ry="2.5" transform="rotate(15 9 7)" fill="#487A2E" stroke="#3A2A22" strokeWidth="1.4" />
        </g>
      )}
    </svg>
  );
}

export function CustomerAvatarSvg({ appearance = {}, size = 48, className = '' }) {
  const skinHex = appearance.skinHex || '#E3B18A';
  const hairHex = appearance.hairHex || '#3A2A22';
  const jacketHex = appearance.jacketHex || '#4A6B82';
  const hairStyle = appearance.hairStyle || 'corti';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="#FFF9F1" stroke="#3A2A22" strokeOpacity="0.16" strokeWidth="2" />
      <path d="M12 58C14 46 22 42 32 42C42 42 50 46 52 58H12Z" fill={jacketHex} stroke="#3A2A22" strokeWidth="1.8" />
      {appearance.hasBag && (
        <line x1="21" y1="44" x2="41" y2="58" stroke="#3A2A22" strokeWidth="3" strokeLinecap="round" />
      )}
      <ellipse cx="32" cy="27" rx="12" ry="13" fill={skinHex} stroke="#3A2A22" strokeWidth="1.8" />
      {hairStyle === 'chignon' && (
        <circle cx="32" cy="11" r="5.5" fill={hairHex} stroke="#3A2A22" strokeWidth="1.5" />
      )}
      <path
        d="M20 24C21 15 26 12 32 12C38 12 43 15 44 24C40 19 36 18 32 18C28 18 24 19 20 24Z"
        fill={hairHex}
        stroke="#3A2A22"
        strokeWidth="1.6"
      />
      <circle cx="27.5" cy="27" r="1.7" fill="#3A2A22" />
      <circle cx="36.5" cy="27" r="1.7" fill="#3A2A22" />
      <path d="M28 33Q32 36 36 33" stroke="#3A2A22" strokeWidth="1.8" strokeLinecap="round" />
      {appearance.hasGlasses && (
        <g stroke="#3A2A22" strokeWidth="1.5" fill="none">
          <circle cx="27.5" cy="27" r="3.8" />
          <circle cx="36.5" cy="27" r="3.8" />
          <line x1="31.3" y1="27" x2="32.7" y2="27" />
        </g>
      )}
    </svg>
  );
}

export function IngredientIconSvg({ ingredientId, size = 28, className = '' }) {
  const ing = getIngredient(ingredientId);
  const color = ing?.color || '#D96B32';
  const accent = ing?.accentColor || '#FFF3E2';
  const category = ing?.category || 'other';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {category === 'bread' && (
        <>
          <path
            d="M5 18C5 11 10 7 16 7C22 7 27 11 27 18H5Z"
            fill={color}
            stroke="#3A2A22"
            strokeWidth="1.8"
          />
          <rect x="6" y="18" width="20" height="6" rx="3" fill={accent} stroke="#3A2A22" strokeWidth="1.8" />
        </>
      )}
      {category === 'protein' && (
        <>
          <rect x="5" y="10" width="22" height="12" rx="6" fill={color} stroke="#3A2A22" strokeWidth="1.8" />
          <line x1="10" y1="12" x2="13" y2="20" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="12" x2="19" y2="20" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <line x1="21" y1="12" x2="23" y2="19" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {category === 'cheese' && (
        <path
          d="M6 12L26 9L24 23L8 21L6 12Z"
          fill={color}
          stroke="#3A2A22"
          strokeWidth="1.8"
        />
      )}
      {category === 'vegetable' && (
        <>
          <circle cx="14" cy="16" r="7" fill={color} stroke="#3A2A22" strokeWidth="1.8" />
          <circle cx="20" cy="15" r="6" fill={accent} stroke="#3A2A22" strokeWidth="1.6" />
        </>
      )}
      {category === 'specialty' && (
        <rect x="6" y="9" width="20" height="14" rx="7" fill={color} stroke="#3A2A22" strokeWidth="1.8" />
      )}
      {category === 'sauce' && (
        <path
          d="M16 5C21 12 24 16 24 20C24 24.4 20.4 27 16 27C11.6 27 8 24.4 8 20C8 16 11 12 16 5Z"
          fill={color}
          stroke="#3A2A22"
          strokeWidth="1.8"
        />
      )}
    </svg>
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
