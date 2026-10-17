/**
 * Sistema completo di illustrazioni vettoriali originali per "Il Banco del Gambero":
 * 1. `ChefAvatarSvg` — Cuochi giocabili (carnagione, acconciatura, grembiule, accessorio, badge ruolo)
 * 2. `CustomerAvatarSvg` — Clienti NPC con espressione facciale dinamica legata alla pazienza
 *    (`happy`, `focused`, `impatient`, `angry`, `thinking`) e indicatore archetipo
 * 3. `IngredientIconSvg` — 21 illustrazioni dedicate e distinte (una silhouette unica per ciascuno
 *    dei 21 ingredienti napoletani, ad alto contrasto su sfondi crema/bianchi)
 * 4. `GrillBurnerSvg` — Fuoco della piastra in ghisa con stato Crudo / Sfrigola / Pronto / Rischio / Bruciato
 * 5. `SandwichStackSvg` — Visualizzatore del panino in costruzione sul tagliere in legno
 * 6. `GameUiIcon` — Icone vettoriali di interfaccia (zero emoji)
 */
import {
  APRON_COLORS,
  getBrigadeRole,
  HAIR_COLORS,
  normalizePlayerAvatar,
  SKIN_TONES,
} from '../data/characters.js';
import { COOK_STATES, getIngredient } from '../data/ingredients.js';
import { inspectBoardAgainstTicket } from '../engine/gameEngine.js';

