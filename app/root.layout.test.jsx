/* El meta de una ruta hija sustituye al de root, así que un Organization
   declarado en el meta de root sólo salía en las páginas sin meta propio (el
   404). El bloque tiene que salir en TODAS las páginas: va en el Layout. */
import {describe, it, expect, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';

// Meta/Links/Scripts necesitan el contexto del framework; aquí sólo importa
// lo que el Layout pinta por su cuenta.
vi.mock('react-router', async (original) => ({
  ...(await original()),
  Meta: () => null,
  Links: () => null,
  Scripts: () => null,
  ScrollRestoration: () => null,
}));

import {Layout, meta} from './root.jsx';
import {ORGANIZATION_ID} from './lib/seo.js';

const bloquesJsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );

describe('Layout: datos estructurados de la empresa', () => {
  it('pinta Organization en cualquier página, tenga o no meta propio', () => {
    const html = renderToStaticMarkup(
      <Layout>
        <main />
      </Layout>,
    );
    const org = bloquesJsonLd(html).filter((b) => b['@type'] === 'Organization');
    expect(org).toHaveLength(1);
    expect(org[0]['@id']).toBe(ORGANIZATION_ID);
  });

  it('no lo repite desde el meta de root, o el 404 lo llevaría dos veces', () => {
    const descriptores = meta({data: {origin: 'https://generandoideas.com'}});
    expect(descriptores.some((d) => d['script:ld+json'])).toBe(false);
  });
});
