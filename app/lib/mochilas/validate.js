// Validación del formulario de la campaña de mochilas. El navegador ya valida,
// pero el action es la única puerta que cuenta.
const MAX = 200;

function field(form, name) {
  return String(form.get(name) ?? '').trim().slice(0, MAX);
}

/** Deja sólo dígitos y quita la lada de país 52 si viene. */
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return digits;
}

/**
 * @param {FormData} form
 */
export function validateMochilaRequest(form) {
  const errors = {};

  const fullName = field(form, 'fullName');
  const position = field(form, 'position');
  const phone = normalizePhone(field(form, 'phone'));
  const variantId = field(form, 'variantId');
  const foraneoRaw = field(form, 'foraneo');

  if (!fullName) errors.fullName = 'Escribe tu nombre completo.';
  if (!position) errors.position = 'Escribe tu área o puesto.';
  if (phone.length !== 10) errors.phone = 'El teléfono debe tener 10 dígitos.';
  if (!variantId) errors.variantId = 'Elige una mochila.';
  if (foraneoRaw !== 'si' && foraneoRaw !== 'no') {
    errors.foraneo = 'Indica si eres foráneo.';
  }

  const foraneo = foraneoRaw === 'si';
  let shipping = null;
  if (foraneo) {
    shipping = {
      street: field(form, 'street'),
      neighborhood: field(form, 'neighborhood'),
      zip: field(form, 'zip'),
      city: field(form, 'city'),
      state: field(form, 'state'),
      references: field(form, 'references'),
      recipient: field(form, 'recipient'),
    };
    if (!shipping.street) errors.street = 'Escribe calle y número.';
    if (!shipping.neighborhood) errors.neighborhood = 'Escribe la colonia.';
    if (!/^\d{5}$/.test(shipping.zip)) errors.zip = 'El código postal debe tener 5 dígitos.';
    if (!shipping.city) errors.city = 'Escribe la ciudad.';
    if (!shipping.state) errors.state = 'Escribe el estado.';
  }

  if (Object.keys(errors).length > 0) return {ok: false, errors};
  return {ok: true, values: {fullName, position, phone, variantId, foraneo, shipping}};
}