export function ChefAvatarSvg({ avatar, size = 64, showRoleBadge = false, className = '' }) {
  const clean = normalizePlayerAvatar(avatar);
  const skinHex = SKIN_TONES.find((s) => s.id === clean.skinTone)?.hex || '#E3B18A';
  const hairHex = HAIR_COLORS.find((h) => h.id === clean.hairColor)?.hex || '#543526';
  const apronHex = APRON_COLORS.find((a) => a.id === clean.apronColor)?.hex || '#D96B32';
  const roleObj = getBrigadeRole(clean.role);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Sfondo medaglione */}
        <circle cx="40" cy="40" r="38" fill="#FFF3E2" stroke="#3A2A22" strokeOpacity="0.24" strokeWidth="2.2" />

        {/* Spalle + Casacca da cucina */}
        <path d="M15 73C17 57 27 51 40 51C53 51 63 57 65 73H15Z" fill="#FFF9F1" stroke="#3A2A22" strokeWidth="2" />

        {/* Grembiule */}
        <path d="M24 53H56L59 73H21L24 53Z" fill={apronHex} stroke="#3A2A22" strokeWidth="2" />
        <path d="M30 52V45M50 52V45" stroke={apronHex} strokeWidth="3.2" strokeLinecap="round" />
        <rect x="31" y="60" width="18" height="8" rx="2" fill="#FFF9F1" fillOpacity="0.35" stroke="#3A2A22" strokeWidth="1.2" />

        {/* Accessorio: Foulard */}
        {clean.accessory === 'foulard' && (
          <path d="M30 48Q40 55 50 48L54 57L40 53L26 57L30 48Z" fill="#B23B2E" stroke="#3A2A22" strokeWidth="1.6" />
        )}

        {/* Collo e Viso */}
        <rect x="35" y="41" width="10" height="10" rx="4" fill={skinHex} />
        <ellipse cx="40" cy="33" rx="15" ry="16" fill={skinHex} stroke="#3A2A22" strokeWidth="2" />

        {/* Guance calde */}
        <circle cx="29" cy="36" r="2.6" fill="#D96B32" fillOpacity="0.28" />
        <circle cx="51" cy="36" r="2.6" fill="#D96B32" fillOpacity="0.28" />

        {/* Capelli */}
        {clean.hairStyle === 'ricci' && (
          <path
            d="M23 31C21 21 28 13 40 13C52 13 59 21 57 31C53 25 48 22 40 22C32 22 27 25 23 31Z"
            fill={hairHex}
            stroke="#3A2A22"
            strokeWidth="1.8"
          />
        )}
        {clean.hairStyle === 'corti' && (
          <path
            d="M25 29C25 18 32 14 40 14C48 14 55 18 55 29C51 24 45 22 40 22C35 22 29 24 25 29Z"
            fill={hairHex}
            stroke="#3A2A22"
            strokeWidth="1.8"
          />
        )}
        {clean.hairStyle === 'chignon' && (
          <>
            <circle cx="40" cy="12" r="7.5" fill={hairHex} stroke="#3A2A22" strokeWidth="1.8" />
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
            <path d="M25 28C26 19 32 16 40 16C48 16 54 19 55 28H25Z" fill={hairHex} />
            <path
              d="M24 25C28 20 52 20 56 25L55 30C50 26 30 26 25 30L24 25Z"
              fill="#D96B32"
              stroke="#3A2A22"
              strokeWidth="1.6"
            />
          </>
        )}

        {/* Occhi e sorriso */}
        <circle cx="34.5" cy="33" r="2.1" fill="#3A2A22" />
        <circle cx="45.5" cy="33" r="2.1" fill="#3A2A22" />
        <path d="M35 40Q40 44.5 45 40" stroke="#3A2A22" strokeWidth="2.1" strokeLinecap="round" />

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
            d="M26 21C24 12 30 7 40 7C50 7 56 12 54 21H26Z"
            fill="#FFF9F1"
            stroke="#3A2A22"
            strokeWidth="2"
          />
        )}

        {/* Accessorio: Rametto di basilico */}
        {clean.accessory === 'rametto_basilico' && (
          <g transform="translate(49, 17)">
            <ellipse cx="4" cy="4" rx="5.5" ry="3.2" transform="rotate(-25 4 4)" fill="#5F8F3A" stroke="#3A2A22" strokeWidth="1.4" />
            <ellipse cx="9" cy="7" rx="4.5" ry="2.6" transform="rotate(15 9 7)" fill="#487A2E" stroke="#3A2A22" strokeWidth="1.4" />
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
 * Determina l'umore visivo del cliente in base a `isThinking` e alla frazione di pazienza rimasta.
 */
export function getCustomerMood(patienceRatio = 1, isThinking = false) {
  if (isThinking) return 'thinking';
  if (patienceRatio > 0.55) return 'happy';
  if (patienceRatio > 0.28) return 'impatient';
  return 'angry';
}

export function CustomerAvatarSvg({
  appearance = {},
  patienceRatio = 1,
  isThinking = false,
  archetypeId = '',
  size = 52,
  className = '',
}) {
  const skinHex = appearance.skinHex || '#E3B18A';
  const hairHex = appearance.hairHex || '#3A2A22';
  const jacketHex = appearance.jacketHex || '#4A6B82';
  const hairStyle = appearance.hairStyle || 'corti';
  const mood = getCustomerMood(patienceRatio, isThinking);

  const ringColor =
    mood === 'thinking'
      ? '#6B564B'
      : mood === 'happy'
        ? '#5F8F3A'
        : mood === 'impatient'
          ? '#E39A2D'
          : '#B23B2E';

  const bgFill =
    mood === 'angry' ? '#FDECEC' : mood === 'impatient' ? '#FFF6E3' : '#FFF9F1';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 68 68"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cerchio di stato con bordo semantico della pazienza */}
      <circle cx="34" cy="34" r="31" fill={bgFill} stroke={ringColor} strokeWidth="3" />

      {/* Busto e giacca */}
      <path d="M13 60C15 47 23 43 34 43C45 43 53 47 55 60H13Z" fill={jacketHex} stroke="#3A2A22" strokeWidth="1.9" />
      <path d="M29 43L34 51L39 43" fill="#FFF9F1" stroke="#3A2A22" strokeWidth="1.4" />
      {appearance.hasBag && (
        <line x1="22" y1="45" x2="43" y2="59" stroke="#3A2A22" strokeWidth="3" strokeLinecap="round" />
      )}

      {/* Viso */}
      <ellipse cx="34" cy="28" rx="12.5" ry="13.5" fill={skinHex} stroke="#3A2A22" strokeWidth="1.9" />

      {/* Capelli */}
      {hairStyle === 'chignon' && (
        <circle cx="34" cy="11.5" r="5.8" fill={hairHex} stroke="#3A2A22" strokeWidth="1.6" />
      )}
      <path
        d="M21 25C22 15 27 12 34 12C41 12 46 15 47 25C43 20 38 18.5 34 18.5C30 18.5 25 20 21 25Z"
        fill={hairHex}
        stroke="#3A2A22"
        strokeWidth="1.7"
      />

      {/* Sopracciglia ed espressione dinamica in base a `mood` */}
      {mood === 'angry' && (
        <>
          <line x1="25" y1="23" x2="31" y2="25.5" stroke="#B23B2E" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="43" y1="23" x2="37" y2="25.5" stroke="#B23B2E" strokeWidth="2.2" strokeLinecap="round" />
          {/* Goccia / sbuffo di impazienza */}
          <path d="M53 16L58 13M54 21L59 20" stroke="#B23B2E" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {mood === 'impatient' && (
        <>
          <line x1="25.5" y1="24" x2="31" y2="24.5" stroke="#3A2A22" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="37" y1="24.5" x2="42.5" y2="24" stroke="#3A2A22" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {mood === 'thinking' && (
        <>
          <circle cx="53" cy="18" r="2" fill="#6B564B" />
          <circle cx="57" cy="13" r="3" fill="#6B564B" />
        </>
      )}

      {/* Occhi */}
      <circle cx="29" cy="28" r="1.9" fill="#3A2A22" />
      <circle cx="39" cy="28" r="1.9" fill="#3A2A22" />

      {/* Bocca dinamica */}
      {mood === 'happy' && (
        <path d="M29.5 34Q34 38 38.5 34" stroke="#3A2A22" strokeWidth="2" strokeLinecap="round" />
      )}
      {mood === 'thinking' && (
        <circle cx="35.5" cy="35" r="2.2" fill="#3A2A22" />
      )}
      {mood === 'impatient' && (
        <line x1="29.5" y1="35" x2="38.5" y2="34.5" stroke="#3A2A22" strokeWidth="2" strokeLinecap="round" />
      )}
      {mood === 'angry' && (
        <path d="M29.5 36.5Q34 32.5 38.5 36.5" stroke="#B23B2E" strokeWidth="2.2" strokeLinecap="round" />
      )}

      {/* Occhiali opzionali */}
      {appearance.hasGlasses && (
        <g stroke="#3A2A22" strokeWidth="1.5" fill="none">
          <circle cx="29" cy="28" r="4" />
          <circle cx="39" cy="28" r="4" />
          <line x1="33" y1="28" x2="35" y2="28" />
        </g>
      )}

      {/* Mini badge visivo dell'archetipo in basso a destra */}
      {archetypeId === 'di_fretta' && (
        <g transform="translate(46, 46)">
          <circle cx="9" cy="9" r="8.5" fill="#D96B32" stroke="#FFF9F1" strokeWidth="1.5" />
          <path d="M10 4L6 10H9.5L8 14L12.5 8H9L10 4Z" fill="#FFF9F1" />
        </g>
      )}
      {archetypeId === 'senza_cipolla' && (
        <g transform="translate(46, 46)">
          <circle cx="9" cy="9" r="8.5" fill="#B23B2E" stroke="#FFF9F1" strokeWidth="1.5" />
          <line x1="5" y1="9" x2="13" y2="9" stroke="#FFF9F1" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
      {archetypeId === 'ordine_doppio' && (
        <g transform="translate(44, 46)">
          <rect x="0" y="1" width="20" height="15" rx="7" fill="#BB5A20" stroke="#FFF9F1" strokeWidth="1.5" />
          <text x="10" y="11.5" textAnchor="middle" fill="#FFF9F1" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
            ×2
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * 21 Illustrazioni Vettoriali Dedicate — Una silhouette distinta per ciascun ingrediente.
 */
export function IngredientIconSvg({ ingredientId, size = 30, className = '' }) {
  const ing = getIngredient(ingredientId);
  const color = ing?.color || '#D96B32';
  const accent = ing?.accentColor || '#FFF3E2';

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
      {/* 1. PANE BURGER (Cupola dorata con semi di sesamo + base soffice) */}
      {ingredientId === 'pane_burger' && (
        <>
          <path d="M5 19C5 10.5 10.5 6 18 6C25.5 6 31 10.5 31 19H5Z" fill="#D89A56" stroke="#3A2A22" strokeWidth="2" />
          <ellipse cx="13" cy="11.5" rx="1.6" ry="0.9" transform="rotate(-15 13 11.5)" fill="#FFF9F1" />
          <ellipse cx="18" cy="10" rx="1.6" ry="0.9" fill="#FFF9F1" />
          <ellipse cx="23" cy="12" rx="1.6" ry="0.9" transform="rotate(15 23 12)" fill="#FFF9F1" />
          <ellipse cx="16" cy="14.5" rx="1.5" ry="0.8" fill="#FFF9F1" />
          <ellipse cx="21" cy="15" rx="1.5" ry="0.8" fill="#FFF9F1" />
          <rect x="6" y="21" width="24" height="7" rx="3.5" fill="#F3D299" stroke="#3A2A22" strokeWidth="2" />
        </>
      )}

      {/* 2. PANE CASERECCIO / ROSETTA (Pagnotta rustica con tagli a stella sulla crosta) */}
      {ingredientId === 'pane_casereccio' && (
        <>
          <path
            d="M4 21C4 11 10 7 18 7C26 7 32 11 32 21C32 25 28 28 18 28C8 28 4 25 4 21Z"
            fill="#C68446"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M11 14Q18 11 25 14M13 18Q18 15 23 18" stroke="#EBD1A7" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="9" x2="18" y2="20" stroke="#EBD1A7" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* 3. CUZZETIELLO NAPOLETANO (Punta di pane cafone scavata a cono con apertura farcibile) */}
      {ingredientId === 'cuzzetiello' && (
        <>
          <path
            d="M6 15L16 29C17.2 30.5 19.5 30.5 20.7 29L30 15H6Z"
            fill="#B56E33"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <ellipse cx="18" cy="15" rx="12" ry="5.5" fill="#E4C391" stroke="#3A2A22" strokeWidth="2" />
          <ellipse cx="18" cy="15" rx="7.5" ry="3" fill="#8C4A27" />
        </>
      )}

      {/* 4. BURGER DI MANZO (Medaglione spesso con rigature di griglia in ghisa) */}
      {ingredientId === 'burger_manzo' && (
        <>
          <rect x="4" y="11" width="28" height="14" rx="7" fill="#6E3B2B" stroke="#3A2A22" strokeWidth="2" />
          <line x1="10" y1="13" x2="14" y2="23" stroke="#2C1610" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="17" y1="13" x2="21" y2="23" stroke="#2C1610" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="24" y1="13" x2="27" y2="22" stroke="#2C1610" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}

      {/* 5. POLLO CROCCANTE (Filetto panato dorato dalla silhouette frastagliata croccante) */}
      {ingredientId === 'pollo' && (
        <>
          <path
            d="M5 18C5 13 9 9 15 10C18 8 24 9 27 12C31 14 31 21 27 24C22 27 14 27 9 24C6 22 5 20 5 18Z"
            fill="#D9933D"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M11 15L14 17M19 14L22 16M15 21L19 20" stroke="#FFF3E2" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* 6. SALSICCIA A PUNTA DI COLTELLO (Rocchetto ricurvo legato con granelli di pepe) */}
      {ingredientId === 'salsiccia' && (
        <>
          <path
            d="M6 22C6 13 13 9 20 9C27 9 30 13 30 19C30 23 26 25 22 23C19 21 16 21 13 24C9 26 6 25 6 22Z"
            fill="#8A4233"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <circle cx="13" cy="16" r="1.4" fill="#F7E6CE" />
          <circle cx="19" cy="14" r="1.4" fill="#F7E6CE" />
          <circle cx="24" cy="17" r="1.4" fill="#F7E6CE" />
        </>
      )}

      {/* 7. POLPETTE AL SUGO (Tre polpette tonde con glassa di ragù e fogliolina) */}
      {ingredientId === 'polpette' && (
        <>
          <circle cx="12" cy="21" r="6.5" fill="#7D3526" stroke="#3A2A22" strokeWidth="1.9" />
          <circle cx="24" cy="21" r="6.5" fill="#7D3526" stroke="#3A2A22" strokeWidth="1.9" />
          <circle cx="18" cy="13.5" r="6.5" fill="#8C3D2B" stroke="#3A2A22" strokeWidth="1.9" />
          <path d="M14 12Q18 16 22 12" stroke="#C84C3C" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="18" cy="9" r="2" fill="#5F8F3A" />
        </>
      )}

      {/* 8. BURGER VEGETALE MEDITERRANEO (Medaglione verde erbe con semi e foglia) */}
      {ingredientId === 'burger_vegetale' && (
        <>
          <rect x="5" y="11" width="26" height="14" rx="7" fill="#5B7A38" stroke="#3A2A22" strokeWidth="2" />
          <circle cx="12" cy="18" r="1.8" fill="#E9C67A" />
          <circle cx="18" cy="16" r="1.8" fill="#FFF3E2" />
          <circle cx="24" cy="19" r="1.8" fill="#E9C67A" />
          <path d="M15 21L21 15" stroke="#88AA56" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* 9. PROVOLA AFFUMICATA (Fetta ambrata con goccia filante e crosta bruna) */}
      {ingredientId === 'provola' && (
        <>
          <path
            d="M6 12L29 9L27 22L21 22L19 27L16 22L8 21L6 12Z"
            fill="#E9C67A"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <circle cx="14" cy="16" r="2" fill="#C68446" fillOpacity="0.55" />
          <circle cx="22" cy="15" r="1.6" fill="#C68446" fillOpacity="0.55" />
        </>
      )}

      {/* 10. FIOR DI LATTE (Fette candide sovrapposte con bordo marcato ad alto contrasto) */}
      {ingredientId === 'fior_di_latte' && (
        <>
          <ellipse cx="15" cy="19" rx="9" ry="6.5" fill="#FFFDF9" stroke="#3A2A22" strokeWidth="2.2" />
          <ellipse cx="22" cy="16" rx="8.5" ry="6" fill="#F4EFE6" stroke="#3A2A22" strokeWidth="2.2" />
          <path d="M19 15Q22 18 25 15" stroke="#8C7A70" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}

      {/* 11. LATTUGA CROCCANTE (Foglia ondulata con nervatura centrale) */}
      {ingredientId === 'lattuga' && (
        <>
          <path
            d="M6 21C4 16 7 11 12 11C14 8 20 8 23 11C28 10 32 15 30 20C29 25 23 27 18 26C12 27 7 25 6 21Z"
            fill="#6CA243"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M10 19Q18 16 26 18M18 17L15 13M20 17L23 13" stroke="#C5E89B" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* 12. POMODORO CUORE DI BUE (Fetta rossa rotonda con spicchi interni e semi) */}
      {ingredientId === 'pomodoro' && (
        <>
          <circle cx="18" cy="18" r="12" fill="#C94231" stroke="#3A2A22" strokeWidth="2" />
          <circle cx="18" cy="18" r="8.5" fill="#E85D4A" />
          <line x1="18" y1="9" x2="18" y2="27" stroke="#C94231" strokeWidth="2" />
          <line x1="9" y1="18" x2="27" y2="18" stroke="#C94231" strokeWidth="2" />
          <circle cx="14" cy="14" r="1.1" fill="#FFE699" />
          <circle cx="22" cy="14" r="1.1" fill="#FFE699" />
          <circle cx="14" cy="22" r="1.1" fill="#FFE699" />
          <circle cx="22" cy="22" r="1.1" fill="#FFE699" />
        </>
      )}

      {/* 13. CIPOLLA RAMATA (Anelli concentrici viola/rosati intrecciati) */}
      {ingredientId === 'cipolla' && (
        <>
          <circle cx="15" cy="19" r="9" stroke="#8E3B63" strokeWidth="3.2" fill="#FFF9F1" fillOpacity="0.4" />
          <circle cx="22" cy="16" r="8" stroke="#B55D85" strokeWidth="3" fill="none" />
          <circle cx="15" cy="19" r="4.5" stroke="#D99AB5" strokeWidth="2" fill="none" />
        </>
      )}

      {/* 14. FRIARIELLI NAPOLETANI (Cime di rapa scure saltate con peperoncino rosso) */}
      {ingredientId === 'friarielli' && (
        <>
          <path
            d="M7 22C6 15 11 9 18 10C25 9 30 14 29 21C27 26 21 28 15 27C10 27 8 25 7 22Z"
            fill="#385C32"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M12 22Q17 15 23 19" stroke="#76B054" strokeWidth="2" strokeLinecap="round" />
          {/* Peperoncino rosso tipico dei friarielli in padella */}
          <path d="M21 12C24 12 26 14 25 17C23 16 21 14 21 12Z" fill="#D93829" stroke="#3A2A22" strokeWidth="1.2" />
        </>
      )}

      {/* 15. BASILICO FRESCO (Trifoglio di foglie profumate a punta) */}
      {ingredientId === 'basilico' && (
        <>
          <path d="M18 7C23 11 23 18 18 22C13 18 13 11 18 7Z" fill="#5F8F3A" stroke="#3A2A22" strokeWidth="1.8" />
          <path d="M8 17C12 14 18 16 18 22C12 24 8 21 8 17Z" fill="#487A2E" stroke="#3A2A22" strokeWidth="1.8" />
          <path d="M28 17C24 14 18 16 18 22C24 24 28 21 28 17Z" fill="#487A2E" stroke="#3A2A22" strokeWidth="1.8" />
          <line x1="18" y1="21" x2="18" y2="28" stroke="#3A2A22" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* 16. CETRIOLINI (Tre rondelle zigrinate verde acido) */}
      {ingredientId === 'cetriolini' && (
        <>
          <circle cx="12" cy="20" r="6.5" fill="#6E8F32" stroke="#3A2A22" strokeWidth="1.9" />
          <circle cx="12" cy="20" r="3.5" fill="#A6C462" />
          <circle cx="23" cy="16" r="6.5" fill="#6E8F32" stroke="#3A2A22" strokeWidth="1.9" />
          <circle cx="23" cy="16" r="3.5" fill="#A6C462" />
        </>
      )}

      {/* 17. CROCCHÈ DI PATATE (Cilindro dorato impanato con prezzemolo) */}
      {ingredientId === 'crocche' && (
        <>
          <rect
            x="6"
            y="12"
            width="24"
            height="12"
            rx="6"
            transform="rotate(-12 18 18)"
            fill="#E09738"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <circle cx="14" cy="17" r="1.4" fill="#487A2E" />
          <circle cx="19" cy="19" r="1.4" fill="#FFF3E2" />
          <circle cx="23" cy="16" r="1.4" fill="#487A2E" />
        </>
      )}

      {/* 18. PARMIGIANA DI MELANZANE (Teglia a strati melanzana viola, sugo rosso e provola) */}
      {ingredientId === 'parmigiana_melanzane' && (
        <>
          <rect x="6" y="10" width="24" height="5.5" rx="2.5" fill="#9C2B1E" stroke="#3A2A22" strokeWidth="1.7" />
          <rect x="7" y="15.5" width="22" height="5" rx="2" fill="#E9C67A" stroke="#3A2A22" strokeWidth="1.7" />
          <rect x="6" y="20.5" width="24" height="6" rx="2.5" fill="#4A2545" stroke="#3A2A22" strokeWidth="1.7" />
        </>
      )}

      {/* 19. RAGÙ NAPOLETANO (Mestolo / ciotola fumante di ragù rosso denso) */}
      {ingredientId === 'ragu' && (
        <>
          <path d="M7 17H29C29 24 24 28 18 28C12 28 7 24 7 17Z" fill="#9C2B1E" stroke="#3A2A22" strokeWidth="2" />
          <ellipse cx="18" cy="17" rx="11" ry="4" fill="#C84C3C" stroke="#3A2A22" strokeWidth="1.8" />
          <path d="M14 9Q13 12 15 13M21 8Q20 11 22 13" stroke="#9C2B1E" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* 20. SALSA DELLA CASA (Ciotolina con spirale arancio ambrata) */}
      {ingredientId === 'salsa_casa' && (
        <>
          <circle cx="18" cy="18" r="11" fill="#D96B32" stroke="#3A2A22" strokeWidth="2" />
          <path
            d="M13 18C13 15 16 13 19 14C22 15 23 19 20 21C17 23 14 21 15 18"
            stroke="#FFF3E2"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}

      {/* 21. KETCHUP (Goccia rossa brillante lucida) */}
      {ingredientId === 'ketchup' && (
        <>
          <path
            d="M18 6C23.5 13.5 27 17.5 27 22C27 26.8 23 30 18 30C13 30 9 26.8 9 22C9 17.5 12.5 13.5 18 6Z"
            fill="#B82921"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M14 19C14 22 15.5 24.5 18 25" stroke="#FF9B94" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* 22. MAIONESE (Ciuffo cremoso avorio con doppio bordo scuro ad alto contrasto) */}
      {ingredientId === 'maionese' && (
        <>
          <path
            d="M18 7C21 11 27 14 27 21C27 26 23 29 18 29C13 29 9 26 9 21C9 15 15 12 18 7Z"
            fill="#FFF6DE"
            stroke="#3A2A22"
            strokeWidth="2.2"
          />
          <path d="M14 21Q18 25 22 21" stroke="#C8964B" strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* 23. SALSA PICCANTE (Peperoncino cornetto rosso fuoco con fiammella) */}
      {ingredientId === 'salsa_piccante' && (
        <>
          <path
            d="M10 25C16 26 24 21 27 12C27.5 10 25 8.5 23.5 10C19 16 14 19 9 20C7 20.5 7.5 24.5 10 25Z"
            fill="#C4321A"
            stroke="#3A2A22"
            strokeWidth="2"
          />
          <path d="M25.5 10L29 7" stroke="#487A2E" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}

      {/* Fallback coerente se un ID futuro non avesse case dedicato */}
      {![
        'pane_burger',
        'pane_casereccio',
        'cuzzetiello',
        'burger_manzo',
        'pollo',
        'salsiccia',
        'polpette',
        'burger_vegetale',
        'provola',
        'fior_di_latte',
        'lattuga',
        'pomodoro',
        'cipolla',
        'friarielli',
        'basilico',
        'cetriolini',
        'crocche',
        'parmigiana_melanzane',
        'ragu',
        'salsa_casa',
        'ketchup',
        'maionese',
        'salsa_piccante',
      ].includes(ingredientId) && (
        <circle cx="18" cy="18" r="11" fill={color} stroke="#3A2A22" strokeWidth="2" />
      )}
    </svg>
  );
}

/**
 * Illustrazione di uno slot della Piastra in Ghisa con stato visivo immediato.
 */
export function GrillBurnerSvg({
  ingredientId = null,
  cookState = COOK_STATES.RAW,
  aboutToBurn = false,
  size = 48,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Base in ghisa con griglia */}
      <rect x="3" y="6" width="50" height="44" rx="10" fill="#2A201C" stroke="#5A473E" strokeWidth="2" />
      <line x1="12" y1="12" x2="12" y2="44" stroke="#3D302A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="12" x2="22" y2="44" stroke="#3D302A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="12" x2="34" y2="44" stroke="#3D302A" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="44" y1="12" x2="44" y2="44" stroke="#3D302A" strokeWidth="2.5" strokeLinecap="round" />

      {ingredientId && cookState === COOK_STATES.BURNED ? (
        <>
          <circle cx="28" cy="29" r="14" fill="#1A1311" stroke="#B23B2E" strokeWidth="2.2" />
          <path d="M22 25L34 33M34 25L22 33" stroke="#FF8B7E" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 12Q18 7 22 4M34 11Q32 6 36 3" stroke="#6B564B" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : ingredientId ? (
        <>
          <g transform="translate(10, 10)">
            <IngredientIconSvg ingredientId={ingredientId} size={36} />
          </g>
          {cookState === COOK_STATES.COOKING && (
            <path d="M12 45Q15 39 18 45M38 45Q41 39 44 45" stroke="#E39A2D" strokeWidth="2.4" strokeLinecap="round" />
          )}
          {cookState === COOK_STATES.COOKED && !aboutToBurn && (
            <circle cx="45" cy="13" r="6" fill="#5F8F3A" stroke="#FFF9F1" strokeWidth="1.5" />
          )}
          {cookState === COOK_STATES.COOKED && aboutToBurn && (
            <circle cx="45" cy="13" r="6" fill="#B23B2E" stroke="#FFF9F1" strokeWidth="1.5" />
          )}
        </>
      ) : (
        <circle cx="28" cy="28" r="8" stroke="#5A473E" strokeWidth="1.8" strokeDasharray="3 3" />
      )}
    </svg>
  );
}

/**
 * Visualizzatore sul tagliere del panino in costruzione strato per strato,
 * con evidenziazione immediata di eventuali ingredienti errati (`isExtra`).
 */
export function SandwichStackSvg({ boardIngredients = [], ticket = null, onRemoveLayer }) {
  const analysis = inspectBoardAgainstTicket(boardIngredients, ticket);
  const layers = analysis.assembledLayers;

  return (
    <div className="relative rounded-2xl border border-brown/15 bg-cream/70 p-3">
      {/* Stato sintetico sopra il tagliere */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brown-soft">
          Tagliere in legno ({layers.length} {layers.length === 1 ? 'strato' : 'strati'})
        </span>
        {analysis.status === 'ready_to_serve' && (
          <span className="rounded-full bg-green px-2.5 py-0.5 text-[11px] font-extrabold text-white">
            ✓ Ricetta perfetta!
          </span>
        )}
        {analysis.status === 'has_errors' && (
          <span className="rounded-full bg-danger px-2.5 py-0.5 text-[11px] font-extrabold text-white">
            ⚠ Rimuovi ingrediente in rosso
          </span>
        )}
      </div>

      {layers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="h-4 w-36 rounded-full bg-brown/15" />
          <p className="mt-2 text-xs font-semibold text-brown-soft">
            Tagliere vuoto · Tocca gli ingredienti evidenziati con <strong>★ Serve</strong>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 py-1">
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
                className={`press inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold min-h-[40px] ${
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
