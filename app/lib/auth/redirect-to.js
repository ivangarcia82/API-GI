/* Destino post-login. `redirectTo` viaja por la URL, o sea que lo escribe
   quien sea: sin filtro, un correo con /login?redirectTo=https://sitio-falso/
   usa nuestro login de trampolín para un phishing. Sólo rutas internas. */

const DESTINO_POR_DEFECTO = '/account';

/**
 * @param {unknown} value - lo que venga en ?redirectTo o en el campo oculto
 * @param {string} [fallback]
 * @returns {string} una ruta interna segura
 */
export function safeRedirectTo(value, fallback = DESTINO_POR_DEFECTO) {
  const destino = typeof value === 'string' ? value.trim() : '';
  // Una sola diagonal y nada mas: "//host" y "/\host" los resuelve el navegador
  // como dominio externo, y "esquema:" se sale del sitio por completo.
  if (!destino.startsWith('/')) return fallback;
  if (destino.startsWith('//') || destino.startsWith('/\\')) return fallback;
  return destino;
}
