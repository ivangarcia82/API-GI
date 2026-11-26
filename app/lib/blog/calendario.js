/* Cuenta de días hábiles para el artículo del calendario de temporadas.
 *
 * Las fechas límite del artículo se CALCULAN con esto, no se escriben a mano:
 * si cambia el plazo de entrega o se agrega una temporada, la tabla se
 * recalcula sola.
 *
 * Día hábil = lunes a viernes que no sea descanso obligatorio en México
 * (artículo 74 de la Ley Federal del Trabajo). No se descuentan días que
 * muchas empresas dan sin ser obligatorios, como jueves y viernes santos.
 */

const DIA = 24 * 60 * 60 * 1000;
const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);

/** El n-ésimo lunes de un mes (mes 1-12), en ISO. */
function lunesNumero(n, mes, anio) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const hastaLunes = (8 - primero.getUTCDay()) % 7;
  return aIso(new Date(primero.getTime() + (hastaLunes + (n - 1) * 7) * DIA));
}

/** Descansos obligatorios de un año, con su motivo. */
export const descansosDe = (anio) => [
  {fecha: `${anio}-01-01`, motivo: 'Año Nuevo'},
  {fecha: lunesNumero(1, 2, anio), motivo: 'Día de la Constitución'},
  {fecha: lunesNumero(3, 3, anio), motivo: 'Natalicio de Benito Juárez'},
  {fecha: `${anio}-05-01`, motivo: 'Día del Trabajo'},
  {fecha: `${anio}-09-16`, motivo: 'Día de la Independencia'},
  {fecha: lunesNumero(3, 11, anio), motivo: 'Día de la Revolución'},
  {fecha: `${anio}-12-25`, motivo: 'Navidad'},
];

/** Descansos obligatorios de 2026 a 2028: cubren cualquier cuenta de 2027. */
export const FERIADOS = [2026, 2027, 2028].flatMap((anio) => descansosDe(anio).map((d) => d.fecha));
const SON_FERIADO = new Set(FERIADOS);

/** @param {string} iso fecha AAAA-MM-DD */
export function esHabil(iso) {
  const dia = aFecha(iso).getUTCDay();
  return dia !== 0 && dia !== 6 && !SON_FERIADO.has(iso);
}

function mover(iso, dias, paso) {
  let fecha = aFecha(iso);
  let faltan = dias;
  while (faltan > 0) {
    fecha = new Date(fecha.getTime() + paso * DIA);
    if (esHabil(aIso(fecha))) faltan -= 1;
  }
  return aIso(fecha);
}

/** La fecha que cae `dias` días hábiles después de `iso`. */
export const sumarDiasHabiles = (iso, dias) => mover(iso, dias, 1);
/** La fecha que cae `dias` días hábiles antes de `iso`. */
export const restarDiasHabiles = (iso, dias) => mover(iso, dias, -1);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "lunes 8 de marzo de 2027" */
export function fechaLarga(iso) {
  const f = aFecha(iso);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

/* Anticipación con la que conviene pedir, en días hábiles. Sale de los dos
   plazos que confirmó el negocio, tomados en su máximo: la cotización se
   responde en 24 a 48 horas hábiles (hasta 2 días) y la entrega es de 15 a 20
   días hábiles (hasta 20). No incluye lo que el cliente tarde en aprobar su
   virtual. */
export const DIAS_DE_ANTICIPACION = {respuesta: 2, entrega: 20, total: 22};

/** Último día hábil para enviar la cotización y recibir a tiempo para `iso`. */
export const limiteDePedido = (iso) => restarDiasHabiles(iso, DIAS_DE_ANTICIPACION.total);

/** El tercer domingo de junio. */
function diaDelPadre(anio) {
  const primero = new Date(Date.UTC(anio, 5, 1));
  const hastaDomingo = (7 - primero.getUTCDay()) % 7;
  return aIso(new Date(primero.getTime() + (hastaDomingo + 14) * DIA));
}

/* Fechas comerciales de 2027 en México. Sólo las que tienen día fijo o una
   regla conocida; el Buen Fin y el regreso a clases se anuncian cada año y no
   se incluyen para no publicar una fecha inventada. */
export const TEMPORADAS_2027 = [
  {nombre: 'Día del Amor y la Amistad', fecha: '2027-02-14'},
  {nombre: 'Día Internacional de la Mujer', fecha: '2027-03-08'},
  {nombre: 'Día del Niño', fecha: '2027-04-30'},
  {nombre: 'Día de las Madres', fecha: '2027-05-10'},
  {nombre: 'Día del Maestro', fecha: '2027-05-15'},
  {nombre: 'Día del Padre', fecha: diaDelPadre(2027)},
  {nombre: 'Fiestas Patrias', fecha: '2027-09-16'},
  {nombre: 'Octubre Rosa (inicio)', fecha: '2027-10-01'},
  {nombre: 'Día de Muertos', fecha: '2027-11-02'},
  {nombre: 'Navidad', fecha: '2027-12-25'},
];
