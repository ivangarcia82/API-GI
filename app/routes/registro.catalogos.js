// Catálogos del registro. Viven aparte porque los consumen dos lados: el
// formulario (para pintar los <option>) y la validación, que corre también en
// el servidor — así el servidor rechaza un valor fuera de catálogo sin tener
// que duplicar la lista.

export const AREAS = [
  'Compras',
  'Marketing',
  'Recursos Humanos',
  'Dirección',
  'Ventas',
  'Operaciones',
  'Otra',
];

// ¿Cómo nos conociste? es de dos niveles: dos opciones despliegan un segundo
// select y las demás no. Se guarda en una sola columna como "Padre › Hijo" para
// no añadir otra al esquema; `esOrigenValido` valida la pareja completa.
export const COMO_NOS_CONOCISTE = [
  'Buscador',
  'Redes sociales',
  'Recomendación',
  'Feria o evento',
  'Me contactó un ejecutivo',
  'Otro',
];

/** Segundo nivel. Una opción sin entrada aquí no despliega nada. */
export const COMO_NOS_CONOCISTE_DETALLE = {
  Buscador: ['Google', 'Yahoo', 'App de IA', 'Otro'],
  'Redes sociales': ['LinkedIn', 'Instagram', 'Facebook'],
};

/** Separador entre nivel y detalle en el valor que se persiste. */
export const ORIGEN_SEP = ' › ';

/**
 * Une nivel y detalle en el valor único que se guarda.
 * @param {string} origen
 * @param {string} [detalle]
 * @returns {string}
 */
export function componerOrigen(origen, detalle) {
  const base = String(origen ?? '').trim();
  const hijo = String(detalle ?? '').trim();
  if (!base) return '';
  return hijo ? `${base}${ORIGEN_SEP}${hijo}` : base;
}

/**
 * Valida el valor compuesto: el nivel debe existir, y si ese nivel tiene
 * detalle, el detalle es obligatorio y debe estar en su lista.
 * @param {string|null|undefined} valor
 * @returns {boolean}
 */
export function esOrigenValido(valor) {
  const [origen, detalle] = String(valor ?? '').split(ORIGEN_SEP);
  if (!COMO_NOS_CONOCISTE.includes(String(origen ?? '').trim())) return false;
  const hijos = COMO_NOS_CONOCISTE_DETALLE[origen.trim()];
  if (!hijos) return detalle === undefined;
  return hijos.includes(String(detalle ?? '').trim());
}

export const UBICACIONES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
  'Fuera de México',
];

/**
 * @param {string|null|undefined} valor
 * @param {string[]} catalogo
 * @returns {boolean}
 */
export function esOpcionValida(valor, catalogo) {
  return catalogo.includes(String(valor ?? '').trim());
}
