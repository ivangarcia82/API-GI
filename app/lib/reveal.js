/* Ayudas para animaciones de entrada, sin dependencias.
 *
 * Vive aparte de `~/lib/motion.js` a propósito: aquel arrastra GSAP y Lenis, y
 * lo usa sólo la parte de marketing. Esto lo importa también la tienda, que no
 * debe cargar ese peso.
 */

/** @returns {boolean} true si el sistema pide reducir movimiento. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* Una animación de entrada sólo tiene sentido si hay alguien mirándola llegar.
   Un contador que arranca en 0 se queda en 0 para todo lo que no hace scroll:
   capturas de página completa, impresión, exportar a PDF, rastreadores. La
   banda de estadísticas de la home se publicaba como "+0 / +0 / +0 / 0.0" por
   esto. Con esta bandera, quien no ha hecho scroll ve directamente la cifra
   final, y quien sí lo hace ve la cuenta. */
let scrolled = false;

if (typeof window !== 'undefined') {
  const marcar = () => {
    scrolled = true;
    window.removeEventListener('scroll', marcar);
  };
  // Puede que ya venga con scroll restaurado de una navegación previa.
  if (window.scrollY > 0) scrolled = true;
  else window.addEventListener('scroll', marcar, {passive: true, once: true});
}

/** @returns {boolean} true si el usuario ya movió la página en esta sesión. */
export function hasUserScrolled() {
  return scrolled;
}

/** Sólo para pruebas: devuelve la bandera a su estado inicial. */
export function resetScrollFlagForTests() {
  scrolled = false;
}
