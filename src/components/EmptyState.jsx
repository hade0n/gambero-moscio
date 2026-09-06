import Icon from './Icon.jsx';

/** Stato vuoto: icona discreta + messaggio caldo + eventuale azione. */
export default function EmptyState({ icon = 'bowl', title, description, action }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-dashed bg-cream-soft px-6 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-apricot/15 text-terracotta">
        <Icon name={icon} size={28} />
      </span>
      <p className="text-lg font-semibold text-brown">{title}</p>
      {description && <p className="mt-1 text-sm text-brown-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
