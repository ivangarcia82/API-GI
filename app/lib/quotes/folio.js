// Folio legible de la cotización: GIV.CDMX.20260001.
//
// El id interno de una cotización es un UUID y así se queda — lo referencian
// quote_items y las URLs. El folio es sólo para lo que ve el cliente (el PDF y
// los correos), porque un UUID en un documento comercial es ilegible.
//
// Se asigna al ENVIAR, no al crear el borrador, para que la serie quede sin
// huecos: un carrito abandonado no gasta número.
import {getDb} from '../db/client.js';

/** Serie fija. El año va aparte porque el conteo reinicia cada 1 de enero. */
export const SERIE = 'GIV.CDMX.';

/**
 * @param {{year: number, n: number}} args
 * @returns {string}
 */
export function formatFolio({year, n}) {
  // padStart no trunca: si algún año pasa de 9999 cotizaciones el folio crece a
  // cinco dígitos, que es preferible a repetir un número.
  return `${SERIE}${year}${String(n).padStart(4, '0')}`;
}

/**
 * Reserva el siguiente folio del año y lo devuelve ya formateado.
 *
 * El incremento va en un solo `UPDATE ... RETURNING`, que SQLite resuelve de
 * forma atómica. Un `SELECT MAX(...)+1` en dos pasos le daría el mismo número a
 * dos envíos simultáneos.
 *
 * @param {import('@libsql/client/web').Client} db
 * @param {{year?: number}} [opciones]
 * @returns {Promise<string>}
 */
export async function nextFolio(db, {year = new Date().getFullYear()} = {}) {
  await db.execute({
    sql: `INSERT INTO folio_counters (serie, year, last) VALUES (?, ?, 0)
          ON CONFLICT(serie, year) DO NOTHING`,
    args: [SERIE, year],
  });
  const res = await db.execute({
    sql: `UPDATE folio_counters SET last = last + 1
          WHERE serie = ? AND year = ?
          RETURNING last`,
    args: [SERIE, year],
  });
  const n = Number(res.rows[0].last);
  return formatFolio({year, n});
}

/**
 * Igual que nextFolio pero resolviendo la conexión desde el env, para llamarlo
 * donde sólo se tiene el contexto de la petición.
 * @param {Record<string, any>} env
 */
export async function nextFolioForEnv(env) {
  return nextFolio(getDb(env));
}
