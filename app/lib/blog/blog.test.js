/* Los seis artículos del blog compartían el mismo texto y tres afirmaban
   cifras que nadie podía respaldar. Los nuevos están escritos para poder
   citarse: título en forma de pregunta, respuesta directa arriba, cada
   apartado es una pregunta con su respuesta inmediata, y los datos salen del
   catálogo real, de las notas de la cotización o de lo que confirmó el
   negocio. Estas pruebas fijan esa forma y atan cada dato a su origen. */
import {describe, it, expect} from 'vitest';
import {BLOG_AUTHOR, BLOG_CATEGORIES, BLOG_POSTS, BLOG_REDIRECTS, textoDe} from './index.js';
import {CATALOGO} from './datos.js';
import {TEMPORADAS_2027, fechaLarga, limiteDePedido} from './calendario.js';
import {COMPANY_FACTS} from '../site-content.js';
import {TIEMPO_ENTREGA} from '../quotes/notasImportantes.js';
import {PRICE_MATRIX} from '../decoration/engine.js';

const palabras = (s) => String(s).trim().split(/\s+/).length;
const plano = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const post = (id) => BLOG_POSTS.find((p) => p.id === id);
const miles = (n) => n.toLocaleString('en-US');

describe('el blog', () => {
  it('tiene los seis artículos, sin ids repetidos', () => {
    expect(BLOG_POSTS.map((p) => p.id)).toEqual([
      'impresion-tecnicas',
      'tiempo-de-entrega-promocionales',
      'calendario-promocionales-2027',
      'certificaciones-proveedor-promocionales',
      'kit-de-bienvenida-empleados',
      'promocionales-ecologicos',
    ]);
  });

  it('las categorías del filtro son las que de verdad tienen artículos', () => {
    expect(BLOG_CATEGORIES[0]).toBe('Todos');
    expect(new Set(BLOG_CATEGORIES.slice(1))).toEqual(new Set(BLOG_POSTS.map((p) => p.cat)));
  });

  it('los artículos viejos redirigen: ninguno sigue publicado', () => {
    expect(Object.keys(BLOG_REDIRECTS).sort()).toEqual([
      'fulfillment-escala',
      'mundial-2026',
      'roi-promocionales',
      'tendencias-2026',
      'textiles-sustentables',
    ]);
    const vivos = new Set(BLOG_POSTS.map((p) => `/blog/${p.id}`));
    for (const [viejo, destino] of Object.entries(BLOG_REDIRECTS)) {
      expect(post(viejo), viejo).toBeUndefined();
      expect(destino === '/blog' || vivos.has(destino), destino).toBe(true);
    }
    expect(BLOG_REDIRECTS['textiles-sustentables']).toBe('/blog/promocionales-ecologicos');
  });

  it('firma una persona', () => {
    expect(BLOG_AUTHOR.name).toBe('Guadalupe Cordoba');
    for (const p of BLOG_POSTS) expect(p.author).toBe(BLOG_AUTHOR);
  });
});

