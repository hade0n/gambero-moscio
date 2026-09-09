import { cn } from '../lib/cn.js';

/**
 * Intestazione di sezione editoriale: titolo display + descrizione, con
 * un'azione opzionale allineata a destra da `sm`. Usata in homepage e backend
 * per la stessa gerarchia.
 */
export default function SectionHeader({ title, description, action, className = '', as: Tag = 'h1' }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        action && 'sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div>
        <Tag className="font-display text-[1.65rem] font-bold leading-tight sm:text-[2.1rem]">
          {title}
        </Tag>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-brown-soft sm:text-[0.95rem]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
