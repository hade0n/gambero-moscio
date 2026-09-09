# Gambero Moscio — UI/UX + Motion refactor · Audit

Presentation-layer only. Zero modifiche a business logic, dati, API, Blob, auth, ranking,
`ratings.js`/`ratingUtils.js`, discovery, Food Picker pipeline, routing, CRUD, validazione.
Branch: `refactor/ui-ux-motion`. Ordine di lavoro: §28 del brief.

## Stato di partenza — cosa è già buono

- Design system coerente: token colore semantici, scala `shadow-{xs..xl}` calda, gerarchia
  `rounded-{sm..3xl}`, `max-w-content`, `ease-pndr`. **Non** è "AI slop**"** — va elevato, non
  riscritto.
- Primitive solide: `.btn` / `.btn-*`, `.surface`, `.field-control`, `Modal` con focus trap +
  scroll lock + focus restore, `Icon` set unico, `ShrimpRating` (matematica intatta),
  `reduced-motion` globale.
- Palette e tipografia (Fraunces/Karla) da mantenere.

## Problemi rilevati (per area)

### App shell / Header
- **Overlap a ≤390px**: logo `absolute left-1/2` e CTA «Decidi per noi» `ml-auto` si
  sovrappongono → logo troncato. (§7, §43)
- Header mobile alto (`h-24`) per un solo logo + un bottone. Gerarchia debole.
- CTA della Ruota poco riconoscibile: `btn-secondary btn-sm` testo-solo, si confonde con le
  chip del filtro subito sotto.
- `backdrop-blur-sm` sempre attivo (costo mobile, §18) anche a scroll 0.

### Homepage / classifica
- Griglia piatta: #1/#2/#3 identici al resto, ranking non percepibile a colpo d'occhio. (§8)
- `RestaurantCard`: padding `p-5 sm:p-6` generoso, badge categoria + pin + rating impilati,
  poca gerarchia immagine→nome→voto. Aspetto `4/3` ok.
- Nessun reveal on-scroll; nessun feedback tattile oltre `active:bg-cream`.
- `CategoryFilter`: scroll-x senza mask/fade sui bordi, active state ok ma statico (nessun
  indicatore condiviso), `border-b` netto.

### RestaurantModal / Lightbox
- `Modal` base ora su Framer Motion (fatto in Fase 1). RestaurantModal resta un dialog
  "desktop-ish": manca hero pieno, close sticky, info sopra la fold ottimizzate mobile. (§11)
- Pill Ilenia/Salvatore: due bottoni affiancati, nessun indicatore attivo animato. (§37)
- `Lightbox`: portal proprio; verificare safe-area, dimensione, prev/next touch. (§12)

### Backend
- Da verificare: `BackendLayout`, `RestaurantListAdmin`, `PlaceForm`, `ReviewForm`,
  `ReviewPicker`, `ReviewStatus`, `ConfirmDeleteModal`. Rischio "dashboard SaaS". (§13)
- `ReviewForm`: 8 rating numerici ad alta densità → griglia mobile da riprogettare. (§38)

### Motion
- Sistema CSS: `.press`, keyframe `pndr-fade-in`/`wheel-result-in`/`modal-in`/`pndr-toast-*`.
  `modal-in` già orfano (Modal non lo usa più). Migrazione progressiva a Framer Motion.
- `Header` usa `window.addEventListener('scroll')` manuale → ok ma valutare `useScroll`.

### Token / hardcoded
- `RestaurantCard` usa `rounded-[18px]` (= `rounded-xl` token). Vari `text-[0.7rem]`,
  `min-h-[46px]`, `h-[68px]`, `h-[52px]` → spostare su scala dove esiste il token.

## Piano per fasi (§28)