describe.each(BLOG_POSTS.map((p) => [p.id, p]))('artículo %s', (_id, p) => {
  it('el título es una pregunta y la descripción cabe en un resultado', () => {
    expect(p.title).toMatch(/¿.+\?/);
    expect(p.excerpt.length).toBeLessThanOrEqual(160);
    expect(p.excerpt.length).toBeGreaterThanOrEqual(90);
  });

  it('abre con una respuesta directa de 40 a 60 palabras', () => {
    expect(palabras(p.answer)).toBeGreaterThanOrEqual(40);
    expect(palabras(p.answer)).toBeLessThanOrEqual(60);
  });

  it('trae un resumen de 3 a 5 puntos', () => {
    expect(p.takeaways.length).toBeGreaterThanOrEqual(3);
    expect(p.takeaways.length).toBeLessThanOrEqual(5);
  });

  it('cada apartado es una pregunta con su respuesta inmediata de 40 a 60 palabras', () => {
    expect(p.sections.length).toBeGreaterThanOrEqual(4);
    for (const s of p.sections) {
      expect(s.h, s.h).toMatch(/^¿.+\?$/);
      const primero = s.blocks[0];
      expect(typeof primero.p, s.h).toBe('string');
      expect(palabras(primero.p), s.h).toBeGreaterThanOrEqual(40);
      expect(palabras(primero.p), s.h).toBeLessThanOrEqual(60);
      expect(primero.p, s.h).not.toMatch(/^(Esto|Eso|Lo anterior|Como se mencion|Como ya|Como vimos)/i);
    }
  });

  it('las tablas están completas y los bloques son de un tipo conocido', () => {
    for (const s of p.sections) {
      for (const b of s.blocks) {
        const tipos = Object.keys(b);
        expect(tipos, s.h).toHaveLength(1);
        expect(['p', 'ul', 'ol', 'table']).toContain(tipos[0]);
        if (b.table) {
          expect(b.table.rows.length).toBeGreaterThan(1);
          for (const fila of b.table.rows) expect(fila, s.h).toHaveLength(b.table.cols.length);
        }
      }
    }
  });

  it('no publica importes, formas de pago sin confirmar ni las cifras viejas', () => {
    const t = textoDe(p);
    expect(t).not.toMatch(/\$\s?\d/);
    expect(t).not.toMatch(/transferencia|tarjeta de cr[eé]dito/i);
    expect(t).not.toMatch(/15,000 kits|8 clientes|500 marcas|1,800/);
  });

  it('tiene fecha, lectura, imagen con texto alternativo y a dónde seguir', () => {
    expect(p.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.date).toMatch(/\d{4}$/);
    expect(p.read).toMatch(/^\d+ min$/);
    expect(p.img).toMatch(/^(\/|https:\/\/)/);
    expect(p.imgAlt.length).toBeGreaterThan(15);
    expect(p.next.length).toBeGreaterThanOrEqual(2);
    for (const n of p.next) expect(n.to).toMatch(/^\//);
  });

  it('el tiempo de lectura corresponde al largo del texto', () => {
    const minutos = Math.max(1, Math.round(palabras(textoDe(p)) / 200));
    expect(Number.parseInt(p.read, 10)).toBe(minutos);
  });
});

describe('los datos de cada artículo salen de su fuente', () => {
  it('técnicas: los conteos son los del catálogo y nombra las técnicas del cotizador', () => {
    const t = textoDe(post('impresion-tecnicas'));
    expect(t).toContain(miles(CATALOGO.activos));
    for (const tec of CATALOGO.tecnicas) expect(t, tec.nombre).toContain(miles(tec.productos));
    expect(t).toContain(CATALOGO.fechaTexto);
    const sinonimos = {'full color': 'a todo color'};
    for (const clave of Object.keys(PRICE_MATRIX)) {
      let buscada = plano(clave);
      for (const [a, b] of Object.entries(sinonimos)) buscada = buscada.replace(a, b);
      expect(plano(t), clave).toContain(buscada);
    }
  });

  it('tiempos: entrega y respuesta son los confirmados', () => {
    const t = textoDe(post('tiempo-de-entrega-promocionales'));
    expect(t).toContain(TIEMPO_ENTREGA);
    expect(t).toContain(COMPANY_FACTS.quoteResponse);
    expect(t).toMatch(/virtual/);
    expect(t).toMatch(/no maneja cantidad mínima/);
  });

  it('calendario: cada fecha límite está calculada, no escrita a mano', () => {
    const p = post('calendario-promocionales-2027');
    const tabla = p.sections.flatMap((s) => s.blocks).find((b) => b.table).table;
    expect(tabla.rows).toHaveLength(TEMPORADAS_2027.length);
    TEMPORADAS_2027.forEach((temporada, i) => {
      expect(tabla.rows[i][0]).toBe(temporada.nombre);
      expect(tabla.rows[i][1]).toBe(fechaLarga(temporada.fecha));
      expect(tabla.rows[i][2]).toBe(fechaLarga(limiteDePedido(temporada.fecha)));
    });
    const navidad = TEMPORADAS_2027.find((x) => x.nombre.includes('Navidad'));
    expect(p.answer).toContain(fechaLarga(limiteDePedido(navidad.fecha)));
  });

  it('certificaciones: nombra las que Conócenos declara', () => {
    const t = textoDe(post('certificaciones-proveedor-promocionales'));
    for (const c of ['SMETA', 'FAMA', 'Principios Rectores', 'ESR', 'PPAI', 'AMPPRO', 'Grupo Salinas']) {
      expect(t, c).toContain(c);
    }
  });

  it('kit de bienvenida: las opciones por tipo salen del catálogo', () => {
    const t = textoDe(post('kit-de-bienvenida-empleados'));
    // "Más de N" tiene que ser cierto: 400 mochilas son "más de 390", no "más de 400".
    const decena = (n) => miles(Math.floor((n - 1) / 10) * 10);
    for (const tipo of ['termos', 'libretas', 'boligrafos', 'mochilas']) {
      expect(t, tipo).toContain(`más de ${decena(CATALOGO.tipos[tipo])}`);
    }
    expect(t).toMatch(/no maneja cantidad mínima/);
  });

  it('ecológicos: total, tipos y materiales son los del catálogo', () => {
    const t = textoDe(post('promocionales-ecologicos'));
    expect(t).toContain(`${CATALOGO.ecologicos.total} productos`);
    for (const m of CATALOGO.ecologicos.materiales) expect(t, m.nombre).toContain(String(m.productos));
    for (const tipo of CATALOGO.ecologicos.tipos) expect(t, tipo.nombre).toContain(String(tipo.productos));
  });

  it('los conteos del catálogo cuadran entre sí', () => {
    expect(CATALOGO.conTecnica + CATALOGO.sinTecnica).toBe(CATALOGO.activos);
    expect(CATALOGO.variasTecnicas).toBeLessThan(CATALOGO.conTecnica);
    for (const tec of CATALOGO.tecnicas) expect(tec.productos).toBeLessThanOrEqual(CATALOGO.conTecnica);
    expect(CATALOGO.categorias).toHaveLength(8);
  });
});
