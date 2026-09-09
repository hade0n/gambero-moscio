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
| 1 | Fondamenta: token motion + `MotionConfig` + `Modal` su Framer Motion + CLAUDE.md | `lib/motion.js`, `lib/cn.js`, `main.jsx`, `Modal.jsx`, `CLAUDE.md` | ✅ fatto |
| 2 | Shell + Header + Home/Filter/Card | `Header.jsx`, `CategoryFilter.jsx`, `RestaurantCard.jsx`, `RestaurantList.jsx`, `Home.jsx`, `EmptyState.jsx` | ▶ in corso |
| 3 | Primitive comuni: `Surface`, `SectionHeader`, `IconButton`, `Skeleton`, varianti | `lib/`, `components/` | ⏳ |
| 4 | RestaurantModal (sheet mobile, review switch `layoutId`, breakdown) | `RestaurantModal.jsx`, `RatingBreakdown.jsx` | ⏳ |
| 5 | Gallery + Lightbox (touch) | `Lightbox.jsx` | ⏳ |
| 6 | Backend: layout, list/table, empty/loading, azioni | `BackendLayout.jsx`, `RestaurantListAdmin.jsx`, `ReviewStatus.jsx`, `Backend.jsx`, `Login.jsx` | ⏳ |
| 7 | Form mobile: `PlaceForm`, `ReviewForm` (8 rating), upload | `PlaceForm.jsx`, `ReviewForm.jsx`, `ReviewPicker.jsx`, `Field.jsx` | ⏳ |
| 8 | Gambero Picker: modal, ruota, candidati, result | `GamberoModal.jsx`, `GamberoWheel.jsx`, `GamberoResult.jsx` | ⏳ |
| 9 | Toast / empty / loading / error | `Toast.jsx`, `ToastContainer.jsx`, `ConfirmDeleteModal.jsx` | ⏳ |
| 10 | Motion polish + rimozione CSS morto | `index.css` | ⏳ |
| 11 | Responsive QA (360→1920) + funzionale + performance + `npm run build` | — | ⏳ |
