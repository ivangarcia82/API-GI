// @vitest-environment jsdom
/* La página de artículo servía el mismo texto para los seis. Ahora pinta el
   contenido de cada uno, completo en el HTML del servidor, con su autora y
   sus datos estructurados; y las direcciones de los artículos retirados
   llevan a su reemplazo. */
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRoutesStub} from 'react-router';
import {BLOG_AUTHOR, BLOG_POSTS, BLOG_REDIRECTS} from '~/lib/blog';

vi.mock('~/lib/motion', () => ({
  initMotion: () => {},
  destroyMotion: () => {},
  loadGsap: async () => null,
  prefersReducedMotion: () => true,
}));
vi.mock('~/lib/cms', () => ({getJobs: async () => []}));

import BlogArticle, {loader, meta} from './blog.$slug.jsx';
import BlogIndex from './blog._index.jsx';
import {loader as sitemap} from './[sitemap-marketing.xml].jsx';

afterEach(cleanup);

async function pedir(slug) {
  try {
    return await loader({params: {slug}});
  } catch (lanzado) {
    return lanzado;
  }
}

const htmlDe = (post) => {
  const Stub = createRoutesStub([
    {path: '/blog/:slug', Component: BlogArticle, loader: () => ({post}), HydrateFallback: () => null},
  ]);
  return renderToStaticMarkup(
    <Stub initialEntries={[`/blog/${post.id}`]} hydrationData={{loaderData: {0: {post}}}} />,
  );
};

describe('loader', () => {
  it('entrega el artículo que existe', async () => {
    const out = await pedir('impresion-tecnicas');
    expect(out.post.id).toBe('impresion-tecnicas');
  });

  it('un artículo retirado redirige de forma permanente a su reemplazo', async () => {
    for (const [viejo, destino] of Object.entries(BLOG_REDIRECTS)) {
      const res = await pedir(viejo);
      expect(res.status, viejo).toBe(301);
      expect(res.headers.get('Location'), viejo).toBe(destino);
    }
  });

  it('una dirección desconocida vuelve al blog', async () => {
    const res = await pedir('no-existe');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/blog');
  });
});

describe.each(BLOG_POSTS.map((p) => [p.id, p]))('metadatos de %s', (_id, post) => {
  const m = meta({data: {post}});
  const grafo = m.find((d) => d['script:ld+json'])['script:ld+json']['@graph'];
  const articulo = grafo.find((n) => n['@type'] === 'BlogPosting');
  const url = `https://generandoideas.com/blog/${post.id}`;

  it('título, descripción y dirección canónica', () => {
    expect(m.find((d) => d.title).title).toContain(post.title);
    expect(m.find((d) => d.name === 'description').content).toBe(post.excerpt);
    expect(m).toContainEqual({tagName: 'link', rel: 'canonical', href: url});
  });

  it('declara el artículo con su autora, fecha e imagen absoluta', () => {
    expect(articulo.headline).toBe(post.title);
    expect(articulo.author).toMatchObject({'@type': 'Person', name: BLOG_AUTHOR.name});
    expect(articulo.author.worksFor).toEqual({'@id': 'https://generandoideas.com/#organization'});
    expect(articulo.datePublished).toBe(post.iso);
    expect(articulo.image.url).toMatch(/^https:\/\//);
    expect(articulo.wordCount).toBeGreaterThan(300);
  });
});

describe.each(BLOG_POSTS.map((p) => [p.id, p]))('página de %s', (_id, post) => {
  const h = htmlDe(post);
  const texto = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('un h1 con el título y la respuesta directa justo después', () => {
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(texto).toContain(post.answer);
  });

  it('cada apartado sale como h2 con su respuesta en el párrafo inmediato', () => {
    for (const s of post.sections) {
      const i = h.indexOf(`${s.h}</h2>`);
      expect(i, s.h).toBeGreaterThan(-1);
      expect(h.slice(i + s.h.length + 5, i + s.h.length + 12), s.h).toMatch(/^<p[ >]/);
    }
    expect(h).not.toMatch(/<details|aria-expanded/);
  });

  /* El texto tiene un ancho de lectura acotado; el resto de la pantalla lo
     ocupa un índice lateral que acompaña al bajar, en vez de quedar vacío. */
  it('el índice lateral enlaza cada apartado', () => {
    expect(h).toMatch(/<aside[^>]*class="article-aside"/);
    post.sections.forEach((s, i) => {
      expect(h, s.h).toContain(`<h2 class="display prose-h2" id="s${i + 1}">`);
      expect(h, s.h).toContain(`href="#s${i + 1}"`);
    });
    // El índice va después del texto en el HTML: no se mete entre una pregunta y su respuesta.
    expect(h.indexOf('class="article-aside"')).toBeGreaterThan(h.lastIndexOf('</h2>'));
  });

  it('firma la autora y ya no trae el texto genérico de antes', () => {
    expect(texto).toContain(`Por ${BLOG_AUTHOR.name}`);
    expect(texto).not.toMatch(/Lo esencial en 30 segundos|se lleva puesta|sesiones cerradas/);
  });

  it('el resumen, las tablas y los siguientes pasos están en el HTML', () => {
    for (const punto of post.takeaways) expect(texto).toContain(punto);
    const conTabla = post.sections.some((s) => s.blocks.some((b) => b.table));
    if (conTabla) expect(h).toMatch(/<table\b/);
    for (const n of post.next) expect(h).toContain(`href="${n.to}"`);
  });
});

describe('índice del blog y sitemap', () => {
  it('lista los seis artículos', async () => {
    const Stub = createRoutesStub([{path: '/blog', Component: BlogIndex}]);
    render(<Stub initialEntries={['/blog']} />);
    for (const p of BLOG_POSTS) expect(await screen.findByText(p.title)).toBeTruthy();
  });

  it('el sitemap trae los artículos nuevos y ninguno retirado', async () => {
    const res = await sitemap({
      request: new Request('https://generandoideas.com/sitemap-marketing.xml'),
      context: {env: {}},
    });
    const xml = await res.text();
    for (const p of BLOG_POSTS) expect(xml).toContain(`/blog/${p.id}</loc>`);
    for (const viejo of Object.keys(BLOG_REDIRECTS)) expect(xml).not.toContain(`/blog/${viejo}</loc>`);
  });
});
