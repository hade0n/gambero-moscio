# Gambero Wheel — audit e piano di ripristino

## Esito dell'audit del 9 settembre 2026

Lo stato attuale non soddisfa l'obiettivo dichiarato di un food picker basato sui
25 migliori locali per tipologia.

| Voce | Riscontro |
| --- | --- |
| Locali nel database discovery | 70 |
| Tipologie | 8 |
| Locali per tipologia | 5–15, mai 25 |
| Foto locali disponibili | 20/70 |
| Telefoni disponibili | 62/70 |
| Indirizzi completi | 34/70 |
| Coordinate | 24/70 |
| Place ID | 0/70 |
| Duplicati `id` / `placeId` | 0 / non verificabile senza placeId |

Le otto tipologie mantengono ranghi consecutivi, ma il loro numero è insufficiente
per poter affermare che il picker pesca dai top 25. Inoltre alcuni ranghi non sono
coerenti con il voto indicativo registrato: il voto non può essere considerato una
classifica documentata finché non viene associato a una fonte per singolo locale.

## Direttiva di esecuzione

Porta il Gambero Food Picker a uno stato verificabile e pubblicabile senza alterare
le recensioni PNDR, Vercel Blob, autenticazione, calcolo dei voti o la casualità della
ruota.

### 1. Correggi l'esperienza della ruota

- Sostituisci il controllo nell'header con una CTA editoriale leggibile e proporzionata,
  senza l'attuale icona della ruota. Il testo deve rendere evidente l'azione (es.
  `Decidi per noi`) e mantenere il target di 48 px.
- Rimuovi il gambero grande dal centro della ruota. Il Gambero resta elemento di brand,
  copy e sistema di rating; la ruota usa un selettore geometrico discreto, ad alto
  contrasto, che non copre le etichette.
- Mantieni la pipeline deterministica: tipologia -> campione uniforme di massimo 6 ->
  vincitore uniforme. Non usare rating o rank per la probabilità.
- Conserva modal fullscreen, ESC, focus restore, reduced motion e il controllo contro
  click ripetuti.
- Le etichette devono mostrare la tipologia completa: non ridurre `Ristorante Pesce` a
  `Pesce` e non rendere illeggibili i nomi dei candidati.

### 2. Rendi il database discovery una fonte dati reale

- Mantieni `src/data/gamberoDiscovery.json` come unica sorgente discovery e separata
  dai locali recensiti in Vercel Blob.
- Per ogni tipologia attuale completa una lista ordinata fino a 25 locali univoci della
  Campania. Se una lista non può raggiungere 25 con fonti verificabili, registra la
  ragione nel report e non inventare record.
- Per ogni record salva almeno: `id`, `category`, `rank`, `name`, `city`, `province`,
  `address`, `lat`, `lng`, `phone`, `mapsUrl`, `rating` solo se la fonte lo documenta,
  `reviewCount` quando disponibile, `description`, `photoUrl`, `website`, `placeId` se
  disponibile, più `sources` con URL e data di verifica.
- Non trattare un voto editoriale, Google o una guida come equivalenti senza salvarne la
  fonte. Il rank della tipologia deve derivare da una fonte/revisione dichiarata.
- Niente record duplicati: deduplica per placeId, poi nome normalizzato + indirizzo.

### 3. Pipeline di ricerca e arricchimento, senza dati inventati

- Aggiungi `scripts/audit-gambero-db.mjs`: report per categoria con numero record, ranghi
  mancanti/duplicati, campi completi, foto presenti, telefoni, indirizzi, coordinate,
  fonti e file immagine mancanti.
- Aggiungi un processo di raccolta ripetibile. Per ranking e identità privilegia fonti
  editoriali/ufficiali; per telefono e indirizzo privilegia sito ufficiale e markup
  `schema.org`; per coordinate usa una ricerca geografica con match esatto su nome+
  indirizzo; conserva la URL della fonte.
- Scarica in `public/gambero/` solo immagini inequivocabilmente del locale e registrane
  `photoSource`. Priorità: sito ufficiale del locale, Wikimedia Commons con match esatto,
  altra fonte con permesso/attribuzione chiara. Mai usare foto generiche, logo, chef,
  panorama della città o locale omonimo.
- Non fare scraping dell'HTML di Google Maps e non esporre chiavi API nel client. Se una
  foto o un telefono non è verificabile, lascia il campo vuoto e segnala il record nel
  report; la card usa il fallback editoriale.
- Il fetch di una foto non deve dipendere da una chiamata `/api/place-photo` destinata a
  fallire quando non c'è una chiave. La card deve mostrare una foto locale solo quando il
  dataset la possiede davvero.

### 4. Card risultato e link

- Mostra immagine locale scaricata, con spazio riservato e fallback coerente quando non
  esiste. Il Gambero non può mai apparire come fotografia del ristorante.
- Mostra `Chiama …` solo per telefono verificato e normalizzato; il link `tel:` deve
  puntare al valore normalizzato.
- `Vedi dove si trova` deve usare le coordinate quando presenti, altrimenti un deep link
  di ricerca basato su nome+città. Non mostrare informazioni fittizie.
- Conserva il match con i locali PNDR e il badge/voti di Ilenia e Salvatore quando il
  locale è già recensito.

### 5. Verifica obbligatoria prima della consegna

- Esegui l'audit prima e dopo l'arricchimento e conserva il report finale.
- Verifica che ogni categoria abbia 25 record oppure una motivazione documentata per il
  numero minore.
- Verifica tutte le foto locali con una richiesta HTTP e un controllo visivo a campione.
- Verifica ogni numero in formato telefonico e ogni link `tel:`.
- Verifica che il campione di 6 provenga sempre dalla categoria corretta e che il vincitore
  appartenga sempre al campione.
- Esegui almeno 100 selezioni di test per la matematica della ruota.
- Esegui `npm run build` senza errori e controlla assenza di errori browser.
