/**
 * Set icone SVG inline unico per PNDR.
 * Tratto coerente 1.75, linecap/linejoin arrotondati. Nessuna emoji.
 * Le icone sono decorative per default (aria-hidden); passare `title`
 * per esporre un'etichetta accessibile quando l'icona è autoportante.
 */

const PATHS = {
  // Ruota della fortuna: indicatore a triangolo in alto, cerchio diviso in spicchi, mozzo.
  wheel: (
    <>
      <path d="M12 6.6l3-3.6h-6z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.6" r="7.4" />
      <path d="M12 6.2v14.8M5.5 9.85l13 7.5M18.5 9.85l-13 7.5" />
      <circle cx="12" cy="13.6" r="1.35" fill="currentColor" stroke="none" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a1.75 1.75 0 000-2.5l-1.5-1.5a1.75 1.75 0 00-2.5 0L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
    </>
  ),
  check: <path d="M5 12.5l4 4L19 7" />,
  alert: (
    <>
      <path d="M12 4l9 16H3l9-16z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 12h11" />
      <path d="M17 8l4 4-4 4" />
      <path d="M4 4v16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a17.6 17.6 0 01-3.4 4.3" />
      <path d="M6.7 6.7A17.7 17.7 0 002 12s3.5 7 10 7a10.5 10.5 0 004.7-1.1" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 01-18 0z" />
      <path d="M12 4c-1.5 1-1.5 2.5 0 3.5" />
      <path d="M5 20h14" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = '', title, strokeWidth = 1.75, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;

  const labelled = Boolean(title);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : 'true'}
      aria-label={labelled ? title : undefined}
      {...rest}
    >
      {labelled ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}
