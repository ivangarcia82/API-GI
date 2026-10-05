// Folio legible de la cotización: GIP.Web.Cotización_001.
//
// El id interno de una cotización es un UUID y así se queda — lo referencian
// quote_items y las URLs. El folio es sólo para lo que ve el cliente (el PDF y
// los correos), porque un UUID en un documento comercial es ilegible.
//
// Se asigna al ENVIAR, no al crear el borrador, para que la serie quede sin
// huecos: un carrito abandonado no gasta número.
//
// Historia: hasta el 2026-10 la serie era GIV.CDMX.<año><4 dígitos>, con
// conteo anual. Las cotizaciones de entonces conservan su folio (vive en la
// fila de cada una) y su contador sigue en folio_counters sin tocarse.
//
// Sin imports de servidor a propósito: `folioVisible` lo usan componentes de
// cliente, y traerse aquí el cliente de libSQL lo metería en el bundle.

/** Serie de las cotizaciones del sitio. Un solo consecutivo, sin año. */
export const SERIE = 'GIP.Web.Cotización_';

/* folio_counters tiene llave (serie, year): la serie nueva no lleva año y usa
   0, que ninguna serie anual puede usar. */
const SIN_ANIO = 0;

/**
 * @param {number} n consecutivo
 * @returns {string}
 */
export function formatFolio(n) {
  // padStart no trunca: pasada la cotización 999 el folio crece a cuatro
  // dígitos, que es preferible a repetir un número.
  return `${SERIE}${String(n).padStart(3, '0')}`;
}

/**
 * Reserva el siguiente folio y lo devuelve ya formateado.
 *
 * El incremento va en un solo `UPDATE ... RETURNING`, que SQLite resuelve de
 * forma atómica. Un `SELECT MAX(...)+1` en dos pasos le daría el mismo número a
 * dos envíos simultáneos.
 *
 * @param {import('@libsql/client/web').Client} db
 * @returns {Promise<string>}
 */
export async function nextFolio(db) {
  await db.execute({
    sql: `INSERT INTO folio_counters (serie, year, last) VALUES (?, ?, 0)
          ON CONFLICT(serie, year) DO NOTHING`,
    args: [SERIE, SIN_ANIO],
  });
  const res = await db.execute({
    sql: `UPDATE folio_counters SET last = last + 1
          WHERE serie = ? AND year = ?
          RETURNING last`,
    args: [SERIE, SIN_ANIO],
  });
  return formatFolio(Number(res.rows[0].last));
}


/**
 * Lo que se le enseña al cliente. Las cotizaciones anteriores al folio no se
 * numeran hacia atrás —ya circularon con su uuid— así que caen a él.
 * @param {{id?: string, folio?: string|null}|null|undefined} quote
 * @returns {string}
 */
export function folioVisible(quote) {
  if (!quote) return '';
  const folio = String(quote.folio ?? '').trim();
  return folio || String(quote.id ?? '');
}