| # | Fase | File principali | Stato |
|---|------|-----------------|-------|
| 1 | Fondamenta: token motion + `MotionConfig` + `Modal` su Framer Motion + CLAUDE.md | `lib/motion.js`, `lib/cn.js`, `main.jsx`, `Modal.jsx`, `CLAUDE.md` | ✅ `3cc28ac` |
| 2 | Shell + Header + Home/Filter/Card | `Header.jsx`, `CategoryFilter.jsx`, `RestaurantCard.jsx`, `RestaurantList.jsx`, `Home.jsx`, `Skeleton.jsx` | ✅ `e5a54d1` |
| 3 | Primitive comuni (create-on-need): `IconButton`, `SectionHeader`, `Skeleton` | `components/` | ✅ (in 4/6) |
| 4 | RestaurantModal (hero full-bleed, close ancorata, review switch `layoutId`, breakdown animato) | `Modal.jsx`, `IconButton.jsx`, `RestaurantModal.jsx`, `RatingBreakdown.jsx` | ✅ `6fea465` |
| 5 | Lightbox touch-first (AnimatePresence, swipe, safe-area) | `Lightbox.jsx`, `Icon.jsx` | ✅ `a186092` |
| 6 | Backend: `SectionHeader`, list/table, azioni, badge, skeleton, login | `BackendLayout.jsx`, `RestaurantListAdmin.jsx`, `ReviewStatus.jsx`, `Backend.jsx`, `Login.jsx` | ✅ `0d1cb31` |
| 7 | Form mobile: `ReviewForm` (righe compatte), `PlaceForm`, `ReviewPicker`, footer sticky | `ReviewForm.jsx`, `PlaceForm.jsx`, `ReviewPicker.jsx` | ✅ `be32d5e` |
| 8 | Gambero Picker: modal AnimatePresence, headline crossfade, OptionRail, result | `GamberoModal.jsx`, `GamberoResult.jsx` | ✅ `e4f9491` |
| 9 | Toast su Framer Motion | `Toast.jsx` | ✅ `3275a7a` |
| 10 | Rimozione CSS motion morto | `index.css` | ✅ `44278d7` |
| 11 | Responsive QA (360/390/430/768/1440) + build finale + smoke test | — | ✅ (build verde, nessun overflow) |
| 12 | **Wheeler — redesign da zero** (3D premium) | `GamberoWheel.jsx`, `GamberoResult.jsx` | ✅ `<hash>` |

## Fase 12 — Wheeler premium (deroga esplicita al "no 3D" per questo componente)

`GamberoWheel.jsx` riscritto da zero. **Matematica del vincitore intatta**: consuma
`rotation` da `useGamberoWheel` invariato; il disco ruota di un valore SOLO CRESCENTE
`spin ≡ (360 − rotation mod 360) (mod 360)`, quindi il segmento vincente finisce
esattamente sotto il puntatore fisso a ore 12 (verificato: candidato #5 "Passione di Sofì"
→ pointer su segmento 5; disco a 25,5° con seg=60 → `5,5·60 + 25,5 ≡ 355,5°`, dentro
`[325,5°, 25,5°]` = segmento 5 ✓). Lo swap tipologie→locali resta forward-only.

- Cornice a livelli concentrici (green-deep + cream) con shadow/inset, niente border piatto.
- Prospettiva 3D: `perspective` + `rotateX/Y` che seguono il mouse (spring, ±5°), **solo
  desktop**; su touch/reduced-motion tilt fisso a 6° o nullo.
- Puntatore fisico nuovo (goccia terracotta con drop-shadow + highlight), lean di −7° durante
  lo spin, micro-"tick" all'arresto.
- Spin con easing fisicamente credibile (`cubic-bezier(0.33,0,0.15,1)`, non lineare),
  micro-blur mappato da `useVelocity` (≤1,6px, solo desktop), idle float ±3px + ombra che
  respira (6s, azzerati da reduced-motion).
- Segmenti con etichette leggibili (≤8 opzioni; oltre, solo colore + nome nel risultato).
- `GamberoResult`: overlay gradient leggero sull'immagine + badge categoria in sovrimpressione.

Reduced-motion: pipeline istantanea e funzionale, nessun errore. Mobile 390: wheel 304px,
nessun overflow. Nuova dipendenza: nessuna (solo hook di `framer-motion` già presente).

## Note per l'utente

- Non toccati: `useGamberoWheel`, la rotazione/timing di `GamberoWheel`, Fisher-Yates,
  winner math; `ratings.js`, `ratingUtils.js`; `discovery.js`; API/Blob/auth/sessioni;
  contratti dei form (nomi campi, validazione, payload); routing; `src/data/*`;
  `public/gambero/*`; `AGENTS.md` (lavoro in corso, lasciato invariato).
- Nuova dipendenza runtime: `framer-motion` (unica). shadcn/Magic/Aceternity usati come
  pattern portati a mano (nessun pacchetto). Bundle JS: 254→393 KB (gzip 80→124 KB).
- Verifica ancora da fare a mano: **dashboard backend dietro login** (create/update/delete
  locale, ReviewPicker, salvataggio recensione Ilenia/Salvatore, upload immagini) — le
  modifiche sono presentazionali e il build è verde, ma non ho effettuato il login.
