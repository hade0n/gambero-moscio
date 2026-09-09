import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import { cn } from '../lib/cn.js';
import { tap } from '../lib/motion.js';

const DIM = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-12 w-12' };
const ICON_PX = { sm: 16, md: 20, lg: 22 };
const VARIANTS = {
  ghost: 'text-brown-soft hover:bg-brown/5 hover:text-brown',
  solid:
    'border border-brown/10 bg-cream-soft/92 text-brown shadow-sm backdrop-blur-sm hover:bg-cream-soft',
};

/**
 * Pulsante-icona circolare accessibile. `label` è obbligatoria (aria-label + title).
 * Target touch >= 44px anche per size="sm" grazie all'area del cerchio.
 */
export default function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={tap}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        DIM[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={ICON_PX[size]} />
    </motion.button>
  );
}
