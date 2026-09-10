import { motion } from 'framer-motion';
import RestaurantCard from './RestaurantCard.jsx';
import EmptyState from './EmptyState.jsx';
import { DUR, EASE } from '../lib/motion.js';

/**
 * Griglia responsive delle schede locale, già ordinate dalla pagina.
 * Ogni card entra con un fade + leggera salita quando scorre nella vista
 * (`whileInView`, una tantum). Le card già visibili al caricamento entrano
 * subito; nessun ritardo a cascata che cresce con la lista.
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
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: DUR.slow, ease: EASE.out }}
        >
          <RestaurantCard restaurant={restaurant} position={index + 1} onOpen={onOpen} />
        </motion.li>
      ))}
    </ul>
  );
}
