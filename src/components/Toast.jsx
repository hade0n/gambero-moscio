import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import IconButton from './IconButton.jsx';
import { cn } from '../lib/cn.js';
import { EASE } from '../lib/motion.js';

const TONES = {
  success: { bg: 'bg-green-deep', icon: 'check' },
  error: { bg: 'bg-danger', icon: 'alert' },
};

/**
 * Singolo toast: icona + testo, palette PNDR, chiusura manuale.
 * Uscita in due fasi guidata dal flag `toast.leaving` (impostato dal context).
 */
export default function Toast({ toast, onDismiss }) {
  const tone = TONES[toast.tone] || TONES.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={
        toast.leaving
          ? { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16, ease: EASE.in } }
          : { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EASE.out } }
      }
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow-xl',
        tone.bg,
      )}
    >
      <Icon name={tone.icon} size={18} className="shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <IconButton
        icon="close"
        label="Chiudi la notifica"
        size="sm"
        iconSize={15}
        onClick={() => onDismiss(toast.id)}
        className="-m-1.5 text-white/80 hover:bg-white/15 hover:text-white"
      />
    </motion.div>
  );
}
