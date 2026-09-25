// Muestras de color para las tarjetas de la campaña. Shopify sólo trae el
// nombre de la variante ("Azul / Negro"); aquí se traduce a tonos reales.
const TONES = {
  negro: '#2a2b2e',
  azul: '#2d4c7c',
  gris: '#8a8d93',
  rojo: '#b3261e',
  blanco: '#f4f4f5',
  cafe: '#6b4a32',
  verde: '#3f6b4a',
};
const UNKNOWN = '#c9cbcf';

function key(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * @param {string} colorName  p. ej. "Negro" o "Azul / Negro"
 * @returns {{tones: string[], known: boolean}}
 */
export function swatchFor(colorName) {
  const parts = String(colorName ?? '').split('/').map(key).filter(Boolean);
  const tones = parts.map((p) => TONES[p]);
  if (tones.length === 0 || tones.some((t) => !t)) return {tones: [UNKNOWN], known: false};
  return {tones, known: true};
}
