/**
 * Copy della **Ruota del Gambero Moscio** (Gambero Moscio Food Picker).
 *
 * Eccezione intenzionale al tono generale di PNDR: qui il linguaggio è ironico,
 * colloquiale e con qualche parolaccia leggera — sempre riferito all'indecisione,
 * mai a persone o attività. Il resto dell'app resta pulito.
 */

export const WHEEL_KICKER = 'Il Gambero Moscio decide';
export const NAV_BUTTON_LABEL = 'Decidi per noi';
export const NAV_BUTTON_ARIA = 'Apri la Ruota del Gambero Moscio';

/** Titoli per fase (una frase forte, non un muro di battute). */
export const HEADLINE_IDLE = 'Non sai dove cazzo andare?';
export const SUBHEAD_IDLE = 'Il Gambero sceglie prima cosa mangi, poi dove.';
export const HEADLINE_TYPE_SPIN = 'Vediamo che cazzo mangi.';
export const HEADLINE_TYPE_REVEAL = 'Ok. Ora troviamo DOVE.';
export const HEADLINE_PLACE_SPIN = 'Sei locali. Una sola scelta.';
export const HEADLINE_RESULT = 'Il Gambero ha parlato.';
export const HEADLINE_EMPTY = 'Il Gambero è senza opzioni.';
export const SUBHEAD_EMPTY = 'Il database del Gambero è vuoto. Torna più tardi.';

export const CTA_START = 'Fai girare il Gambero';
export const CTA_SPINNING = 'Il Gambero sta decidendo…';
export const CTA_CLOSE = 'Chiudi';

// Nella card del risultato il titolo del modal dice già «Il Gambero ha parlato»:
// qui si evita la ripetizione e si passa direttamente al verdetto.
export const RESULT_EYEBROW = 'Stasera si mangia qui.';
export const RESULT_SINGLE_EYEBROW = 'Il Gambero non ha avuto molta scelta.';

export const ACTION_LOCATION = 'Vedi dove si trova';
export const ACTION_RESPIN = 'Fallo girare di nuovo';

/** Badge sui locali già presenti nel database delle recensioni PNDR. */
export const BADGE_ALREADY_REVIEWED = 'Ci siete già stati 👀';

/** Frase mentre gira la ruota delle tipologie. */
export const TYPE_SPIN_MESSAGES = [
  'Il Gambero sta scegliendo la categoria…',
  'Prima decidiamo COSA mangiare.',
  'Un attimo: il Gambero valuta il menù del destino.',
  'Vediamo che cazzo ti va stasera.',
];

/** Frase nell'interstiziale tra le due ruote (dopo la categoria). */
export const REVEAL_MESSAGES = [
  'Categoria decisa. Adesso non hai più scuse.',
  'Il Gambero ha scelto la tipologia. Ora si fa sul serio.',
  'Ok. Sei locali entrano nella sfida.',
];

/** Frase mentre gira la ruota dei locali. */
export const PLACE_SPIN_MESSAGES = [
  'Il Gambero sta cercando il tuo destino…',
  'Sei locali. Sta scegliendo.',
  'Non rompere il cazzo, sto decidendo.',
  'Il Gambero consulta il pescato del fato…',
];

/** Frase ironica sotto il risultato (scelta a caso a ogni estrazione). */
export const RESULT_MESSAGES = [
  'Il verdetto è servito. Non si torna indietro.',
  'Fanculo l’indecisione: stasera si mangia qui.',
  'Non sapevi dove andare. Adesso lo sai.',
  'Il destino ha deciso. E il destino ha fame.',
  'Ti sei tolto il problema dai coglioni. Prego.',
  'Il Gambero ha scelto. Ora muovi il culo.',
  'Non è democrazia. È gastronomia.',
  'Hai delegato la cena a un gambero. Ottima scelta.',
  'Il Gambero non sbaglia. Quasi mai.',
  'Non lamentarti adesso: la ruota l’hai girata tu.',
];
