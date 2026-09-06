import RestaurantCard from './RestaurantCard.jsx';
import EmptyState from './EmptyState.jsx';

/**
 * Griglia responsive delle schede locale, già ordinate dalla pagina.
 * Gestisce gli stati vuoti con i testi previsti dal brief.
 */
export default function RestaurantList({ restaurants, onOpen, isFiltered }) {
  if (restaurants.length === 0) {
    return (
      <EmptyState
        title={
          isFiltered
            ? 'Nessun locale trovato per questa categoria.'
            : 'Non sono ancora presenti locali recensiti.'
        }
        description={
          isFiltered
            ? 'Prova a scegliere un’altra categoria dal filtro qui sopra.'
            : 'Le recensioni compariranno qui non appena saranno pubblicate.'
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {restaurants.map((restaurant, index) => (
        <li
          key={restaurant.id}
          className="reveal-up h-full"
          style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
        >
          <RestaurantCard restaurant={restaurant} position={index + 1} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
