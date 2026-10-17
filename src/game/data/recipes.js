/**
 * Ricettario ufficiale de "Il Banco del Gambero".
 * Ogni ricetta definisce ingredienti obbligatori, varianti ammesse,
 * stazioni richieste, difficoltà e tempi base di pazienza.
 */
import { INGREDIENT_MAP, STATIONS } from './ingredients.js';

export const RECIPES = [
  {
    id: 'classico_gambero',
    name: 'Classico del Gambero',
    description: 'Pane burger, manzo alla piastra, provola, lattuga, pomodoro e salsa della casa.',
    bread: 'pane_burger',
    ingredients: [
      'pane_burger',
      'burger_manzo',
      'provola',
      'lattuga',
      'pomodoro',
      'salsa_casa',
    ],
    removableIngredients: ['pomodoro', 'lattuga', 'salsa_casa'],
    allowedAdditions: ['cipolla', 'cetriolini', 'crocche'],
    variantSwaps: { provola: 'fior_di_latte' },
    requiresGrill: true,
    stationsRequired: [STATIONS.BREAD, STATIONS.GRILL, STATIONS.COLD, STATIONS.SAUCE],
    difficulty: 2,
    minPhase: 1,
    basePatienceMs: 46000,
    basePoints: 130,
  },
  {
    id: 'salsiccia_friarielli',
    name: 'Salsiccia e friarielli',
    description: 'Pane casereccio caldo con salsiccia alla griglia, friarielli e provola.',
    bread: 'pane_casereccio',
    ingredients: [
      'pane_casereccio',
      'salsiccia',
      'friarielli',
      'provola',
    ],
    removableIngredients: ['provola'],
    allowedAdditions: ['salsa_piccante', 'crocche'],
    variantSwaps: { provola: 'fior_di_latte' },
    requiresGrill: true,
    stationsRequired: [STATIONS.BREAD, STATIONS.GRILL, STATIONS.WARM, STATIONS.COLD],
    difficulty: 1,
    minPhase: 1,
    basePatienceMs: 42000,
    basePoints: 115,
  },
  {
    id: 'cuzzetiello_ragu',
    name: 'Cuzzetiello al ragù',
    description: 'Cuzzetiello croccante ripieno di polpette morbide e ragù napoletano.',
    bread: 'cuzzetiello',
    ingredients: [
      'cuzzetiello',
      'polpette',
      'ragu',
    ],
    removableIngredients: [],
    allowedAdditions: ['provola', 'basilico', 'parmigiana_melanzane'],
    variantSwaps: {},
    requiresGrill: false,
    stationsRequired: [STATIONS.BREAD, STATIONS.WARM, STATIONS.SAUCE],
    difficulty: 1,
    minPhase: 1,
    basePatienceMs: 36000,
    basePoints: 100,
  },
  {
    id: 'crocche_provola',
    name: 'Crocchè e provola',
    description: 'Pane soffice, crocchè di patate dorato, provola filante e salsa della casa.',
    bread: 'pane_burger',
    ingredients: [
      'pane_burger',
      'crocche',
      'provola',
      'salsa_casa',
    ],
    removableIngredients: ['salsa_casa'],
    allowedAdditions: ['maionese', 'ketchup', 'lattuga'],
    variantSwaps: { salsa_casa: 'maionese', provola: 'fior_di_latte' },
    requiresGrill: false,
    stationsRequired: [STATIONS.BREAD, STATIONS.WARM, STATIONS.COLD, STATIONS.SAUCE],
    difficulty: 1,
    minPhase: 1,
    basePatienceMs: 37000,
    basePoints: 105,
  },
  {
    id: 'parmigiana',
    name: 'Parmigiana',
    description: 'Pane casereccio, parmigiana di melanzane, provola o fior di latte e basilico.',
    bread: 'pane_casereccio',
    ingredients: [
      'pane_casereccio',
      'parmigiana_melanzane',
      'provola',
      'basilico',
    ],
    removableIngredients: ['basilico'],
    allowedAdditions: ['ragu', 'polpette'],
    variantSwaps: { provola: 'fior_di_latte' },
    requiresGrill: false,
    stationsRequired: [STATIONS.BREAD, STATIONS.WARM, STATIONS.COLD],
    difficulty: 1,
    minPhase: 1,
    basePatienceMs: 38000,
    basePoints: 110,
  },
  {
    id: 'pollo_croccante',
    name: 'Pollo croccante',
    description: 'Pane burger, pollo dorato sulla piastra, lattuga, pomodoro e maionese.',
    bread: 'pane_burger',
    ingredients: [
      'pane_burger',
      'pollo',
      'lattuga',
      'pomodoro',
      'maionese',
    ],
    removableIngredients: ['pomodoro', 'maionese', 'lattuga'],
    allowedAdditions: ['provola', 'ketchup', 'cetriolini'],
    variantSwaps: { maionese: 'salsa_casa' },
    requiresGrill: true,
    stationsRequired: [STATIONS.BREAD, STATIONS.GRILL, STATIONS.COLD, STATIONS.SAUCE],
    difficulty: 2,
    minPhase: 2,
    basePatienceMs: 45000,
    basePoints: 125,
  },
  {
    id: 'piccante',
    name: 'Piccante',
    description: 'Pane burger, burger di manzo, provola, cipolla ramata e salsa piccante.',
    bread: 'pane_burger',
    ingredients: [
      'pane_burger',
      'burger_manzo',
      'provola',
      'cipolla',
      'salsa_piccante',
    ],
    removableIngredients: ['cipolla'],
    allowedAdditions: ['friarielli', 'cetriolini'],
    variantSwaps: { provola: 'fior_di_latte' },
    requiresGrill: true,
    stationsRequired: [STATIONS.BREAD, STATIONS.GRILL, STATIONS.COLD, STATIONS.SAUCE],
    difficulty: 2,
    minPhase: 1,
    basePatienceMs: 44000,
    basePoints: 125,
  },
  {
    id: 'verde',
    name: 'Verde',
    description: 'Pane casereccio, burger vegetale, lattuga, pomodoro, cetriolini e salsa della casa.',
    bread: 'pane_casereccio',
    ingredients: [
      'pane_casereccio',
      'burger_vegetale',
      'lattuga',
      'pomodoro',
      'cetriolini',
      'salsa_casa',
    ],
    removableIngredients: ['cetriolini', 'pomodoro', 'salsa_casa'],
    allowedAdditions: ['fior_di_latte', 'basilico'],
    variantSwaps: { salsa_casa: 'maionese' },
    requiresGrill: true,
    stationsRequired: [STATIONS.BREAD, STATIONS.GRILL, STATIONS.COLD, STATIONS.SAUCE],
    difficulty: 2,
    minPhase: 2,
    basePatienceMs: 46000,
    basePoints: 130,
  },
];

