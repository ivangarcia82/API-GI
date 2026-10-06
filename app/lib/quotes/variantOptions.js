// Color, talla y demás opciones de la variante cotizada. Se guardan con cada
// línea porque el título del producto no dice cuál se pidió: "Playera Liberty"
// en rosa talla M y en negro talla XL eran dos renglones idénticos en el PDF.

/**
 * Las opciones que vale la pena enseñar. Shopify llama "Title: Default Title" a
 * la única variante de un producto sin opciones: eso no es un color.
 * @param {Array<{name?: string, value?: string}>|null|undefined} selectedOptions
 * @returns {Array<{name: string, value: string}>}
 */
export function opcionesDeVariante(selectedOptions) {
  return (Array.isArray(selectedOptions) ? selectedOptions : [])
    .filter((o) => o && o.name && o.value)
    .filter((o) => o.name !== 'Title' && o.value !== 'Default Title')
    .map((o) => ({name: String(o.name), value: String(o.value)}));
}

/** "Color: ROSA · Talla: M", o '' si no hay opciones. */
export function textoOpciones(options) {
  return opcionesDeVariante(options)
    .map((o) => `${o.name}: ${o.value}`)
    .join(' · ');
}

/** De la columna variant_options (JSON) a la lista; tolera NULL y basura. */
export function leerOpciones(json) {
  if (!json) return [];
  try {
    return opcionesDeVariante(JSON.parse(json));
  } catch {
    return [];
  }
}

/** De la lista a la columna: NULL cuando no hay nada que guardar. */
export function guardarOpciones(options) {
  const limpias = opcionesDeVariante(options);
  return limpias.length ? JSON.stringify(limpias) : null;
}
