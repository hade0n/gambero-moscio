import { motion } from 'framer-motion';
import RestaurantCard from './RestaurantCard.jsx';
import EmptyState from './EmptyState.jsx';
import { DUR, EASE } from '../lib/motion.js';

/**
 * Griglia responsive delle schede locale, già ordinate dalla pagina.
 * Al caricamento le card entrano in cascata (fade + salita), con ritardo
 * incrementale limitato a 8: una lista di 30 non fa 30 animazioni ritardate,
 * ma nessuna card "compare di colpo".
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
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.base, ease: EASE.out, delay: Math.min(index, 8) * 0.06 }}
        >
          <RestaurantCard restaurant={restaurant} position={index + 1} onOpen={onOpen} />
        </motion.li>
      ))}
    </ul>
  );
}
