/* El sitio decía cosas distintas sobre lo mismo según la página: 1,800
   productos en el inicio, 2,700 "clientes" en una banda, 500 marcas en el
   blog, respuesta en menos de 24 horas en el cotizador y flete sólo a CDMX en
   la ficha. Un buscador o un asistente de IA que encuentra dos cifras
   distintas no cita ninguna.

   El negocio confirmó los datos el 26-nov-2026. Estas pruebas recorren el
   código y fijan que las versiones viejas no vuelvan a aparecer. */
import {describe, it, expect} from 'vitest';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(js|jsx)$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : [];
  });
}

const FUENTES = archivos('app').map((ruta) => ({ruta, texto: readFileSync(ruta, 'utf8')}));
const dondeAparece = (patron) => FUENTES.filter((f) => patron.test(f.texto)).map((f) => f.ruta);

describe('cifras y promesas viejas', () => {
  it.each([
    ['1,800 productos', /1,800/],
    ['2,700 clientes', /2,700|value: 2700/],
    ['500 marcas', /500 marcas/],
    ['flete sólo a CDMX y Zona Metropolitana', /CDMX y Zona Metropolitana/],
    ['direcciones de las sucursales de Sonora y Yucatán', /Navarrete|Calle 60 Norte/],
  ])('ya no aparece: %s', (_nombre, patron) => {
    expect(dondeAparece(patron)).toEqual([]);
  });
});

/* La respuesta a una cotización es de 24 a 48 horas (48 en productos de
   fabricación). Se revisa en los archivos que prometen esa respuesta, no en
   todo el sitio: el registro habla de otra cosa, la aprobación de la cuenta. */
describe('respuesta a una cotización', () => {
  it.each([
    'app/components/gi/QuoteDrawer.jsx',
    'app/routes/products.$handle.jsx',
    'app/routes/servicios.$id.jsx',
    'app/lib/faq.js',
  ])('%s ya no promete menos de 24 horas', (ruta) => {
    const texto = FUENTES.find((f) => f.ruta === ruta).texto;
    expect(texto).not.toMatch(/menos de 24 ?h|< ?24 ?h|menos\s+de <strong>24 horas/i);
  });
});

describe('una sola fuente para cada dato', () => {
  const leer = (ruta) => FUENTES.find((f) => f.ruta === ruta).texto;

  it('la ficha toma el tiempo de entrega de las notas de la cotización', () => {
    expect(leer('app/routes/products.$handle.jsx')).toMatch(/\{TIEMPO_ENTREGA\}/);
  });

  it('el inicio, la banda y los artículos del blog toman sus cifras de COMPANY_FACTS', () => {
    for (const ruta of [
      'app/routes/_index.jsx',
      'app/components/gi/HomeSections.jsx',
      'app/components/marketing/ImpactBand.jsx',
      'app/lib/blog/posts/tiempo-de-entrega-promocionales.js',
    ]) {
      expect(leer(ruta), ruta).toMatch(/COMPANY_FACTS/);
    }
  });
});
