/**
 * Sistema di personalizzazione per i cuochi giocabili e generatore deterministico
 * per l'aspetto dei clienti NPC. Separati dagli account recensioni del sito.
 */

export const CHEF_PERSONAS = [
  {
    id: 'chef_gennaro',
    name: 'Mastro Piastra',
    tagline: 'Specialista delle cotture al secondo',
    defaultAvatar: {
      skinTone: 'warm_olive',
      hairStyle: 'ricci',
      hairColor: 'castano',
      apronColor: 'terracotta',
      accessory: 'cappello_chef',
    },
  },
  {
    id: 'chef_chiara',
    name: 'Regina del Cuzzetiello',
    tagline: 'Assemblaggio rapido e salse perfette',
    defaultAvatar: {
      skinTone: 'light_peach',
      hairStyle: 'chignon',
      hairColor: 'nero',
      apronColor: 'verde_ulivo',
      accessory: 'rametto_basilico',
    },
  },
  {
    id: 'chef_tano',
    name: 'Re della Provola',
    tagline: 'Occhio clinico sui ticket personalizzati',
    defaultAvatar: {
      skinTone: 'deep_bronze',
      hairStyle: 'corti',
      hairColor: 'nero',
      apronColor: 'ocra',
      accessory: 'occhiali',
    },
  },
  {
    id: 'chef_sofia',
    name: 'Fulmine del Bancone',
    tagline: 'Consegne in combo e zero clienti persi',
    defaultAvatar: {
      skinTone: 'golden_tan',
      hairStyle: 'bandana',
      hairColor: 'biondo_ramato',
      apronColor: 'blu_golfo',
      accessory: 'foulard',
    },
  },
];

export const SKIN_TONES = [
  { id: 'light_peach', label: 'Chiara calda', hex: '#F4CFB4' },
  { id: 'warm_olive', label: 'Olivastra', hex: '#E3B18A' },
  { id: 'golden_tan', label: 'Ambrata', hex: '#C98E63' },
  { id: 'deep_bronze', label: 'Bronzo', hex: '#9B6341' },
  { id: 'rich_umber', label: 'Cacao', hex: '#6E422A' },
];

export const HAIR_STYLES = [
  { id: 'ricci', label: 'Ricci morbidi' },
  { id: 'corti', label: 'Taglio corto' },
  { id: 'chignon', label: 'Chignon alto' },
  { id: 'bandana', label: 'Bandana da cucina' },
];

export const HAIR_COLORS = [
  { id: 'nero', label: 'Nero corvino', hex: '#261C18' },
  { id: 'castano', label: 'Castano caldo', hex: '#543526' },
  { id: 'biondo_ramato', label: 'Ramato', hex: '#B55B2E' },
  { id: 'nocciola', label: 'Biondo miele', hex: '#C8964B' },
  { id: 'sale_pepe', label: 'Sale e pepe', hex: '#6E6A67' },
];

export const APRON_COLORS = [
  { id: 'terracotta', label: 'Terracotta', hex: '#D96B32' },
  { id: 'verde_ulivo', label: 'Verde ulivo', hex: '#5F8F3A' },
  { id: 'ocra', label: 'Ocra solare', hex: '#E39A2D' },
  { id: 'crema', label: 'Crema forno', hex: '#E8D5B7' },
  { id: 'blu_golfo', label: 'Blu golfo', hex: '#38617A' },
];

export const ACCESSORIES = [
  { id: 'nessuno', label: 'Nessuno' },
  { id: 'cappello_chef', label: 'Toque da banco' },
  { id: 'occhiali', label: 'Occhiali tondi' },
  { id: 'foulard', label: 'Foulard al collo' },
  { id: 'rametto_basilico', label: 'Foglia di basilico' },
];

export const NPC_NAMES = [
  'Marco',
  'Elena',
  'Luca',
  'Sara',
  'Nadia',
  'Dario',
  'Viola',
  'Teo',
  'Lidia',
  'Bruno',
  'Greta',
  'Nico',
  'Marta',
  'Leo',
  'Clara',
  'Enzo',
];

const NPC_JACKET_COLORS = [
  '#4A6B82',
  '#8C4A32',
  '#5A7D4C',
  '#B87B38',
  '#6E5266',
  '#3D5A45',
  '#A6523B',
];

/**
 * Normalizza e valida un oggetto avatar giocatore.
 */
export function normalizePlayerAvatar(raw = {}) {
  const persona = CHEF_PERSONAS.find((p) => p.id === raw.chefId) || CHEF_PERSONAS[0];
  const pick = (list, val, fallback) => (list.some((x) => x.id === val) ? val : fallback);

  return {
    chefId: persona.id,
    skinTone: pick(SKIN_TONES, raw.skinTone, persona.defaultAvatar.skinTone),
    hairStyle: pick(HAIR_STYLES, raw.hairStyle, persona.defaultAvatar.hairStyle),
    hairColor: pick(HAIR_COLORS, raw.hairColor, persona.defaultAvatar.hairColor),
    apronColor: pick(APRON_COLORS, raw.apronColor, persona.defaultAvatar.apronColor),
    accessory: pick(ACCESSORIES, raw.accessory, persona.defaultAvatar.accessory),
  };
}

/**
 * Costruisce un aspetto visivo deterministico per un cliente NPC a partire da un seed intero,
 * senza alcun legame tra aspetto e archetipo comportamentale.
 */
export function getNpcAppearance(seed = 1) {
  const s = Math.abs(Math.trunc(Number(seed) || 1));
  const skin = SKIN_TONES[s % SKIN_TONES.length];
  const hairStyle = HAIR_STYLES[Math.floor(s / 5) % HAIR_STYLES.length];
  const hairColor = HAIR_COLORS[Math.floor(s / 19) % HAIR_COLORS.length];
  const jacketColor = NPC_JACKET_COLORS[Math.floor(s / 37) % NPC_JACKET_COLORS.length];
  const hasGlasses = Math.floor(s / 71) % 3 === 0;
  const hasBag = Math.floor(s / 113) % 2 === 0;

  return {
    skinHex: skin.hex,
    hairStyle: hairStyle.id,
    hairHex: hairColor.hex,
    jacketHex: jacketColor,
    hasGlasses,
    hasBag,
  };
}
