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

export const COMO_NOS_CONOCISTE = [
  'Google o buscador',
  'Redes sociales',
  'Recomendación',
  'Feria o evento',
  'Me contactó un ejecutivo',
  'Otro',
];

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
