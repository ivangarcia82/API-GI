// Notas fijas al pie de toda cotización. Viven aquí y no incrustadas en la
// plantilla para que exista un solo lugar donde cambiarlas cuando comercial
// revise condiciones — y para poder probarlas.
//
// El tiempo de entrega lo confirmó Gil el 2026-08-31. Ojo: NO es lo mismo que
// el tiempo de respuesta a una solicitud (COMPANY_FACTS.quoteResponse en
// ~/lib/site-content), que no es de entrega.
//
// Entrega, pago y vigencia se exportan sueltos porque el sitio también los
// cita (preguntas frecuentes, ficha de producto): así no pueden decir algo
// distinto de la cotización que recibe el cliente.

export const TIEMPO_ENTREGA = '15 a 20 días hábiles';
export const CONDICIONES_PAGO = 'Contado';
export const VIGENCIA_COTIZACION = '15 días';

export const NOTAS_IMPORTANTES = [
  'Precios expresados en moneda nacional. Sujeto a paridad de precio - dólar.',
  `Condiciones de pago: ${CONDICIONES_PAGO}`,
  `Vigencia de cotización: ${VIGENCIA_COTIZACION}.`,
  `Tiempo de entrega: ${TIEMPO_ENTREGA}`,
  'El precio unitario incluye entrega en la CDMX sin costo en un solo punto. No incluye ningún servicio de maquila, empaque o entrega especial, a menos que se especifique.',
];
