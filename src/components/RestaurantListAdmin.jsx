import Icon from './Icon.jsx';
import { calculateRankingScore, formatRating } from '../utils/ratings.js';

/** Punteggio classifica ad alta precisione: informazione tecnica solo per il backend. */
function rankScore(r) {
  return typeof r.rankingScore === 'number' ? r.rankingScore : calculateRankingScore(r.ratings);
}

/** Azioni Modifica / Elimina con area interattiva ≥ 48×48px. */
function RowActions({ restaurant, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onEdit(restaurant)}
        aria-label={`Modifica la recensione di ${restaurant.name}`}
        className="btn btn-outline btn-sm min-w-[44px]"
      >
        <Icon name="edit" size={16} />
        <span className="hidden sm:inline">Modifica</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(restaurant)}
        aria-label={`Elimina la recensione di ${restaurant.name}`}
        className="btn btn-danger-outline btn-sm min-w-[44px]"
      >
        <Icon name="trash" size={16} />
        <span className="hidden sm:inline">Elimina</span>
      </button>
    </div>
  );
}

/**
 * Elenco amministrativo: card verticali su mobile, tabella da lg.
 * Stessa collezione della homepage.
 */
export default function RestaurantListAdmin({ restaurants, onEdit, onDelete }) {
  return (
    <>
      {/* Mobile / tablet: card */}
      <ul className="space-y-3 lg:hidden">
        {restaurants.map((r) => (
          <li key={r.id} className="surface reveal-in p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{r.name}</h3>
                <p className="mt-0.5 text-sm text-brown-soft">
                  {r.town} ({r.province}) · {r.category}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-brown">
                  <span className="flex items-center gap-1.5">
                    <Icon name="star" size={15} className="text-rating" />
                    <span className="tabular">{formatRating(r.ratings.overall)}</span>
                  </span>
                  <span className="tabular text-xs font-medium text-brown-soft">
                    classifica {rankScore(r).toFixed(4)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <RowActions restaurant={r} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
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
              <th className="px-4 py-3">Classifica</th>
              <th className="px-4 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 text-brown-soft">
                  {r.town} ({r.province})
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 text-xs font-semibold text-green-deep">
                    {r.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Icon name="star" size={15} className="text-rating" />
                    <span className="tabular">{formatRating(r.ratings.overall)}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="tabular text-sm text-brown-soft">{rankScore(r).toFixed(4)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RowActions restaurant={r} onEdit={onEdit} onDelete={onDelete} />
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
