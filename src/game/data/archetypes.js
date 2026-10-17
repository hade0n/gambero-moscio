/**
 * 8 Archetipi comportamentali dei clienti NPC de "Il Banco del Gambero".
 * Indipendenti da genere, aspetto, età, classe sociale o quartiere.
 */

export const CUSTOMER_ARCHETYPES = [
  {
    id: 'di_fretta',
    name: 'Di fretta',
    badgeLabel: 'Di fretta',
    description: 'Meno pazienza, ma chiede sempre un ordine rapido e lascia una bella mancia se servito subito.',
    patienceMultiplier: 0.78,
    bonusPoints: 35,
    bonusPatienceRatio: 0.45,
    minPhase: 1,
    minPlayers: 1,
    preferSimple: true,
    accentColor: '#D96B32',
    lines: {
      arrival: [
        'Uè, al volo che perdo la Cumana!',
        'Fammelo espresso, tengo i minuti contati.',
        'Qualcosa di rapido ma fatto bene, mi raccomando.',
      ],
      served: [
        'Un lampo! Proprio quello che ci voleva.',
        'Perfetto, preso al volo. Grazie!',
      ],
    },
  },
  {
    id: 'con_calma',
    name: 'Con calma',
    badgeLabel: 'Con calma',
    description: 'Più pazienza al bancone; può chiedere una piccola variazione di formaggio o salsa.',
    patienceMultiplier: 1.28,
    bonusPoints: 20,
    bonusPatienceRatio: 0.3,
    minPhase: 1,
    minPlayers: 1,
    canSwapVariant: true,
    accentColor: '#5F8F3A',
    lines: {
      arrival: [
        'Fai con calma, tanto oggi pomeriggio passeggio.',
        'Senza pressa: basta che il pane sia bello caldo.',
        'Me lo gusto piano piano, prenditi il tempo giusto.',
      ],
      served: [
        'Che profumo! Mo sì che si ragiona.',
        'Valso ogni secondo d’attesa.',
      ],
    },
  },
  {
    id: 'senza_cipolla',
    name: 'Senza cipolla',
    badgeLabel: 'Senza…',
    description: 'Chiede una ricetta classica escludendo un ingrediente specifico (es. senza cipolla).',
    patienceMultiplier: 1.08,
    bonusPoints: 25,
    bonusPatienceRatio: 0.35,
    minPhase: 1,
    minPlayers: 1,
    requiresExclusion: true,
    accentColor: '#B23B2E',
    lines: {
      arrival: [
        'Fratè, senza cipolla per favore!',
        'Tutto buono, ma toglimi quell’ingrediente dal ticket.',
        'Occhio alla nota sul biglietto, mi raccomando!',
      ],
      served: [
        'Preciso come l’avevo chiesto, grandi!',
        'Ecco, così è proprio come piace a me.',
      ],
    },
  },
  {
    id: 'affamato',
    name: 'Affamato',
    badgeLabel: 'Affamato',
    description: 'Ordina una ricetta ricca o con un ingrediente extra nelle fasi centrali e finali.',
    patienceMultiplier: 1.24,
    bonusPoints: 40,
    bonusPatienceRatio: 0.35,
    minPhase: 2,
    minPlayers: 1,
    requiresAddition: true,
    accentColor: '#E39A2D',
    lines: {
      arrival: [
        'Oggi c’ho una fame che si vede da lontano: abbonda!',
        'Uè, provola e friarielli belli carichi!',
        'Fammi un panino serio, che ho saltato il pranzo.',
      ],
      served: [
        'Madonna che capolavoro, pieno fino all’orlo!',
        'Questo sì che rimette al mondo.',
      ],
    },
  },
  {
    id: 'abituale',
    name: 'Cliente abituale',
    badgeLabel: 'Abituale',
    description: 'Conosce il menu a memoria: ricetta classica e bonus fedeltà se servita a buon ritmo.',
    patienceMultiplier: 1.05,
    bonusPoints: 30,
    bonusPatienceRatio: 0.45,
    minPhase: 1,
    minPlayers: 1,
    accentColor: '#385C32',
    lines: {
      arrival: [
        'Il solito mio, ormai ci capiamo al volo.',
        'Non potevo passare dal quartiere senza fermarmi al Banco.',
        'Uè ragazzi, fate il classico vostro!',
      ],
      served: [
        'Sempre una garanzia, non sbagliate un colpo.',
        'Il miglior banco della via, a domani!',
      ],
    },
  },
  {
    id: 'indeciso',
    name: 'Indeciso',
    badgeLabel: 'Indeciso',
    description: 'Pensa qualche istante prima di confermare; una volta avviata la preparazione non cambia mai idea.',
    patienceMultiplier: 1.22,
    bonusPoints: 25,
    bonusPatienceRatio: 0.35,
    minPhase: 2,
    minPlayers: 1,
    thinkingTimeMs: 3200,
    accentColor: '#6B564B',
    lines: {
      arrival: [
        'Aspè, fammi leggere un attimo la lavagna… ok, deciso!',
        'Tutto invitante oggi… dai, vado su questo!',
        'Due secondi che scelgo… ecco, confermato!',
      ],
      served: [
        'Ho fatto benissimo a scegliere questo!',
        'Scelta azzeccata, grazie della pazienza.',
      ],
    },
  },
  {
    id: 'ordine_doppio',
    name: 'Ordine doppio',
    badgeLabel: 'Doppio ×2',
    description: 'Porta due ticket collegati (uno per sé e uno da portare via), frequente con squadre da 3–4 cuochi.',
    patienceMultiplier: 1.38,
    bonusPoints: 50,
    bonusPatienceRatio: 0.3,
    minPhase: 2,
    minPlayers: 2,
    isDoubleOrder: true,
    accentColor: '#BB5A20',
    lines: {
      arrival: [
        'Ne prendo due: uno lo mangio qua e uno lo porto in studio!',
        'Doppio giro ragazzi, siamo in due ad aspettare!',
        'Due panini sul mio conto, fate gioco di squadra!',
      ],
      served: [
        'Tutti e due caldi insieme, coordinazione perfetta!',
        'Squadra affiatatissima, grazie mille!',
      ],
    },
  },
  {
    id: 'gruppo_amici',
    name: 'Gruppo di amici',
    badgeLabel: 'In compagnia',
    description: 'Due amici arrivano insieme al bancone, ciascuno con il proprio ticket e il proprio timer.',
    patienceMultiplier: 1.18,
    bonusPoints: 30,
    bonusPatienceRatio: 0.35,
    minPhase: 2,
    minPlayers: 2,
    spawnsCompanion: true,
    accentColor: '#E98B4A',
    lines: {
      arrival: [
        'Siamo insieme, ognuno col suo panino!',
        'Pausa insieme: facciamo due ordini separati.',
        'Eccoci qua, due ticket ma zero fretta!',
      ],
      served: [
        'Grande, ora possiamo brindare insieme!',
        'Buonissimo, ci vediamo alla prossima!',
      ],
    },
  },
];

export const ARCHETYPE_MAP = Object.freeze(
  Object.fromEntries(CUSTOMER_ARCHETYPES.map((a) => [a.id, Object.freeze(a)])),
);

export function getArchetype(id) {
  return ARCHETYPE_MAP[id] || CUSTOMER_ARCHETYPES[0];
}
