// Reglas de contraseña que se resuelven comparando cadenas en memoria.
// Puro y sin dependencias para poder probarlo sin DOM ni base de datos.
// La corrección de la contraseña actual NO se decide aquí: eso lo resuelve
// verifyPassword contra el hash almacenado.

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordChange({current, next, confirm} = {}) {
  const actual = String(current ?? '');
  const nueva = String(next ?? '');
  const confirmacion = String(confirm ?? '');

  if (nueva.length < MIN_PASSWORD_LENGTH) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (nueva !== confirmacion) {
    return 'Las contraseñas no coinciden.';
  }
  if (nueva === actual) {
    return 'La nueva contraseña debe ser distinta a la actual.';
  }
  return null;
}
