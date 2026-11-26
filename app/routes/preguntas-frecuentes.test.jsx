/* La página de preguntas frecuentes tiene que servir completa en el HTML del
   servidor: los rastreadores de IA no ejecutan JavaScript, así que una
   respuesta que sólo aparece al abrir un acordeón no existe para ellos. */
import {describe, it, expect, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoutesStub} from 'react-router';
import {faqItems, FAQ_GROUPS} from '~/lib/faq';

vi.mock('~/lib/motion', () => ({initMotion: () => {}, destroyMotion: () => {}}));
vi.mock('~/lib/cms', () => ({getJobs: async () => []}));

import PreguntasFrecuentes, {meta} from './preguntas-frecuentes.jsx';
import {loader as viejaRuta} from './pages.preguntas-frecuentes.jsx';
import {loader as sitemap} from './[sitemap-marketing.xml].jsx';

const html = () => {
  const Stub = createRoutesStub([{path: '/preguntas-frecuentes', Component: PreguntasFrecuentes}]);
  return renderToStaticMarkup(<Stub initialEntries={['/preguntas-frecuentes']} />);
};
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sinEntidades = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('/preguntas-frecuentes · contenido', () => {
  const h = html();

  it('tiene un solo h1', () => {
    expect(h.match(/<h1\b/g)).toHaveLength(1);
  });

  it('cada grupo es un h2 y cada pregunta un h3', () => {
    expect(h.match(/<h2\b/g).length).toBeGreaterThanOrEqual(FAQ_GROUPS.length);
    expect(h.match(/<h3\b/g)).toHaveLength(faqItems().length);
  });

  it('la respuesta va en el párrafo inmediato a su pregunta, sin abrir nada', () => {
    for (const {q, a} of faqItems()) {
      const i = sinEntidades(h).indexOf(`${q}</h3>`);
      expect(i, q).toBeGreaterThan(-1);
      const despues = sinEntidades(h).slice(i + q.length + 5, i + q.length + 5 + a.length + 40);
      expect(despues, q).toMatch(/^<p[^>]*>/);
      expect(despues.replace(/^<p[^>]*>/, ''), q).toContain(a.slice(0, 60));
    }
    expect(h).not.toMatch(/<details|hidden=|aria-expanded/);
  });

  it('abre con un resumen que dice qué es la empresa', () => {
    const arriba = texto(h.slice(0, h.indexOf('<h2')));
    expect(arriba).toMatch(/Generando Ideas/);
    expect(arriba).toMatch(/artículos promocionales/);
    expect(arriba).toMatch(/México/);
  });

  it('pinta los pasos como lista ordenada y la comparación como tabla', () => {
    expect(h).toMatch(/<ol\b/);
    expect(h).toMatch(/<table\b/);
    expect(h).toMatch(/Tampografía/);
  });

  it('ofrece una salida a quien no encontró su respuesta', () => {
    expect(h).toMatch(/href="\/contacto"/);
  });
});

describe('/preguntas-frecuentes · metadatos', () => {
  const m = meta({});
  const ld = m.find((d) => d['script:ld+json'])['script:ld+json'];

  it('título y descripción dicen de qué trata la página', () => {
    expect(m.find((d) => d.title).title).toMatch(/Preguntas frecuentes/);
    const desc = m.find((d) => d.name === 'description').content;
    expect(desc).toMatch(/Generando Ideas/);
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('declara su dirección canónica', () => {
    expect(m).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://generandoideas.com/preguntas-frecuentes',
    });
  });

  it('declara la FAQPage y las migas', () => {
    const tipos = ld['@graph'].map((n) => n['@type']);
    expect(tipos).toEqual(['FAQPage', 'BreadcrumbList']);
    expect(ld['@graph'][0].mainEntity).toHaveLength(faqItems().length);
  });
});

describe('alrededor de la página', () => {
  it('la dirección vieja (/pages/preguntas-frecuentes) redirige de forma permanente', async () => {
    let res;
    try {
      res = await viejaRuta({});
    } catch (lanzado) {
      res = lanzado;
    }
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('/preguntas-frecuentes');
  });

  it('está en el sitemap', async () => {
    const res = await sitemap({
      request: new Request('https://generandoideas.com/sitemap-marketing.xml'),
      context: {env: {}},
    });
    expect(await res.text()).toContain('<loc>https://generandoideas.com/preguntas-frecuentes</loc>');
  });
});
