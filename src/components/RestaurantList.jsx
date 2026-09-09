import { motion } from 'framer-motion';
import RestaurantCard from './RestaurantCard.jsx';
import EmptyState from './EmptyState.jsx';
import { listItem, inViewOnce } from '../lib/motion.js';

/**
 * Griglia responsive delle schede locale, già ordinate dalla pagina.
 * Reveal per elemento su `whileInView`: la coda non cresce col numero di card
 * (una lista di 30 non fa 30 animazioni ritardate).
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
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {restaurants.map((restaurant, index) => (
        <motion.li
          key={restaurant.id}
          className="h-full"
          variants={listItem}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
        >
          <RestaurantCard restaurant={restaurant} position={index + 1} onOpen={onOpen} />
        </motion.li>
      ))}
    </ul>
  );
}
