import {describe, it, expect, vi, beforeEach} from 'vitest';

const requireAdvisor = vi.fn();
const getQuoteWithItems = vi.fn();
const listAdvisorQuotes = vi.fn();
const findById = vi.fn();

vi.mock('~/lib/auth/advisor-guard', () => ({requireAdvisor: (...a) => requireAdvisor(...a)}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/quotes/repo', () => ({
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
  listAdvisorQuotes: (...a) => listAdvisorQuotes(...a),
}));
vi.mock('~/lib/auth/users', () => ({findById: (...a) => findById(...a)}));

import {loader as listaLoader} from './asesor.cotizaciones._index.jsx';
import {loader as detalleLoader} from './asesor.cotizaciones.$id.jsx';

const context = {env: {}};

beforeEach(() => {
  requireAdvisor.mockReset().mockResolvedValue({id: 'a1', email: 'lvega@gi.com'});
  getQuoteWithItems.mockReset();
  listAdvisorQuotes.mockReset().mockResolvedValue([]);
  findById.mockReset().mockResolvedValue({
    firstName: 'Mariana',
    lastName: 'Ruiz',
    email: 'mariana@acme.mx',
    phone: '55 1234 5678',
    company: 'Acme Corp',
  });
});

describe('portal del asesor · listado', () => {
  it('pide las cotizaciones del ejecutivo de la sesión, no de otro', async () => {
    await listaLoader({context});
    expect(listAdvisorQuotes).toHaveBeenCalledWith({__db: true}, 'lvega@gi.com');
  });

  it('propaga el 404 del guard a quien no es asesor', async () => {
    requireAdvisor.mockRejectedValue(new Response('No encontrada', {status: 404}));
    await expect(listaLoader({context})).rejects.toMatchObject({status: 404});
  });
});

describe('portal del asesor · detalle', () => {
  const asignada = {
    quote: {id: 'q1', userId: 'u9', folio: 'GIV.CDMX.20260007', advisorEmail: 'lvega@gi.com'},
    items: [],
  };

  it('abre la cotización que tiene asignada', async () => {
    getQuoteWithItems.mockResolvedValue(asignada);
    const out = await detalleLoader({params: {id: 'q1'}, context});
    expect(out.quote.folio).toBe('GIV.CDMX.20260007');
  });

  it('devuelve los datos del comprador para poder contactarlo', async () => {
    getQuoteWithItems.mockResolvedValue(asignada);
    const out = await detalleLoader({params: {id: 'q1'}, context});
    expect(out.comprador).toMatchObject({
      nombre: 'Mariana Ruiz',
      email: 'mariana@acme.mx',
      company: 'Acme Corp',
    });
    // Se busca al DUEÑO de la cotización, no al asesor de la sesión.
    expect(findById).toHaveBeenCalledWith({__db: true}, 'u9');
  });

  it('404 con la cotización de otro ejecutivo', async () => {
    getQuoteWithItems.mockResolvedValue({
      quote: {...asignada.quote, advisorEmail: 'otro@gi.com'},
      items: [],
    });
    await expect(detalleLoader({params: {id: 'q1'}, context})).rejects.toBeDefined();
  });

  it('404 con una cotización sin ejecutivo asignado', async () => {
    getQuoteWithItems.mockResolvedValue({
      quote: {...asignada.quote, advisorEmail: null},
      items: [],
    });
    await expect(detalleLoader({params: {id: 'q1'}, context})).rejects.toBeDefined();
  });

  it('404 cuando la cotización no existe', async () => {
    getQuoteWithItems.mockResolvedValue({quote: null, items: []});
    await expect(detalleLoader({params: {id: 'x'}, context})).rejects.toBeDefined();
  });

  it('se sostiene si no se puede leer al comprador', async () => {
    getQuoteWithItems.mockResolvedValue(asignada);
    findById.mockRejectedValue(new Error('db down'));
    const out = await detalleLoader({params: {id: 'q1'}, context});
    expect(out.comprador).toBeNull();
  });
});
