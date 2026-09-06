import Icon from './Icon.jsx';

const TONES = {
  success: { bg: 'bg-green-deep', icon: 'check' },
  error: { bg: 'bg-danger', icon: 'alert' },
};

/** Singolo toast: icona + testo, palette PNDR, chiusura manuale disponibile. */
export default function Toast({ toast, onDismiss }) {
  const tone = TONES[toast.tone] || TONES.success;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white shadow-xl ${tone.bg} ${
        toast.leaving
          ? 'animate-[pndr-toast-out_170ms_ease-in_forwards]'
          : 'animate-[pndr-toast-in_220ms_cubic-bezier(0.2,0.7,0.2,1)]'
      }`}
    >
      <Icon name={tone.icon} size={18} />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Chiudi la notifica"
        className="press -m-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
