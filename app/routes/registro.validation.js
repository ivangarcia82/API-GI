// Validación por paso del wizard de registro. Pura y sin dependencias para
// poder probarla sin DOM; el chequeo de disponibilidad del correo es aparte
// porque requiere servidor.
import {
  AREAS,
  UBICACIONES,
  componerOrigen,
  esOpcionValida,
  esOrigenValido,
} from './registro.catalogos.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step, form) {
  const errores = {};

  if (step === 1) {
    if (!String(form.name ?? '').trim()) errores.name = 'Ingresa tu nombre.';
    if (!String(form.lastName ?? '').trim()) errores.lastName = 'Ingresa tu apellido.';
    if (!EMAIL_RE.test(String(form.email ?? ''))) errores.email = 'Ingresa un correo válido.';
    if (String(form.password ?? '').length < 8) {
      errores.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (!String(form.phone ?? '').trim()) errores.phone = 'Ingresa tu teléfono.';
  }

  if (step === 2) {
    if (!String(form.company ?? '').trim()) errores.company = 'Ingresa el nombre de la empresa.';
    if (!String(form.razonSocial ?? '').trim()) {
      errores.razonSocial = 'Ingresa la razón social.';
    }
    if (!String(form.position ?? '').trim()) errores.position = 'Ingresa tu cargo.';
    if (!esOpcionValida(form.area, AREAS)) errores.area = 'Selecciona tu área.';
    if (!String(form.volume ?? '')) errores.volume = 'Selecciona un volumen estimado.';
    if (!String(form.esCliente ?? '')) {
      errores.esCliente = 'Indícanos si ya eres cliente.';
    } else if (form.esCliente === 'si' && !String(form.advisor ?? '')) {
      // "No conozco a mi asesor asignado" es un valor propio del select, así que
      // cuenta como respuesta; lo único que se rechaza es dejarlo en blanco.
      errores.advisor =
        'Elige a tu ejecutivo de venta o selecciona "No conozco a mi asesor asignado".';
    }
  }

  if (step === 3) {
    if (!esOrigenValido(componerOrigen(form.heardAbout, form.heardAboutDetail))) {
      errores.heardAbout = 'Cuéntanos cómo nos conociste.';
    }
    if (!esOpcionValida(form.location, UBICACIONES)) {
      errores.location = 'Selecciona dónde te encuentras.';
    }
    // Una sola casilla cubre ambos documentos. El newsletter es aparte y
    // opcional a propósito: nunca bloquea el alta.
    if (!form.legal) {
      errores.legal = 'Debes aceptar el aviso de privacidad y los términos y condiciones.';
    }
  }

  return errores;
}