export const RECIPE_MAP = Object.freeze(
  Object.fromEntries(RECIPES.map((r) => [r.id, Object.freeze(r)])),
);

export function getRecipe(id) {
  return RECIPE_MAP[id] || null;
}

/**
 * Verifica che una ricetta e i suoi eventuali modificatori producano
 * sempre una lista valida di ingredienti esistenti e preparabili.
 */
export function buildTicketIngredients(recipeId, modifiers = {}) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;

  let list = [...recipe.ingredients];

  // Applica eventuale swap di variante (es. provola -> fior_di_latte)
  if (modifiers.swap && recipe.variantSwaps?.[modifiers.swap.from] === modifiers.swap.to) {
    list = list.map((ing) => (ing === modifiers.swap.from ? modifiers.swap.to : ing));
  }

  // Applica eventuale esclusione (es. senza cipolla)
  if (modifiers.exclude) {
    if (!recipe.removableIngredients.includes(modifiers.exclude)) {
      return null;
    }
    list = list.filter((ing) => ing !== modifiers.exclude);
  }

  // Applica eventuale aggiunta (es. cliente affamato o con calma)
  if (modifiers.add) {
    if (!recipe.allowedAdditions.includes(modifiers.add) || list.includes(modifiers.add)) {
      return null;
    }
    list.push(modifiers.add);
  }

  // Verifica che ci sia almeno il pane + 1 farcitura e che tutti gli ID siano validi
  if (list.length < 2) return null;
  for (const ingId of list) {
    if (!INGREDIENT_MAP[ingId]) return null;
  }

  return list;
}
