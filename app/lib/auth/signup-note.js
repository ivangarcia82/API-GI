// Puro y sin dependencias: el resumen del registro que se escribe en el campo
// `note` del customer de Shopify.
//
// Existe porque marketing valida la asignación de leads DENTRO del admin de
// Shopify (ver el spec del 2026-08-30). Ahí sólo llegan correo y nombre, así
// que sin esta nota abrirían un cliente etiquetado `lead-pendiente` sin saber
// de qué empresa viene ni a quién dijo conocer.
//
// Es texto plano a propósito: `note` no interpreta HTML y se lee en la barra
// lateral de la ficha del cliente.

/** Etiquetas en el orden en que marketing las necesita para decidir. */
function lineas({user, advisorName, advisorHandle}) {
  const asesor = advisorName || advisorHandle || null;
  const yaCliente =
    user.esCliente === 'si' ? 'Sí' : user.esCliente === 'no' ? 'No' : null;

  return [
    ['Empresa', user.company],
    ['Razón social', user.razonSocial],
    ['Tel', user.phone],
    ['Cargo', user.position],
    ['Área', user.area],
    ['Volumen', user.volume],
    ['Nos conoció por', user.heardAbout],
    ['Ubicación', user.location],
    ['¿Ya es cliente?', yaCliente],
    ['Asesor que indicó', asesor],
    ['Busca', user.needs],
  ];
}

/**
 * Resumen del alta para el campo `note` del customer.
 *
 * Las etiquetas sin valor se omiten en vez de quedar vacías: la nota se lee de
 * un vistazo en la ficha y una lista de "—" la vuelve ruido.
 *
 * @param {{
 *   user: Record<string, any>,
 *   advisorName?: string|null,
 *   advisorHandle?: string|null,
 * }} args
 * @returns {string}
 */
export function buildSignupNote({user, advisorName = null, advisorHandle = null}) {
  const cuerpo = lineas({user, advisorName, advisorHandle})
    .filter(([, valor]) => String(valor ?? '').trim() !== '')
    .map(([etiqueta, valor]) => `${etiqueta}: ${String(valor).trim()}`);

  // La fecha siempre va: es lo que permite ordenar los pendientes viejos.
  const alta = String(user.createdAt ?? new Date().toISOString()).slice(0, 10);

  return ['Registro en el sitio', ...cuerpo, `Alta: ${alta}`].join('\n');
}
