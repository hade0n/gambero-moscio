/**
 * Generatore dell'Asset Pack originale 2.5D per "Il Banco del Gambero" (`/game`).
 * Produce illustrazioni SVG multi-livello con ombreggiature, gradienti, texture
 * e trasparenza in `public/game/art/` + il manifest `public/game/art/manifest.json`
 * e il modulo `src/game/data/artManifest.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INGREDIENTS, COOK_STATES } from '../src/game/data/ingredients.js';
import { RECIPES } from '../src/game/data/recipes.js';
import { CHEF_PERSONAS, SKIN_TONES, HAIR_COLORS, APRON_COLORS, BRIGADE_ROLES } from '../src/game/data/characters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ART_DIR = path.join(ROOT, 'public', 'game', 'art');

const DIRS = [
  ART_DIR,
  path.join(ART_DIR, 'scenes'),
  path.join(ART_DIR, 'ingredients'),
  path.join(ART_DIR, 'recipes'),
  path.join(ART_DIR, 'customers'),
  path.join(ART_DIR, 'chefs'),
  path.join(ART_DIR, 'props'),
  path.join(ART_DIR, 'fx'),
];

for (const d of DIRS) {
  fs.mkdirSync(d, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. INGREDIENTI 2.5D (96x96 viewBox, prospettiva 2.5D da banco cucina)
// ---------------------------------------------------------------------------

export function renderIngredientInnerSvg(id, state = COOK_STATES.COOKED) {
  const isRaw = state === COOK_STATES.RAW;
  const isBurned = state === COOK_STATES.BURNED;

  switch (id) {
    case 'pane_burger':
      return `
        <defs>
          <radialGradient id="bunTop" cx="42%" cy="32%" r="60%">
            <stop offset="0%" stop-color="#F7C97E"/>
            <stop offset="55%" stop-color="#D89143"/>
            <stop offset="100%" stop-color="#9E5B1E"/>
          </radialGradient>
          <linearGradient id="bunBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FCE5B8"/>
            <stop offset="100%" stop-color="#C8823B"/>
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="74" rx="34" ry="9" fill="#000" fill-opacity="0.18"/>
        <!-- Base soffice tostata -->
        <path d="M16 58 C16 53, 80 53, 80 58 L77 69 C75 75, 21 75, 19 69 Z" fill="url(#bunBase)" stroke="#3A2A22" stroke-width="2.5"/>
        <ellipse cx="48" cy="58" rx="32" ry="6.5" fill="#FFF3D6" stroke="#D89A56" stroke-width="1.5"/>
        <!-- Cupola brioche dorata -->
        <path d="M14 48 C14 22, 82 22, 82 48 C82 54, 14 54, 14 48 Z" fill="url(#bunTop)" stroke="#3A2A22" stroke-width="2.5"/>
        <!-- Riflesso caldo sulla crosta -->
        <path d="M26 32 C34 25, 52 24, 62 30" stroke="#FFE9B5" stroke-width="3" stroke-linecap="round" opacity="0.65" fill="none"/>
        <!-- Semi di sesamo -->
        <g fill="#FFF9F1" stroke="#8C5323" stroke-width="0.8">
          <ellipse cx="34" cy="34" rx="3.2" ry="1.6" transform="rotate(-18 34 34)"/>
          <ellipse cx="48" cy="30" rx="3.2" ry="1.6" transform="rotate(6 48 30)"/>
          <ellipse cx="62" cy="35" rx="3.2" ry="1.6" transform="rotate(20 62 35)"/>
          <ellipse cx="40" cy="42" rx="3.2" ry="1.6" transform="rotate(-8 40 42)"/>
          <ellipse cx="55" cy="41" rx="3.2" ry="1.6" transform="rotate(12 55 41)"/>
          <ellipse cx="27" cy="43" rx="2.9" ry="1.5" transform="rotate(-24 27 43)"/>
          <ellipse cx="68" cy="43" rx="2.9" ry="1.5" transform="rotate(24 68 43)"/>
        </g>
      `;

    case 'pane_casereccio':
      return `
        <defs>
          <radialGradient id="casCrust" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#E6AC6E"/>
            <stop offset="65%" stop-color="#B87333"/>
            <stop offset="100%" stop-color="#7D491B"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="73" rx="36" ry="9" fill="#000" fill-opacity="0.18"/>
        <path d="M12 52 C10 26, 28 18, 48 18 C68 18, 86 26, 84 52 C83 66, 68 72, 48 72 C28 72, 13 66, 12 52 Z" fill="url(#casCrust)" stroke="#3A2A22" stroke-width="2.6"/>
        <!-- Spolverata di farina e tagli a rosetta -->
        <ellipse cx="48" cy="40" rx="25" ry="14" fill="#FFF8EB" fill-opacity="0.22"/>
        <path d="M26 38 Q48 28 70 38 M30 49 Q48 39 66 49 M48 23 L48 56" stroke="#F7DFB9" stroke-width="3" stroke-linecap="round" fill="none"/>
        <path d="M20 57 Q48 65 76 57" stroke="#FCE7C2" stroke-width="2.4" stroke-dasharray="4 3" fill="none"/>
      `;

    case 'cuzzetiello':
      return `
        <defs>
          <linearGradient id="cuzzBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#D48845"/>
            <stop offset="55%" stop-color="#9E5622"/>
            <stop offset="100%" stop-color="#693410"/>
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="76" rx="30" ry="8" fill="#000" fill-opacity="0.2"/>
        <!-- Punta conica di pane cafone -->
        <path d="M16 38 L41 75 C45 80, 51 80, 55 75 L80 38 Z" fill="url(#cuzzBody)" stroke="#3A2A22" stroke-width="2.6"/>
        <!-- Crosta rustica rigata -->
        <path d="M27 50 Q48 56 69 50 M34 62 Q48 66 62 62" stroke="#592B0C" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <!-- Apertura scavata con mollica calda -->
        <ellipse cx="48" cy="38" rx="32" ry="13" fill="#F2D7A7" stroke="#3A2A22" stroke-width="2.5"/>
        <ellipse cx="48" cy="38" rx="22" ry="8" fill="#7D3B18" stroke="#C68446" stroke-width="1.6"/>
      `;

    case 'burger_manzo': {
      const c1 = isBurned ? '#2B1E1B' : isRaw ? '#D9655B' : '#7D3E28';
      const c2 = isBurned ? '#140E0C' : isRaw ? '#A83B32' : '#4D2214';
      const grillLine = isBurned ? '#090605' : isRaw ? '#F29B94' : '#260E07';
      return `
        <defs>
          <radialGradient id="beefGrad_${state}" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="64" rx="35" ry="11" fill="#000" fill-opacity="0.22"/>
        <path d="M14 46 C14 33, 82 33, 82 46 L82 56 C82 69, 14 69, 14 56 Z" fill="url(#beefGrad_${state})" stroke="#3A2A22" stroke-width="2.6"/>
        <ellipse cx="48" cy="45" rx="33" ry="12" fill="url(#beefGrad_${state})" stroke="#3A2A22" stroke-width="2"/>
        <!-- Rigature di ghisa o venature -->
        <path d="M26 38 L36 53 M43 36 L54 54 M60 38 L69 52" stroke="${grillLine}" stroke-width="3.6" stroke-linecap="round"/>
        ${!isBurned ? '<path d="M26 42 Q48 36 68 43" stroke="#FFF3E2" stroke-width="2" stroke-linecap="round" opacity="0.38" fill="none"/>' : ''}
      `;
    }

    case 'pollo': {
      const c1 = isBurned ? '#36251E' : isRaw ? '#F7C8B6' : '#F4AF49';
      const c2 = isBurned ? '#1C130F' : isRaw ? '#D9947E' : '#BA6D1E';
      return `
        <defs>
          <radialGradient id="chkGrad_${state}" cx="42%" cy="35%" r="65%">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="65" rx="34" ry="10" fill="#000" fill-opacity="0.2"/>
        <path d="M14 49 C12 37, 23 29, 36 31 C45 26, 61 28, 70 34 C82 37, 84 52, 75 59 C64 67, 34 67, 21 60 C15 57, 14 53, 14 49 Z" fill="url(#chkGrad_${state})" stroke="#3A2A22" stroke-width="2.6"/>
        <!-- Panatura croccante a fiocchi -->
        <path d="M28 42 L35 46 M46 39 L53 43 M60 44 L66 48 M36 53 L45 51 M54 54 L61 52" stroke="${isBurned ? '#523A2E' : '#FFF3D1'}" stroke-width="2.8" stroke-linecap="round"/>
      `;
    }

    case 'salsiccia': {
      const c1 = isBurned ? '#2E1E1A' : isRaw ? '#C95B4E' : '#9E4632';
      const c2 = isBurned ? '#170E0C' : isRaw ? '#94372C' : '#612518';
      return `
        <defs>
          <linearGradient id="salsGrad_${state}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="65" rx="34" ry="10" fill="#000" fill-opacity="0.2"/>
        <path d="M15 53 C13 33, 30 25, 50 26 C70 26, 82 35, 80 51 C79 62, 66 65, 57 59 C49 54, 41 54, 33 60 C23 65, 16 61, 15 53 Z" fill="url(#salsGrad_${state})" stroke="#3A2A22" stroke-width="2.6"/>
        <!-- Granelli di pepe e finocchietto + segni griglia -->
        <circle cx="32" cy="42" r="2.3" fill="#FCEAD2" opacity="0.85"/>
        <circle cx="48" cy="38" r="2.2" fill="#FCEAD2" opacity="0.85"/>
        <circle cx="63" cy="44" r="2.3" fill="#FCEAD2" opacity="0.85"/>
        <path d="M28 34 L34 49 M47 32 L52 48 M63 35 L68 50" stroke="#29100A" stroke-width="2.6" stroke-linecap="round"/>
      `;
    }

    case 'polpette':
      return `
        <defs>
          <radialGradient id="polpGrad" cx="38%" cy="32%" r="62%">
            <stop offset="0%" stop-color="#A84832"/>
            <stop offset="100%" stop-color="#5E2114"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="68" rx="33" ry="10" fill="#000" fill-opacity="0.22"/>
        <!-- Salsa ragù alla base -->
        <ellipse cx="48" cy="60" rx="30" ry="11" fill="#AD2E1E" stroke="#3A2A22" stroke-width="2"/>
        <!-- 3 Polpette tonde -->
        <circle cx="32" cy="52" r="15" fill="url(#polpGrad)" stroke="#3A2A22" stroke-width="2.4"/>
        <circle cx="64" cy="52" r="15" fill="url(#polpGrad)" stroke="#3A2A22" stroke-width="2.4"/>
        <circle cx="48" cy="36" r="15.5" fill="url(#polpGrad)" stroke="#3A2A22" stroke-width="2.4"/>
        <!-- Glassa di ragù e fogliolina di basilico -->
        <path d="M37 33 Q48 43 59 33" stroke="#E04836" stroke-width="5" stroke-linecap="round" fill="none"/>
        <path d="M24 49 Q32 56 40 49 M56 49 Q64 56 72 49" stroke="#E04836" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M48 18 C55 21, 56 28, 48 31 C40 28, 41 21, 48 18 Z" fill="#5F8F3A" stroke="#3A2A22" stroke-width="1.8"/>
      `;

    case 'burger_vegetale': {
      const c1 = isBurned ? '#29241E' : isRaw ? '#7FA650' : '#658A3B';
      const c2 = isBurned ? '#14120F' : isRaw ? '#557530' : '#3C5720';
      return `
        <defs>
          <radialGradient id="vegGrad_${state}" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="${c1}"/>
            <stop offset="100%" stop-color="${c2}"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="64" rx="33" ry="10" fill="#000" fill-opacity="0.2"/>
        <rect x="15" y="34" width="66" height="28" rx="14" fill="url(#vegGrad_${state})" stroke="#3A2A22" stroke-width="2.6"/>
        <circle cx="32" cy="47" r="3.2" fill="#F5D387"/>
        <circle cx="48" cy="43" r="3" fill="#FFF3E2"/>
        <circle cx="62" cy="49" r="3.2" fill="#E89846"/>
        <circle cx="41" cy="53" r="2.6" fill="#A3D96C"/>
        <path d="M27 38 L34 56 M55 38 L62 56" stroke="#2A3D16" stroke-width="2.5" stroke-linecap="round"/>
      `;
    }

    case 'provola':
      return `
        <defs>
          <linearGradient id="provGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFF2C2"/>
            <stop offset="65%" stop-color="#F0C76E"/>
            <stop offset="100%" stop-color="#C68938"/>
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="66" rx="32" ry="9" fill="#000" fill-opacity="0.16"/>
        <path d="M16 34 L76 26 L72 56 L56 56 L51 69 L43 56 L20 54 Z" fill="url(#provGrad)" stroke="#8C531E" stroke-width="2.8" stroke-linejoin="round"/>
        <circle cx="36" cy="43" r="4.2" fill="#C68446" fill-opacity="0.45"/>
        <circle cx="57" cy="41" r="3.4" fill="#C68446" fill-opacity="0.45"/>
        <path d="M24 38 L66 32" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
      `;

    case 'fior_di_latte':
      return `
        <ellipse cx="48" cy="66" rx="33" ry="9" fill="#000" fill-opacity="0.16"/>
        <ellipse cx="39" cy="51" rx="23" ry="15" fill="#FFFDF9" stroke="#3A2A22" stroke-width="2.5"/>
        <ellipse cx="57" cy="43" rx="22" ry="14" fill="#F7F2E7" stroke="#3A2A22" stroke-width="2.5"/>
        <path d="M48 41 Q57 48 66 41" stroke="#C2B6A3" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <path d="M29 48 Q38 55 47 48" stroke="#C2B6A3" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <circle cx="62" cy="37" r="3" fill="#FFFFFF"/>
      `;

    case 'lattuga':
      return `
        <defs>
          <radialGradient id="latGrad" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#A8DE6C"/>
            <stop offset="70%" stop-color="#6CA243"/>
            <stop offset="100%" stop-color="#436E24"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="66" rx="34" ry="9" fill="#000" fill-opacity="0.16"/>
        <path d="M14 53 C10 41, 17 29, 29 30 C35 21, 51 21, 59 29 C72 26, 84 38, 79 51 C76 63, 61 67, 48 64 C33 67, 18 63, 14 53 Z" fill="url(#latGrad)" stroke="#3A2A22" stroke-width="2.5"/>
        <path d="M25 49 Q48 41 70 46 M47 44 L38 33 M53 44 L62 34 M42 46 L34 55" stroke="#E2F7C4" stroke-width="3" stroke-linecap="round" fill="none"/>
      `;

    case 'pomodoro':
      return `
        <defs>
          <radialGradient id="tomGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#FF6B57"/>
            <stop offset="75%" stop-color="#D13B2A"/>
            <stop offset="100%" stop-color="#8F2015"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="66" rx="31" ry="9" fill="#000" fill-opacity="0.18"/>
        <ellipse cx="48" cy="48" rx="30" ry="22" fill="url(#tomGrad)" stroke="#3A2A22" stroke-width="2.6"/>
        <ellipse cx="48" cy="48" rx="22" ry="15" fill="#F25C4A" stroke="#B0291B" stroke-width="1.5"/>
        <line x1="48" y1="31" x2="48" y2="65" stroke="#C93829" stroke-width="3"/>
        <line x1="24" y1="48" x2="72" y2="48" stroke="#C93829" stroke-width="3"/>
        <g fill="#FFE699">
          <circle cx="38" cy="41" r="2.2"/><circle cx="42" cy="38" r="1.8"/>
          <circle cx="58" cy="41" r="2.2"/><circle cx="54" cy="38" r="1.8"/>
          <circle cx="38" cy="55" r="2.2"/><circle cx="58" cy="55" r="2.2"/>
        </g>
      `;

    case 'cipolla':
      return `
        <ellipse cx="48" cy="66" rx="32" ry="8" fill="#000" fill-opacity="0.15"/>
        <ellipse cx="39" cy="51" rx="22" ry="15" stroke="#8E3B63" stroke-width="5.5" fill="#FFF9F1" fill-opacity="0.35"/>
        <ellipse cx="57" cy="44" rx="20" ry="14" stroke="#B55D85" stroke-width="5" fill="none"/>
        <ellipse cx="39" cy="51" rx="11" ry="7.5" stroke="#D99AB5" stroke-width="3.5" fill="none"/>
      `;

    case 'friarielli':
      return `
        <defs>
          <radialGradient id="friaGrad" cx="45%" cy="38%" r="60%">
            <stop offset="0%" stop-color="#5B8C4A"/>
            <stop offset="100%" stop-color="#27421E"/>
          </radialGradient>
        </defs>
        <ellipse cx="48" cy="66" rx="32" ry="9" fill="#000" fill-opacity="0.2"/>
        <path d="M17 54 C14 37, 26 24, 46 27 C64 23, 79 35, 76 52 C72 64, 56 68, 40 66 C26 66, 19 61, 17 54 Z" fill="url(#friaGrad)" stroke="#3A2A22" stroke-width="2.5"/>
        <path d="M29 53 Q44 37 61 47 M36 39 Q48 33 58 40" stroke="#8CC470" stroke-width="3" stroke-linecap="round" fill="none"/>
        <!-- Spicchio d'aglio e peperoncino rosso -->
        <ellipse cx="35" cy="54" rx="5" ry="3.4" fill="#FFF5DC" stroke="#3A2A22" stroke-width="1.5"/>
        <path d="M55 31 C65 31, 71 37, 67 45 C61 42, 56 37, 55 31 Z" fill="#E03424" stroke="#3A2A22" stroke-width="1.8"/>
      `;

    case 'basilico':
      return `
        <ellipse cx="48" cy="68" rx="26" ry="7" fill="#000" fill-opacity="0.15"/>
        <path d="M48 18 C61 28, 61 46, 48 56 C35 46, 35 28, 48 18 Z" fill="#689F3E" stroke="#3A2A22" stroke-width="2.4"/>
        <path d="M21 43 C32 34, 47 40, 48 56 C32 61, 21 53, 21 43 Z" fill="#4C7D2B" stroke="#3A2A22" stroke-width="2.4"/>
        <path d="M75 43 C64 34, 49 40, 48 56 C64 61, 75 53, 75 43 Z" fill="#4C7D2B" stroke="#3A2A22" stroke-width="2.4"/>
        <path d="M48 24 L48 68 M30 46 L48 55 M66 46 L48 55" stroke="#B6E388" stroke-width="2.2" stroke-linecap="round"/>
      `;

    case 'cetriolini':
      return `
        <ellipse cx="48" cy="66" rx="30" ry="8" fill="#000" fill-opacity="0.16"/>
        <g transform="translate(0,0)">
          <circle cx="33" cy="52" r="16" fill="#6E8F32" stroke="#3A2A22" stroke-width="2.4"/>
          <circle cx="33" cy="52" r="10" fill="#B4D46E"/>
          <circle cx="60" cy="43" r="16" fill="#6E8F32" stroke="#3A2A22" stroke-width="2.4"/>
          <circle cx="60" cy="43" r="10" fill="#B4D46E"/>
          <circle cx="46" cy="35" r="14" fill="#789C38" stroke="#3A2A22" stroke-width="2.4"/>
          <circle cx="46" cy="35" r="8.5" fill="#C2E07E"/>
        </g>
      `;

    case 'crocche':
      return `
        <defs>
          <linearGradient id="crocGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F7B955"/>
            <stop offset="65%" stop-color="#D98829"/>
            <stop offset="100%" stop-color="#9E5811"/>
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="66" rx="33" ry="9" fill="#000" fill-opacity="0.2"/>
        <g transform="rotate(-12 48 46)">
          <rect x="16" y="30" width="64" height="32" rx="16" fill="url(#crocGrad)" stroke="#3A2A22" stroke-width="2.6"/>
          <!-- Cuore di provola filante e prezzemolo -->
          <ellipse cx="48" cy="46" rx="11" ry="6" fill="#FFF5CC" opacity="0.85"/>
          <circle cx="31" cy="42" r="2.5" fill="#487A2E"/>
          <circle cx="62" cy="41" r="2.5" fill="#487A2E"/>
          <circle cx="42" cy="53" r="2.2" fill="#487A2E"/>
          <circle cx="55" cy="51" r="2.2" fill="#487A2E"/>
        </g>
      `;

    case 'parmigiana_melanzane':
      return `
        <ellipse cx="48" cy="68" rx="33" ry="9" fill="#000" fill-opacity="0.22"/>
        <!-- Strato melanzana viola scura -->
        <rect x="16" y="50" width="64" height="14" rx="6" fill="#4A2040" stroke="#3A2A22" stroke-width="2.4"/>
        <!-- Strato provola filante -->
        <rect x="19" y="39" width="58" height="12" rx="5" fill="#F5D382" stroke="#3A2A22" stroke-width="2.2"/>
        <!-- Strato sugo di pomodoro e basilico -->
        <rect x="16" y="27" width="64" height="14" rx="6" fill="#B52B1E" stroke="#3A2A22" stroke-width="2.4"/>
        <path d="M26 34 Q48 40 70 34" stroke="#FF7868" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <ellipse cx="48" cy="27" rx="8" ry="4.5" fill="#5F8F3A" stroke="#3A2A22" stroke-width="1.8"/>
      `;

    case 'ragu':
      return `
        <ellipse cx="48" cy="70" rx="30" ry="8" fill="#000" fill-opacity="0.2"/>
        <!-- Tegamino di terracotta con ragù napoletano -->
        <path d="M18 42 H78 C78 61, 64 70, 48 70 C32 70, 18 61, 18 42 Z" fill="#9E3B24" stroke="#3A2A22" stroke-width="2.5"/>
        <ellipse cx="48" cy="42" rx="30" ry="11" fill="#C83E2B" stroke="#3A2A22" stroke-width="2.4"/>
        <ellipse cx="48" cy="42" rx="21" ry="7" fill="#9C2315"/>
        <path d="M36 22 Q33 29 38 33 M50 19 Q47 27 52 31 M62 23 Q59 29 64 33" stroke="#D96B32" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      `;

    case 'salsa_casa':
      return `
        <ellipse cx="48" cy="68" rx="28" ry="8" fill="#000" fill-opacity="0.18"/>
        <circle cx="48" cy="48" r="27" fill="#E37639" stroke="#3A2A22" stroke-width="2.6"/>
        <path d="M34 48 C34 39, 43 34, 51 37 C60 40, 62 51, 54 57 C46 62, 36 57, 39 48" stroke="#FFF3E2" stroke-width="4.5" stroke-linecap="round" fill="none"/>
      `;

    case 'ketchup':
      return `
        <ellipse cx="48" cy="70" rx="24" ry="7" fill="#000" fill-opacity="0.16"/>
        <path d="M48 18 C62 36, 71 46, 71 58 C71 70, 61 76, 48 76 C35 76, 25 70, 25 58 C25 46, 34 36, 48 18 Z" fill="#C92A22" stroke="#3A2A22" stroke-width="2.6"/>
        <path d="M36 52 C36 60, 40 66, 47 68" stroke="#FF9E96" stroke-width="4" stroke-linecap="round" fill="none"/>
      `;

    case 'maionese':
      return `
        <ellipse cx="48" cy="70" rx="25" ry="7" fill="#000" fill-opacity="0.15"/>
        <path d="M48 20 C56 30, 72 38, 72 56 C72 69, 61 75, 48 75 C35 75, 24 69, 24 56 C24 40, 40 32, 48 20 Z" fill="#FFF8E3" stroke="#3A2A22" stroke-width="2.6"/>
        <path d="M36 56 Q48 66 60 56" stroke="#D4A85C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      `;

    case 'salsa_piccante':
      return `
        <ellipse cx="48" cy="68" rx="28" ry="7" fill="#000" fill-opacity="0.18"/>
        <path d="M24 62 C40 65, 64 53, 72 30 C74 24, 67 20, 62 25 C51 40, 36 48, 22 50 C16 51, 17 61, 24 62 Z" fill="#D9321C" stroke="#3A2A22" stroke-width="2.6"/>
        <path d="M68 25 L78 16" stroke="#487A2E" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M32 55 Q49 51 60 36" stroke="#FF9B7A" stroke-width="2.8" stroke-linecap="round" fill="none"/>
      `;

    default:
      return `<circle cx="48" cy="48" r="28" fill="#D96B32" stroke="#3A2A22" stroke-width="2.5"/>`;
  }
}

function wrapSvg(viewBox, innerContent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${innerContent}</svg>\n`;
}

const manifest = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  license: 'Original procedural & AI-assisted 2.5D art created specifically for Gambero Moscio - Recensioni Locali',
  scenes: {
    sala_vicolo_bg: '/game/art/scenes/sala_vicolo_bg.jpg',
    sala_forno_side: '/game/art/scenes/sala_forno_side.jpg',
    lobby_paninoteca_bg: '/game/art/scenes/lobby_paninoteca_bg.jpg',
    kitchen_counter_fg: '/game/art/scenes/kitchen_counter_fg.svg',
  },
  ingredients: {},
  grillStates: {},
  recipes: {},
  chefs: {},
  customers: {},
  props: {},
  fx: {},
};

// Genera tutti i 23 ingredienti + stati cottura per le 4 proteine da griglia
for (const ing of INGREDIENTS) {
  const relPath = `/game/art/ingredients/${ing.id}.svg`;
  fs.writeFileSync(
    path.join(ROOT, 'public', relPath),
    wrapSvg('0 0 96 96', renderIngredientInnerSvg(ing.id, COOK_STATES.COOKED)),
    'utf8',
  );
  manifest.ingredients[ing.id] = relPath;

  if (ing.requiresGrill) {
    manifest.grillStates[ing.id] = {};
    for (const st of [COOK_STATES.RAW, COOK_STATES.COOKING, COOK_STATES.COOKED, COOK_STATES.BURNED]) {
      const stPath = `/game/art/ingredients/${ing.id}_${st}.svg`;
      fs.writeFileSync(
        path.join(ROOT, 'public', stPath),
        wrapSvg('0 0 96 96', renderIngredientInnerSvg(ing.id, st)),
        'utf8',
      );
      manifest.grillStates[ing.id][st] = stPath;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. RICETTE FINITE 2.5D SU PIATTO CERAMICA VIETRESE (160x140 viewBox)
// ---------------------------------------------------------------------------

function renderFinishedRecipeSvg(recipe) {
  const layers = recipe.ingredients;
  const isCuzzetiello = recipe.bread === 'cuzzetiello';
  const isCasereccio = recipe.bread === 'pane_casereccio';

  let stackSvg = '';
  layers.forEach((ingId, idx) => {
    const yOffset = 38 - idx * 11;
    stackSvg += `<g transform="translate(32, ${yOffset}) scale(1, 0.78)">${renderIngredientInnerSvg(ingId, COOK_STATES.COOKED)}</g>`;
  });

  // Cupola superiore del pane se non è cuzzetiello
  if (!isCuzzetiello) {
    const topY = 38 - layers.length * 11;
    stackSvg += `<g transform="translate(32, ${topY}) scale(1, 0.75)">${renderIngredientInnerSvg(isCasereccio ? 'pane_casereccio' : 'pane_burger', COOK_STATES.COOKED)}</g>`;
  }

  return wrapSvg(
    '0 0 160 140',
    `
      <!-- Ombra piatto -->
      <ellipse cx="80" cy="116" rx="66" ry="18" fill="#000" fill-opacity="0.22"/>
      <!-- Piatto in ceramica vietrese bianca e blu -->
      <ellipse cx="80" cy="110" rx="64" ry="17" fill="#FFFDF9" stroke="#2D5A88" stroke-width="3.5"/>
      <ellipse cx="80" cy="110" rx="54" ry="13" fill="#F7EFE2" stroke="#D96B32" stroke-width="1.5" stroke-dasharray="6 4"/>
      <!-- Carta paglia da paninoteca -->
      <polygon points="34,108 80,94 128,107 84,121" fill="#F2D8A7" stroke="#C6985A" stroke-width="1.4"/>
      ${stackSvg}
    `,
  );
}

for (const r of RECIPES) {
  const relPath = `/game/art/recipes/${r.id}.svg`;
  fs.writeFileSync(path.join(ROOT, 'public', relPath), renderFinishedRecipeSvg(r), 'utf8');
  manifest.recipes[r.id] = relPath;
}

// ---------------------------------------------------------------------------
// 3. 8 CLIENTI ORIGINALI ESPRESSIVI (140x160 viewBox) + VARIANTI POSE/UMORE
// ---------------------------------------------------------------------------

const CUSTOMER_DESIGNS = [
  { id: 'customer_01', name: 'Marco', skin: '#E3B18A', hair: '#543526', hairStyle: 'ricci', outfit: '#3E627A', shirt: '#D96B32', glasses: false, bag: true, scarf: null },
  { id: 'customer_02', name: 'Elena', skin: '#F4CFB4', hair: '#261C18', hairStyle: 'chignon', outfit: '#5A7D4C', shirt: '#FFF9F1', glasses: true, bag: false, scarf: '#E05A47' },
  { id: 'customer_03', name: 'Luca', skin: '#C98E63', hair: '#261C18', hairStyle: 'corti', outfit: '#C88434', shirt: '#FFF3E2', glasses: false, bag: false, scarf: null },
  { id: 'customer_04', name: 'Sara', skin: '#9B6341', hair: '#261C18', hairStyle: 'ricci', outfit: '#38617A', shirt: '#F5C451', glasses: false, bag: true, scarf: null },
  { id: 'customer_05', name: 'Nadia', skin: '#E3B18A', hair: '#B55B2E', hairStyle: 'bandana', outfit: '#8C4A32', shirt: '#FFF9F1', glasses: false, bag: false, scarf: '#5F8F3A' },
  { id: 'customer_06', name: 'Dario', skin: '#6E422A', hair: '#6E6A67', hairStyle: 'corti', outfit: '#6E5266', shirt: '#F2DEC2', glasses: true, bag: true, scarf: null },
  { id: 'customer_07', name: 'Viola', skin: '#F4CFB4', hair: '#C8964B', hairStyle: 'chignon', outfit: '#A6523B', shirt: '#FFF9F1', glasses: false, bag: true, scarf: null },
  { id: 'customer_08', name: 'Teo', skin: '#C98E63', hair: '#543526', hairStyle: 'ricci', outfit: '#3D5A45', shirt: '#E9C67A', glasses: true, bag: false, scarf: null },
];

export function renderCustomerSvg(design, mood = 'happy') {
  const { skin, hair, hairStyle, outfit, shirt, glasses, bag, scarf } = design;
  const eyeY = 64;
  let brows = `
    <path d="M51 56 Q57 53 63 56" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M77 56 Q83 53 89 56" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
  `;
  let mouth = `<path d="M60 78 Q70 86 80 78" stroke="#3A2A22" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  let gesture = '';

  if (mood === 'thinking') {
    brows = `
      <path d="M51 54 Q57 50 63 54" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M77 57 L89 56" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
    `;
    mouth = `<circle cx="73" cy="79" r="3.8" fill="#3A2A22"/>`;
    gesture = `<circle cx="102" cy="40" r="4" fill="#FFF9F1" stroke="#3A2A22" stroke-width="2"/><circle cx="112" cy="28" r="6.5" fill="#FFF9F1" stroke="#3A2A22" stroke-width="2"/>`;
  } else if (mood === 'impatient') {
    brows = `
      <line x1="51" y1="55" x2="63" y2="58" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
      <line x1="89" y1="55" x2="77" y2="58" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
    `;
    mouth = `<line x1="61" y1="80" x2="79" y2="79" stroke="#3A2A22" stroke-width="2.8" stroke-linecap="round"/>`;
  } else if (mood === 'angry') {
    brows = `
      <line x1="50" y1="53" x2="64" y2="59" stroke="#B23B2E" stroke-width="3" stroke-linecap="round"/>
      <line x1="90" y1="53" x2="76" y2="59" stroke="#B23B2E" stroke-width="3" stroke-linecap="round"/>
    `;
    mouth = `<path d="M60 83 Q70 75 80 83" stroke="#B23B2E" stroke-width="3" stroke-linecap="round" fill="none"/>`;
    gesture = `<path d="M104 36 L114 30 M106 44 L117 42" stroke="#B23B2E" stroke-width="3" stroke-linecap="round"/>`;
  } else if (mood === 'ready') {
    mouth = `<path d="M58 76 Q70 89 82 76 Z" fill="#B23B2E" stroke="#3A2A22" stroke-width="2.2"/>`;
  }

  return wrapSvg(
    '0 0 140 160',
    `
      <!-- Ombra busto -->
      <ellipse cx="70" cy="148" rx="46" ry="8" fill="#000" fill-opacity="0.2"/>
      <!-- Busto e abito articolato -->
      <path d="M22 148 C25 112, 42 98, 70 98 C98 98, 115 112, 118 148 Z" fill="${outfit}" stroke="#3A2A22" stroke-width="3"/>
      <!-- Maglia interna e colletto -->
      <path d="M52 98 L70 126 L88 98 Z" fill="${shirt}" stroke="#3A2A22" stroke-width="2.2"/>
      <!-- Braccia appoggiate al bancone -->
      <path d="M22 146 C18 128, 28 112, 38 112" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M118 146 C122 128, 112 112, 102 112" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="42" cy="144" rx="10" ry="6.5" fill="${skin}" stroke="#3A2A22" stroke-width="2.2"/>
      <ellipse cx="98" cy="144" rx="10" ry="6.5" fill="${skin}" stroke="#3A2A22" stroke-width="2.2"/>
      ${bag ? '<line x1="40" y1="102" x2="88" y2="146" stroke="#3A2A22" stroke-width="5.5" stroke-linecap="round"/>' : ''}
      ${scarf ? `<path d="M48 96 Q70 109 92 96 L96 112 Q70 118 44 112 Z" fill="${scarf}" stroke="#3A2A22" stroke-width="2.2"/>` : ''}
      <!-- Collo e Orecchie -->
      <rect x="60" y="82" width="20" height="20" rx="8" fill="${skin}" stroke="#3A2A22" stroke-width="2.4"/>
      <circle cx="41" cy="64" r="6.5" fill="${skin}" stroke="#3A2A22" stroke-width="2.4"/>
      <circle cx="99" cy="64" r="6.5" fill="${skin}" stroke="#3A2A22" stroke-width="2.4"/>
      <!-- Viso -->
      <ellipse cx="70" cy="62" rx="28" ry="30" fill="${skin}" stroke="#3A2A22" stroke-width="3"/>
      <!-- Guance -->
      <circle cx="50" cy="70" r="5.5" fill="#D96B32" fill-opacity="0.28"/>
      <circle cx="90" cy="70" r="5.5" fill="#D96B32" fill-opacity="0.28"/>
      <!-- Capelli -->
      ${hairStyle === 'chignon' ? `<circle cx="70" cy="21" r="14" fill="${hair}" stroke="#3A2A22" stroke-width="2.6"/>` : ''}
      ${
        hairStyle === 'ricci'
          ? `<path d="M38 56 C33 34, 48 20, 70 20 C92 20, 107 34, 102 56 C94 43, 84 37, 70 37 C56 37, 46 43, 38 56 Z" fill="${hair}" stroke="#3A2A22" stroke-width="2.8"/>`
          : `<path d="M41 53 C42 32, 54 24, 70 24 C86 24, 98 32, 99 53 C90 42, 80 38, 70 38 C60 38, 50 42, 41 53 Z" fill="${hair}" stroke="#3A2A22" stroke-width="2.8"/>`
      }
      ${brows}
      <!-- Occhi espressivi con pupilla e punto luce -->
      <circle cx="57" cy="${eyeY}" r="4.2" fill="#3A2A22"/>
      <circle cx="83" cy="${eyeY}" r="4.2" fill="#3A2A22"/>
      <circle cx="55.5" cy="${eyeY - 1.5}" r="1.4" fill="#FFF9F1"/>
      <circle cx="81.5" cy="${eyeY - 1.5}" r="1.4" fill="#FFF9F1"/>
      <!-- Naso -->
      <path d="M70 63 L67 71 L72 72" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      ${mouth}
      ${
        glasses
          ? `<g stroke="#3A2A22" stroke-width="2.4" fill="#FFF9F1" fill-opacity="0.18">
              <circle cx="57" cy="${eyeY}" r="9"/>
              <circle cx="83" cy="${eyeY}" r="9"/>
              <line x1="66" y1="${eyeY}" x2="74" y2="${eyeY}"/>
            </g>`
          : ''
      }
      ${gesture}
    `,
  );
}

for (const cust of CUSTOMER_DESIGNS) {
  manifest.customers[cust.id] = {};
  for (const mood of ['happy', 'thinking', 'impatient', 'angry', 'ready']) {
    const relPath = `/game/art/customers/${cust.id}_${mood}.svg`;
    fs.writeFileSync(path.join(ROOT, 'public', relPath), renderCustomerSvg(cust, mood), 'utf8');
    manifest.customers[cust.id][mood] = relPath;
  }
  const baseRel = `/game/art/customers/${cust.id}.svg`;
  fs.writeFileSync(path.join(ROOT, 'public', baseRel), renderCustomerSvg(cust, 'happy'), 'utf8');
  manifest.customers[cust.id].default = baseRel;
}

// ---------------------------------------------------------------------------
// 4. 4 CUOCHI DELLA BRIGATA (140x160 viewBox)
// ---------------------------------------------------------------------------

function renderChefPersonaSvg(persona) {
  const av = persona.defaultAvatar;
  const skin = SKIN_TONES.find((s) => s.id === av.skinTone)?.hex || '#E3B18A';
  const hair = HAIR_COLORS.find((h) => h.id === av.hairColor)?.hex || '#543526';
  const apron = APRON_COLORS.find((a) => a.id === av.apronColor)?.hex || '#D96B32';
  const role = BRIGADE_ROLES.find((r) => r.id === av.role) || BRIGADE_ROLES[0];

  return wrapSvg(
    '0 0 140 160',
    `
      <ellipse cx="70" cy="148" rx="46" ry="8" fill="#000" fill-opacity="0.2"/>
      <!-- Casacca da cucina doppiopetto -->
      <path d="M22 148 C25 110, 42 96, 70 96 C98 96, 115 110, 118 148 Z" fill="#FFF9F1" stroke="#3A2A22" stroke-width="3"/>
      <!-- Grembiule con pettorina e tasca -->
      <path d="M40 102 H100 L106 148 H34 Z" fill="${apron}" stroke="#3A2A22" stroke-width="2.8"/>
      <path d="M50 102 V86 M90 102 V86" stroke="${apron}" stroke-width="5.5" stroke-linecap="round"/>
      <rect x="52" y="120" width="36" height="18" rx="4" fill="#FFF9F1" fill-opacity="0.35" stroke="#3A2A22" stroke-width="2"/>
      ${
        av.accessory === 'foulard'
          ? '<path d="M50 92 Q70 106 90 92 L96 110 L70 102 L44 110 Z" fill="#B23B2E" stroke="#3A2A22" stroke-width="2.2"/>'
          : ''
      }
      <!-- Collo e Viso -->
      <rect x="60" y="80" width="20" height="18" rx="7" fill="${skin}" stroke="#3A2A22" stroke-width="2.2"/>
      <circle cx="42" cy="62" r="6" fill="${skin}" stroke="#3A2A22" stroke-width="2.2"/>
      <circle cx="98" cy="62" r="6" fill="${skin}" stroke="#3A2A22" stroke-width="2.2"/>
      <ellipse cx="70" cy="60" rx="27" ry="29" fill="${skin}" stroke="#3A2A22" stroke-width="3"/>
      <circle cx="51" cy="67" r="5" fill="#D96B32" fill-opacity="0.3"/>
      <circle cx="89" cy="67" r="5" fill="#D96B32" fill-opacity="0.3"/>
      <!-- Capelli -->
      ${av.hairStyle === 'chignon' ? `<circle cx="70" cy="20" r="13" fill="${hair}" stroke="#3A2A22" stroke-width="2.6"/>` : ''}
      <path d="M40 52 C41 32, 53 23, 70 23 C87 23, 99 32, 100 52 C91 41, 81 37, 70 37 C59 37, 49 41, 40 52 Z" fill="${hair}" stroke="#3A2A22" stroke-width="2.8"/>
      ${
        av.hairStyle === 'bandana'
          ? '<path d="M40 44 C48 34, 92 34, 100 44 L98 53 C86 45, 54 45, 42 53 Z" fill="#D96B32" stroke="#3A2A22" stroke-width="2.4"/>'
          : ''
      }
      ${
        av.accessory === 'cappello_chef'
          ? '<path d="M42 36 C38 16, 50 6, 70 6 C90 6, 102 16, 98 36 Z" fill="#FFF9F1" stroke="#3A2A22" stroke-width="2.8"/>'
          : ''
      }
      <!-- Occhi e sorriso -->
      <circle cx="58" cy="60" r="4" fill="#3A2A22"/>
      <circle cx="82" cy="60" r="4" fill="#3A2A22"/>
      <circle cx="56.5" cy="58.5" r="1.3" fill="#FFF9F1"/>
      <circle cx="80.5" cy="58.5" r="1.3" fill="#FFF9F1"/>
      <path d="M59 73 Q70 82 81 73" stroke="#3A2A22" stroke-width="3" stroke-linecap="round" fill="none"/>
      ${
        av.accessory === 'occhiali'
          ? '<g stroke="#3A2A22" stroke-width="2.4" fill="none"><circle cx="58" cy="60" r="8.5"/><circle cx="82" cy="60" r="8.5"/><line x1="66.5" y1="60" x2="73.5" y2="60"/></g>'
          : ''
      }
      ${
        av.accessory === 'rametto_basilico'
          ? '<g transform="translate(88, 26)"><ellipse cx="8" cy="8" rx="10" ry="6" transform="rotate(-25 8 8)" fill="#5F8F3A" stroke="#3A2A22" stroke-width="2"/><ellipse cx="16" cy="13" rx="8" ry="5" transform="rotate(15 16 13)" fill="#487A2E" stroke="#3A2A22" stroke-width="2"/></g>'
          : ''
      }
      <!-- Badge Ruolo sul petto -->
      <rect x="44" y="130" width="52" height="16" rx="8" fill="#3A2A22" stroke="#FFF9F1" stroke-width="1.5"/>
      <text x="70" y="141" text-anchor="middle" fill="#FFF9F1" font-family="Karla, sans-serif" font-size="10" font-weight="bold">${role.shortLabel.toUpperCase()}</text>
    `,
  );
}

for (const persona of CHEF_PERSONAS) {
  const relPath = `/game/art/chefs/${persona.id}.svg`;
  fs.writeFileSync(path.join(ROOT, 'public', relPath), renderChefPersonaSvg(persona), 'utf8');
  manifest.chefs[persona.id] = relPath;
}

// ---------------------------------------------------------------------------
// 5. FOREGROUND COUNTER LAYER, PROPS & FX
// ---------------------------------------------------------------------------

const counterFgSvg = wrapSvg(
  '0 0 1280 540',
  `
    <defs>
      <linearGradient id="woodTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8F5633"/>
        <stop offset="50%" stop-color="#6E3E22"/>
        <stop offset="100%" stop-color="#4A2713"/>
      </linearGradient>
      <linearGradient id="steelBay" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#D8D2C9"/>
        <stop offset="50%" stop-color="#B5ADA2"/>
        <stop offset="100%" stop-color="#8A8279"/>
      </linearGradient>
      <linearGradient id="castIron" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#362B26"/>
        <stop offset="100%" stop-color="#1E1714"/>
      </linearGradient>
    </defs>
    <!-- Soglia bancone superiore (dove si affacciano i clienti) -->
    <rect x="0" y="182" width="1280" height="22" fill="#A66A43" stroke="#3A2A22" stroke-width="2.5"/>
    <rect x="0" y="200" width="1280" height="10" fill="#59311A"/>
    <!-- Fregio in maiolica vietrese sotto la soglia -->
    <rect x="0" y="210" width="1280" height="18" fill="#FFF9F1" stroke="#2D5A88" stroke-width="1.5"/>
    <!-- Piano principale di lavoro in legno massello scuro in prospettiva 2.5D -->
    <polygon points="0,228 1280,228 1280,540 0,540" fill="url(#woodTop)" stroke="#3A2A22" stroke-width="3"/>
    <!-- Venature del legno -->
    <line x1="0" y1="310" x2="1280" y2="310" stroke="#3A2A22" stroke-opacity="0.22" stroke-width="2"/>
    <line x1="0" y1="415" x2="1280" y2="415" stroke="#3A2A22" stroke-opacity="0.22" stroke-width="2"/>
    <!-- Alloggiamento Piastra in Ghisa a 4 Fuochi (Sinistra/Centro-Sinistra) -->
    <rect x="28" y="244" width="490" height="274" rx="18" fill="url(#castIron)" stroke="#6E5A4F" stroke-width="4"/>
    <!-- Alloggiamento Banchi Assemblaggio in Legno & Acciaio (Centro-Destra) -->
    <rect x="542" y="244" width="710" height="274" rx="18" fill="#EBD8BE" stroke="#4A2713" stroke-width="3.5"/>
  `,
);

fs.writeFileSync(path.join(ART_DIR, 'scenes', 'kitchen_counter_fg.svg'), counterFgSvg, 'utf8');

// Props & FX
const propsMap = {
  moka: wrapSvg(
    '0 0 64 64',
    `
      <polygon points="20,56 44,56 40,36 24,36" fill="#B8B2A8" stroke="#3A2A22" stroke-width="2.4"/>
      <rect x="22" y="32" width="20" height="5" rx="2" fill="#8C857B" stroke="#3A2A22" stroke-width="2"/>
      <polygon points="18,14 46,14 42,32 22,32" fill="#D6D1C7" stroke="#3A2A22" stroke-width="2.4"/>
      <polygon points="16,14 48,14 32,7" fill="#B8B2A8" stroke="#3A2A22" stroke-width="2.2"/>
      <circle cx="32" cy="5" r="3" fill="#3A2A22"/>
      <path d="M44 18 H52 V30 H42" stroke="#3A2A22" stroke-width="3.5" stroke-linejoin="round" fill="none"/>
    `,
  ),
  spatula: wrapSvg(
    '0 0 64 64',
    `
      <rect x="28" y="34" width="8" height="24" rx="4" fill="#8C4A27" stroke="#3A2A22" stroke-width="2.2"/>
      <polygon points="18,8 46,8 42,32 22,32" fill="#D8D2C9" stroke="#3A2A22" stroke-width="2.2"/>
      <line x1="25" y1="13" x2="25" y2="27" stroke="#3A2A22" stroke-width="2"/>
      <line x1="32" y1="13" x2="32" y2="27" stroke="#3A2A22" stroke-width="2"/>
      <line x1="39" y1="13" x2="39" y2="27" stroke="#3A2A22" stroke-width="2"/>
    `,
  ),
  bell_pass: wrapSvg(
    '0 0 64 64',
    `
      <ellipse cx="32" cy="50" rx="24" ry="6" fill="#593A28" stroke="#3A2A22" stroke-width="2.2"/>
      <path d="M12 48 C12 26, 52 26, 52 48 Z" fill="#F0B43E" stroke="#3A2A22" stroke-width="2.5"/>
      <circle cx="32" cy="22" r="4" fill="#D96B32" stroke="#3A2A22" stroke-width="2"/>
    `,
  ),
};

for (const [k, svg] of Object.entries(propsMap)) {
  const relPath = `/game/art/props/${k}.svg`;
  fs.writeFileSync(path.join(ROOT, 'public', relPath), svg, 'utf8');
  manifest.props[k] = relPath;
}

const fxMap = {
  steam: wrapSvg(
    '0 0 64 64',
    `
      <path d="M20 50 Q14 36 22 24 Q28 14 20 6" stroke="#FFF9F1" stroke-width="4" stroke-linecap="round" opacity="0.75" fill="none"/>
      <path d="M34 54 Q28 40 36 28 Q42 18 34 10" stroke="#FFF9F1" stroke-width="4" stroke-linecap="round" opacity="0.85" fill="none"/>
      <path d="M48 50 Q42 36 50 24 Q56 14 48 6" stroke="#FFF9F1" stroke-width="4" stroke-linecap="round" opacity="0.7" fill="none"/>
    `,
  ),
  ready_badge: wrapSvg(
    '0 0 64 64',
    `
      <circle cx="32" cy="32" r="26" fill="#5F8F3A" stroke="#FFF9F1" stroke-width="4"/>
      <polyline points="20 33 28 42 45 22" stroke="#FFF9F1" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `,
  ),
  warning_badge: wrapSvg(
    '0 0 64 64',
    `
      <polygon points="32,6 60,56 4,56" fill="#E39A2D" stroke="#3A2A22" stroke-width="3.5" stroke-linejoin="round"/>
      <line x1="32" y1="22" x2="32" y2="39" stroke="#3A2A22" stroke-width="5" stroke-linecap="round"/>
      <circle cx="32" cy="48" r="3" fill="#3A2A22"/>
    `,
  ),
  burned_smoke: wrapSvg(
    '0 0 64 64',
    `
      <circle cx="24" cy="38" r="14" fill="#2B211E" opacity="0.85"/>
      <circle cx="40" cy="32" r="16" fill="#1F1715" opacity="0.9"/>
      <circle cx="32" cy="20" r="12" fill="#3D302C" opacity="0.8"/>
      <path d="M22 28 L42 44 M42 28 L22 44" stroke="#FF6B57" stroke-width="4" stroke-linecap="round"/>
    `,
  ),
};

for (const [k, svg] of Object.entries(fxMap)) {
  const relPath = `/game/art/fx/${k}.svg`;
  fs.writeFileSync(path.join(ROOT, 'public', relPath), svg, 'utf8');
  manifest.fx[k] = relPath;
}

fs.writeFileSync(path.join(ART_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const jsModule = `/**
 * Manifest auto-generato degli asset 2.5D de "Il Banco del Gambero".
 * Associa in modo deterministico ID di ricette, ingredienti, cuochi, clienti e scene ai file in \`/game/art/\`.
 */
