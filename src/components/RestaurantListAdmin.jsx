import Icon from './Icon.jsx';
import ReviewStatus from './ReviewStatus.jsx';
import { calculateRankingScore, formatRating } from '../utils/ratings.js';

function rankScore(r) {
  return typeof r.rankingScore === 'number' ? r.rankingScore : calculateRankingScore(r.ratings);
}

/** Voto aggregato del locale, oppure indicazione "senza recensioni". */
function AggregateRating({ restaurant }) {
  if (!restaurant.reviewCount) {
    return <span className="text-sm font-medium text-brown-soft">Nessuna recensione</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-2 font-semibold">
      <span className="inline-flex items-center gap-1.5">
        <Icon name="star" size={15} className="text-rating" />
        <span className="tabular">{formatRating(restaurant.ratings.overall)}</span>
      </span>
      <span className="tabular text-xs font-medium text-brown-soft">
        classifica {rankScore(restaurant).toFixed(4)}
      </span>
    </span>
  );
}

function RowActions({ restaurant, onEditPlace, onDelete }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onEditPlace(restaurant)}
        aria-label={`Modifica i dati del locale ${restaurant.name}`}
        className="btn btn-outline btn-sm min-w-[44px]"
      >
        <Icon name="edit" size={16} />
        <span className="hidden sm:inline">Modifica locale</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(restaurant)}
        aria-label={`Elimina il locale ${restaurant.name}`}
        className="btn btn-danger-outline btn-sm min-w-[44px]"
      >
        <Icon name="trash" size={16} />
        <span className="hidden sm:inline">Elimina</span>
      </button>
    </div>
  );
}

/**
 * Elenco amministrativo dei locali: card su mobile, tabella da lg.
 * Ogni riga mostra lo stato delle due recensioni. Le recensioni si scrivono
 * dal pulsante "Scrivi recensione"; qui si gestiscono i dati del locale.
 */
export default function RestaurantListAdmin({ restaurants, onEditPlace, onDelete }) {
  return (
    <>
      {/* Mobile / tablet: card */}
      <ul className="space-y-3 lg:hidden">
        {restaurants.map((r) => (
          <li key={r.id} className="surface reveal-in p-4">
            <h3 className="truncate text-base font-semibold">{r.name}</h3>
            <p className="mt-0.5 text-sm text-brown-soft">
              {r.town} ({r.province}) · {r.category}
            </p>
            <div className="mt-1.5">
              <AggregateRating restaurant={r} />
            </div>
            <ReviewStatus reviews={r.reviews} className="mt-2" />
            <div className="mt-3 flex justify-end">
              <RowActions restaurant={r} onEditPlace={onEditPlace} onDelete={onDelete} />
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
              <th className="px-4 py-3">Recensioni</th>
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
                  <AggregateRating restaurant={r} />
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
