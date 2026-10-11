import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/** Selettore provincia con menu coerente con il sito e navigazione da tastiera. */
export default function ProvinceFilter({ provinces, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const listId = useId();
  const options = ['', ...provinces];
  const label = (code) => code || 'Tutte le province';

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const choose = (index) => {
    onChange(options[index]);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      if (event.key === 'Escape') event.preventDefault();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setActiveIndex(Math.max(0, options.indexOf(value)));
        setOpen(true);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') choose(activeIndex);
      else if (event.key === 'Home') setActiveIndex(0);
      else if (event.key === 'End') setActiveIndex(options.length - 1);
      else setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    }
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={`Provincia: ${label(value)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        className="ranking-province"
        onKeyDown={handleKeyDown}
        onClick={() => { setActiveIndex(Math.max(0, options.indexOf(value))); setOpen(!open); }}
      >
        <Icon name="pin" size={20} />
        <span className="text-sm">{label(value)}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label="Province" className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border bg-cream-soft p-1.5 shadow-md">
          {options.map((code, index) => (
            <li key={code || 'all'} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={code === value}
                tabIndex={-1}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors duration-150 ${code === value ? 'bg-green-deep font-semibold text-white' : activeIndex === index ? 'bg-green/10 text-green-deep' : 'text-brown hover:bg-green/10'}`}
              >
                {label(code)}
                {code === value && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
