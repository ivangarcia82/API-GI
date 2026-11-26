/* El artículo del calendario promete una fecha límite por temporada. Esa
   fecha se calcula, no se escribe a mano: aquí se fija la cuenta de días
   hábiles (fines de semana y descansos obligatorios de México fuera). */
import {describe, it, expect} from 'vitest';
import {
  DIAS_DE_ANTICIPACION,
  FERIADOS,
  TEMPORADAS_2027,
  esHabil,
  fechaLarga,
  limiteDePedido,
  restarDiasHabiles,
  sumarDiasHabiles,
} from './calendario.js';
import {COMPANY_FACTS} from '../site-content.js';
import {TIEMPO_ENTREGA} from '../quotes/notasImportantes.js';

const diaDeSemana = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

describe('días hábiles', () => {
  it('sábados y domingos no cuentan', () => {
    expect(esHabil('2027-01-02')).toBe(false); // sábado
    expect(esHabil('2027-01-03')).toBe(false); // domingo
    expect(esHabil('2027-01-04')).toBe(true); // lunes
  });

  it('los descansos obligatorios de 2027 no cuentan', () => {
    expect(FERIADOS).toEqual(
      expect.arrayContaining([
        '2027-01-01', // Año Nuevo
        '2027-02-01', // primer lunes de febrero
        '2027-03-15', // tercer lunes de marzo
        '2027-05-01', // Día del Trabajo
        '2027-09-16', // Independencia
        '2027-11-15', // tercer lunes de noviembre
        '2027-12-25', // Navidad
      ]),
    );
    // Los que caen en lunes por ley, caen en lunes.
    for (const f of ['2027-02-01', '2027-03-15', '2027-11-15']) expect(diaDeSemana(f)).toBe(1);
    for (const f of FERIADOS) expect(esHabil(f), f).toBe(false);
  });

  it('suma y resta saltándose fines de semana y feriados', () => {
    expect(sumarDiasHabiles('2027-01-04', 1)).toBe('2027-01-05');
    expect(sumarDiasHabiles('2027-01-08', 1)).toBe('2027-01-11'); // viernes → lunes
    expect(sumarDiasHabiles('2027-01-29', 1)).toBe('2027-02-02'); // salta fin de semana y lunes feriado
    expect(restarDiasHabiles('2027-02-02', 1)).toBe('2027-01-29');
    expect(restarDiasHabiles(sumarDiasHabiles('2027-06-07', 22), 22)).toBe('2027-06-07');
  });

  it('escribe la fecha como se lee en México', () => {
    expect(fechaLarga('2027-03-08')).toBe('lunes 8 de marzo de 2027');
    expect(fechaLarga('2027-12-25')).toBe('sábado 25 de diciembre de 2027');
  });
});

describe('anticipación de un pedido', () => {
  it('son los días de respuesta más el plazo máximo de entrega', () => {
    // "24 a 48 horas hábiles" = hasta 2 días hábiles; "15 a 20 días hábiles" = hasta 20.
    expect(COMPANY_FACTS.quoteResponse).toMatch(/48 horas/);
    expect(TIEMPO_ENTREGA).toMatch(/a 20 días hábiles/);
    expect(DIAS_DE_ANTICIPACION).toEqual({respuesta: 2, entrega: 20, total: 22});
  });

  it('cada temporada de 2027 tiene su fecha límite, hábil y 22 días hábiles antes', () => {
    expect(TEMPORADAS_2027.length).toBeGreaterThanOrEqual(8);
    for (const t of TEMPORADAS_2027) {
      const limite = limiteDePedido(t.fecha);
      expect(esHabil(limite), t.nombre).toBe(true);
      expect(limite < t.fecha, t.nombre).toBe(true);
      expect(limite).toBe(restarDiasHabiles(t.fecha, 22));
    }
  });

  it('las fechas de 2027 caen en el día de la semana correcto', () => {
    const de = (nombre) => TEMPORADAS_2027.find((t) => t.nombre.includes(nombre)).fecha;
    expect(de('Padre')).toBe('2027-06-20'); // tercer domingo de junio
    expect(diaDeSemana(de('Padre'))).toBe(0);
    expect(de('Madres')).toBe('2027-05-10');
    expect(de('Navidad')).toBe('2027-12-25');
  });
});
