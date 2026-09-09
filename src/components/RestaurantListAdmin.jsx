import { motion } from 'framer-motion';
import IconButton from './IconButton.jsx';
import ReviewStatus from './ReviewStatus.jsx';
import ShrimpRating from './ShrimpRating.jsx';
import { cn } from '../lib/cn.js';
import { listItem, inViewOnce } from '../lib/motion.js';
import { calculateRankingScore } from '../utils/ratings.js';

function rankScore(r) {
  return typeof r.rankingScore === 'number' ? r.rankingScore : calculateRankingScore(r.ratings);
}

/** Voto aggregato del locale, oppure indicazione "senza recensioni". */
function AggregateRating({ restaurant, showScore = false }) {
  if (!restaurant.reviewCount) {
    return <span className="text-sm font-medium text-brown-soft">Nessuna recensione</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <ShrimpRating rating={restaurant.ratings.overall} size="sm" />
      {showScore && (
        <span className="tabular text-[0.68rem] font-medium text-brown-soft/80">
          classifica {rankScore(restaurant).toFixed(4)}
        </span>
      )}
    </span>
  );
}

function RowActions({ restaurant, onEditPlace, onDelete, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <IconButton
          icon="edit"
          label={`Modifica i dati del locale ${restaurant.name}`}
          size="md"
          variant="solid"
          iconSize={17}
          onClick={() => onEditPlace(restaurant)}
        />
        <IconButton
          icon="trash"
          label={`Elimina il locale ${restaurant.name}`}
          size="md"
          variant="solid"
          iconSize={17}
          onClick={() => onDelete(restaurant)}
          className="text-danger hover:bg-danger/10"
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onEditPlace(restaurant)}
        aria-label={`Modifica i dati del locale ${restaurant.name}`}
        className="btn btn-outline btn-sm"
      >
        Modifica locale
      </button>
      <button
        type="button"
        onClick={() => onDelete(restaurant)}
        aria-label={`Elimina il locale ${restaurant.name}`}
        className="btn btn-danger-outline btn-sm"
      >
        Elimina
      </button>
    </div>
  );
}

/**
 * Elenco amministrativo dei locali: card su mobile, tabella da lg.
 * Le recensioni si scrivono da "Scrivi recensione"; qui si gestiscono i dati
 * del locale.
 */
export default function RestaurantListAdmin({ restaurants, onEditPlace, onDelete }) {
  return (
    <>
      {/* Mobile / tablet: card */}
      <ul className="space-y-3 lg:hidden">
        {restaurants.map((r) => (
          <motion.li
            key={r.id}
            className="surface p-4"
            variants={listItem}
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-semibold">{r.name}</h3>
                <p className="mt-0.5 truncate text-sm text-brown-soft">
                  {r.town} ({r.province}) · {r.category}
                </p>
              </div>
              <RowActions
                restaurant={r}
                onEditPlace={onEditPlace}
                onDelete={onDelete}
                compact
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-brown/8 pt-2.5">
              <AggregateRating restaurant={r} />
              <ReviewStatus reviews={r.reviews} className="ml-auto" />
            </div>
          </motion.li>
        ))}
      </ul>

      {/* Desktop: tabella */}
      <div className="surface hidden overflow-hidden lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-cream text-xs font-semibold uppercase tracking-wide text-brown-soft">
              <th className="px-4 py-3">Locale</th>
              <th className="px-4 py-3">Città</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Voto</th>
              <th className="px-4 py-3">Recensioni</th>
              <th className="px-4 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r) => (
              <tr
                key={r.id}
                className="border-b transition-colors last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 text-brown-soft">
                  {r.town} ({r.province})
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-deep">
                    {r.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <AggregateRating restaurant={r} showScore />
                </td>
                <td className="px-4 py-3">
                  <ReviewStatus reviews={r.reviews} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RowActions restaurant={r} onEditPlace={onEditPlace} onDelete={onDelete} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
