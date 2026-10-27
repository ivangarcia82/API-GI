// Validación del formulario de la campaña de mochilas. El navegador ya valida,
// pero el action es la única puerta que cuenta.
import {destinoPorClave} from './destinos.js';
const MAX = 200;

function field(form, name) {
  return String(form.get(name) ?? '').trim().slice(0, MAX);
}

/* Iniciales que se graban en la mochila: de 1 a 3 letras. Se guardan en
   mayúsculas y sin espacios ni puntos, que es como se graban. */
const INICIALES = /^[A-ZÁÉÍÓÚÜÑ]{1,3}$/;

function normalizeInitials(raw) {
  return raw.replace(/[\s.]/g, '').toUpperCase();
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
  const initials = normalizeInitials(field(form, 'initials'));
  const variantId = field(form, 'variantId');
  const foraneoRaw = field(form, 'foraneo');

  if (!fullName) errors.fullName = 'Escribe tu nombre completo.';
  if (!position) errors.position = 'Escribe tu área o puesto.';
  if (phone.length !== 10) errors.phone = 'El teléfono debe tener 10 dígitos.';
  if (!initials) errors.initials = 'Escribe las iniciales que se grabarán.';
  else if (!INICIALES.test(initials)) errors.initials = 'Usa de 1 a 3 letras, sin números ni símbolos.';
  if (!variantId) errors.variantId = 'Elige una mochila.';
  if (foraneoRaw !== 'si' && foraneoRaw !== 'no') {
    errors.foraneo = 'Indica si eres foráneo.';
  }

  const foraneo = foraneoRaw === 'si';
  // Foráneo no captura dirección: elige una de las sedes de DESTINOS.
  let shipping = null;
  if (foraneo) {
    const destino = destinoPorClave(field(form, 'destino'));
    if (destino) shipping = {destino: destino.clave, estado: destino.estado, entrega: destino.entrega};
    else errors.destino = 'Elige a qué sede te la enviamos.';
  }

  if (Object.keys(errors).length > 0) return {ok: false, errors};
  return {ok: true, values: {fullName, position, phone, initials, variantId, foraneo, shipping}};
}
