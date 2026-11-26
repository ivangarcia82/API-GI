/* Preguntas frecuentes: la página existe para que un buscador o un asistente
   de IA pueda levantar una respuesta completa sin leer el resto del sitio.
   Estas pruebas fijan lo que hace citable una respuesta —pregunta real,
   respuesta directa de 40 a 60 palabras, que se entienda sola— y que los
   datos no se despeguen de lo que el sitio ya declara en otras partes. */
import {describe, it, expect} from 'vitest';
import {FAQ_GROUPS, FAQ_PATH, faqItems, faqAnswerText, faqSchema} from './faq.js';
import {PRICE_MATRIX} from './decoration/engine.js';
import {IVA_RATE} from './quotes/discount.js';
import {BRAND, SERVICES, SERVICE_DETAILS} from './site-content.js';
import {HOME_CATEGORIES} from './gi.js';

const plano = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const palabras = (s) => String(s).trim().split(/\s+/).length;
const items = faqItems();
const de = (fragmento) => {
  const it = items.find((i) => plano(i.q).includes(plano(fragmento)));
  if (!it) throw new Error(`No hay pregunta con "${fragmento}"`);
  return it;
};

describe('forma de las preguntas', () => {
  it('hay grupos con preguntas, y ninguna se repite', () => {
    expect(FAQ_GROUPS.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeGreaterThanOrEqual(12);
    expect(new Set(items.map((i) => i.q)).size).toBe(items.length);
  });

  it('cada una está escrita como pregunta', () => {
    for (const {q} of items) expect(q).toMatch(/^¿.+\?$/);
  });

  it('cada respuesta directa tiene entre 40 y 60 palabras', () => {
    for (const {q, a} of items) {
      expect({q, palabras: palabras(a)}).toEqual({q, palabras: expect.any(Number)});
      expect(palabras(a), q).toBeGreaterThanOrEqual(40);
      expect(palabras(a), q).toBeLessThanOrEqual(60);
    }
  });

  it('cada respuesta se entiende sola: nombra de quién habla y no remite a otro texto', () => {
    for (const {q, a} of items) {
      expect(a, q).toMatch(/Generando Ideas|generandoideas\.com/);
      expect(a, q).not.toMatch(/^(Esto|Eso|Lo anterior|Como se mencion|Como ya|Adem[aá]s de lo)/i);
      expect(a, q).not.toMatch(/arriba|m[aá]s abajo|anteriormente|la pregunta anterior/i);
    }
  });

  it('ninguna respuesta publica importes: los precios son sólo para clientes', () => {
    for (const it of items) expect(faqAnswerText(it), it.q).not.toMatch(/\$\s?\d/);
  });
});

describe('los datos salen de lo que el sitio ya declara', () => {
  it('nombra todas las técnicas del motor de decorado', () => {
    const texto = plano(faqAnswerText(de('técnicas de personalización')));
    const sinonimos = {'full color': 'a todo color'};
    for (const tecnica of Object.keys(PRICE_MATRIX)) {
      let buscada = plano(tecnica);
      for (const [de_, a] of Object.entries(sinonimos)) buscada = buscada.replace(de_, a);
      expect(texto, tecnica).toContain(buscada);
    }
  });

  it('la tabla de técnica por producto es la de Print Shop', () => {
    const tabla = SERVICE_DETAILS['print-shop'].blocks.find((b) => b.table).table;
    expect(de('conviene para cada producto').table).toEqual(tabla);
  });

  it('los pasos de personalización son los de Print Shop', () => {
    const pasos = SERVICE_DETAILS['print-shop'].blocks
      .find((b) => b.type === 'process')
      .steps.map((s) => s.t);
    expect(de('proceso para personalizar').steps).toEqual(pasos);
  });

  it('el IVA es el que usa la cotización', () => {
    expect(de('incluyen IVA').a).toContain(`${Math.round(IVA_RATE * 100)}%`);
  });

  it('nombra todos los servicios', () => {
    const texto = de('servicios ofrece').a;
    for (const s of SERVICES.filter((x) => x.id !== 'promo')) expect(texto).toContain(s.title);
  });

  it('nombra todas las categorías del catálogo', () => {
    const texto = plano(de('tipo de artículos').a);
    for (const c of HOME_CATEGORIES) expect(texto, c.name).toContain(plano(c.name));
  });

  it('el contacto es el de la marca', () => {
    const texto = de('contacto a un asesor').a;
    expect(texto).toContain(BRAND.phone);
    expect(texto).toContain(BRAND.email);
  });
});

describe('datos estructurados', () => {
  const schema = faqSchema('https://generandoideas.com');

  it('es una FAQPage con una entrada por pregunta', () => {
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.url).toBe(`https://generandoideas.com${FAQ_PATH}`);
    expect(schema.mainEntity).toHaveLength(items.length);
  });

  it('cada entrada lleva la pregunta y la respuesta completa', () => {
    schema.mainEntity.forEach((entrada, i) => {
      expect(entrada).toMatchObject({
        '@type': 'Question',
        name: items[i].q,
        acceptedAnswer: {'@type': 'Answer', text: faqAnswerText(items[i])},
      });
    });
  });

  it('la respuesta con pasos los incluye en el texto', () => {
    const it_ = de('proceso para personalizar');
    for (const paso of it_.steps) expect(faqAnswerText(it_)).toContain(paso);
  });

  it('dice quién responde', () => {
    expect(schema.publisher).toEqual({'@id': 'https://generandoideas.com/#organization'});
  });
});
