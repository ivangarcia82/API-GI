// Iconos de línea para los bloques de las páginas de servicio. Mismo trazo
// que el resto del sitio (24×24, stroke 1.75, extremos redondos); van en línea
// para no cargar una librería de iconos por una docena de dibujos.
const PATHS = {
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
    </>
  ),
  pen: (
    <>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="m14.5 5.5 3 3" />
    </>
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V10l5 3V10l5 3V6l4-2v17Z" />
      <path d="M3 21h18M17 21V4h3v17M7 17h1M11 17h1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  ship: (
    <>
      <path d="M3 17c1.5 1.3 3 2 4.5 2s3-.7 4.5-2c1.5 1.3 3 2 4.5 2s3-.7 4.5-2" />
      <path d="m4.5 15-1-4h17l-1 4M7 11V7h10v4M12 7V4" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2ZM13 9h4l4 4v3h-8Z" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  plane: <path d="M10.5 21 12 17l-3.5-1.5L4 18l-1-1 3.5-4L3 11l1-1 5 1 4-5c1.5-1.8 4-2.5 5-1.5s.3 3.5-1.5 5l-5 4 1 5-1 1-3-3.5" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z" />
    </>
  ),
  fileCheck: (
    <>
      <path d="M14 3H6v18h12V7Z" />
      <path d="M14 3v4h4M9 14l2 2 4-4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.6 3.5 5.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 15c4-2.5 6.5-6.5 6.5-11.5C13.5 3.5 9.5 6 7 10l-3 1 2 2-1 3 3-1 2 2Z" />
      <circle cx="14" cy="9" r="1.5" />
      <path d="M7 17c-1.5.5-2.5 2-3 4 2-.5 3.5-1.5 4-3" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4Z" />,
  store: (
    <>
      <path d="M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
};

/**
 * @param {{name: keyof typeof PATHS, size?: number}} props
 */
export function ServiceIcon({name, size = 28}) {
  const dibujo = PATHS[name];
  if (!dibujo) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {dibujo}
    </svg>
  );
}

export const SERVICE_ICON_NAMES = Object.keys(PATHS);