export const GAME_ART_MANIFEST = Object.freeze(${JSON.stringify(manifest, null, 2)});

export function getIngredientArtUrl(ingredientId, cookState = null) {
  if (cookState && GAME_ART_MANIFEST.grillStates?.[ingredientId]?.[cookState]) {
    return GAME_ART_MANIFEST.grillStates[ingredientId][cookState];
  }
  return GAME_ART_MANIFEST.ingredients?.[ingredientId] || null;
}

export function getRecipeArtUrl(recipeId) {
  return GAME_ART_MANIFEST.recipes?.[recipeId] || null;
}

export function getChefArtUrl(chefId) {
  return GAME_ART_MANIFEST.chefs?.[chefId] || GAME_ART_MANIFEST.chefs?.chef_gennaro || null;
}

export function getCustomerArtUrl(appearanceSeed = 1, mood = 'happy') {
  const idx = (Math.abs(Math.trunc(Number(appearanceSeed) || 1)) % 8) + 1;
  const key = \`customer_0\${idx}\`;
  const entry = GAME_ART_MANIFEST.customers?.[key] || GAME_ART_MANIFEST.customers?.customer_01;
  return entry?.[mood] || entry?.default || null;
}
`;

fs.writeFileSync(path.join(ROOT, 'src', 'game', 'data', 'artManifest.js'), jsModule, 'utf8');
console.log('Game 2.5D Art Pack built successfully.');
