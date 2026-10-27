// Destinos de envío para colaboradores foráneos. No se captura dirección: la
// mochila va a una de estas sedes. La `clave` es lo que viaja en el formulario.
export const DESTINOS = [
  {clave: 'michoacan', estado: 'Michoacán', entrega: 'Gil y Noé'},
  {clave: 'sonora', estado: 'Sonora', entrega: 'Sucursal'},
  {clave: 'yucatan', estado: 'Yucatán', entrega: 'Sucursal'},
];

export const destinoPorClave = (clave) => DESTINOS.find((d) => d.clave === clave) ?? null;

/** "Michoacán · Gil y Noé" */
export const textoDestino = (d) => `${d.estado} · ${d.entrega}`;
