import {describe, it, expect, vi, beforeEach} from 'vitest';

const requireUser = vi.fn();
const getQuoteWithItems = vi.fn();
const findById = vi.fn();
const getCustomerAdvisor = vi.fn();

vi.mock('~/lib/auth/guard', () => ({requireUser: (...a) => requireUser(...a)}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/quotes/repo', () => ({
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
}));
vi.mock('~/lib/auth/users', () => ({findById: (...a) => findById(...a)}));
vi.mock('~/lib/admin/operations', () => ({
  getCustomerAdvisor: (...a) => getCustomerAdvisor(...a),
}));

import {loader} from './print.cotizacion.$id.jsx';
import {NOTAS_IMPORTANTES} from '~/lib/quotes/notasImportantes';

const context = {env: {}};

const ITEMS = [
  {
    title: 'Taza cerámica',
    qty: 300,
    technique: 'SERIGRAFÍA',
    size: '4 x 4',
    effectiveUnitPrice: 29.97,
    image: 'https://cdn.shopify.com/taza.jpg',
  },
  {
    title: 'Libreta A5',
    qty: 100,
    technique: 'Sin decorado',
    effectiveUnitPrice: 55,
    image: null,
  },
];

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({userId: 'u1'});
  getQuoteWithItems.mockReset().mockResolvedValue({
    quote: {
      id: 'uuid-largo-e-ilegible',
      userId: 'u1',
      folio: 'GIV.CDMX.20260007',
      notes: null,
      deadline: null,
    },
    items: ITEMS,
  });
  findById.mockReset().mockResolvedValue({
    firstName: 'Mariana',
    lastName: 'Ruiz',
    email: 'mariana@acme.mx',
    company: 'Acme Corp',
    shopifyCustomerGid: 'gid://shopify/Customer/1',
  });
  getCustomerAdvisor.mockReset().mockResolvedValue({
    email: 'nsanchez@generandoideas.com',
    fields: {
      nombre: 'Noé Sánchez',
      puesto: 'Strategic Sales | Account Executive',
      telefono: '+52 55 8058 7192',
    },
  });
});

async function render() {
  const res = await loader({params: {id: 'q1'}, context});
  return res.text();
}

describe('formato de cotización · identidad y folio', () => {
  it('muestra el folio corto y no el uuid interno', async () => {
    const html = await render();
    expect(html).toContain('GIV.CDMX.20260007');
    expect(html).not.toContain('uuid-largo-e-ilegible');
  });

  it('cae al id cuando la cotización es anterior al folio', async () => {
    getQuoteWithItems.mockResolvedValueOnce({
      quote: {id: 'uuid-viejo', userId: 'u1', folio: null, notes: null, deadline: null},
      items: ITEMS,
    });
    expect(await render()).toContain('uuid-viejo');
  });

  it('lleva el logo en el encabezado y el lema en el pie', async () => {
    const html = await render();
    expect(html).toContain('/brand/gi-logo-horizontal-email.png');
    expect(html).toContain('YOUR ONE STOP SOLUTION');
    expect(html).toContain('www.generandoideas.com');
  });
});

describe('formato de cotización · contenido', () => {
  it('imprime las cinco notas importantes', async () => {
    const html = await render();
    for (const nota of NOTAS_IMPORTANTES) {
      // El HTML escapa comillas y acentos quedan tal cual; basta un fragmento.
      expect(html).toContain(nota.slice(0, 40));
    }
  });

  it('ya no promete respuesta en 24 horas', async () => {
    expect(await render()).not.toContain('24 horas');
  });

  it('numera las filas y pinta la imagen cuando existe', async () => {
    const html = await render();
    expect(html).toContain('https://cdn.shopify.com/taza.jpg');
    // La segunda partida no trae imagen: no debe romper la fila.
    expect(html).toContain('sin-img');
  });

  it('muestra el decorado bajo el título, y lo omite si no hay', async () => {
    const html = await render();
    expect(html).toContain('SERIGRAFÍA 4 x 4');
    expect(html).not.toContain('Sin decorado');
  });

  it('calcula subtotal, IVA y total', async () => {
    const html = await render();
    const subtotal = 300 * 29.97 + 100 * 55;
    expect(html).toContain(
      subtotal.toLocaleString('es-MX', {style: 'currency', currency: 'MXN'}),
    );
    expect(html).toContain('I.V.A.');
  });
});

describe('formato de cotización · bloque Atte.', () => {
  it('firma con el ejecutivo asignado', async () => {
    const html = await render();
    expect(html).toContain('Noé Sánchez');
    expect(html).toContain('Strategic Sales | Account Executive');
    expect(html).toContain('nsanchez@generandoideas.com');
  });

  it('cae al equipo comercial cuando el cliente no tiene asesor', async () => {
    getCustomerAdvisor.mockResolvedValueOnce({email: null, fields: {}});
    const html = await render();
    expect(html).toContain('Equipo comercial');
    expect(html).toContain('marketing@generandoideas.com');
  });

  it('no impide imprimir si el Admin API falla', async () => {
    getCustomerAdvisor.mockRejectedValueOnce(new Error('admin down'));
    const html = await render();
    expect(html).toContain('Equipo comercial');
    expect(html).toContain('GIV.CDMX.20260007');
  });
});

describe('formato de cotización · propiedad', () => {
  it('devuelve 404 con la cotización de otra persona', async () => {
    getQuoteWithItems.mockResolvedValueOnce({
      quote: {id: 'q1', userId: 'otro', folio: 'GIV.CDMX.20260001'},
      items: [],
    });
    await expect(loader({params: {id: 'q1'}, context})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('devuelve 404 cuando la cotización no existe', async () => {
    getQuoteWithItems.mockResolvedValueOnce({quote: null, items: []});
    await expect(loader({params: {id: 'nope'}, context})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('escapa el contenido que viene del usuario', async () => {
    getQuoteWithItems.mockResolvedValueOnce({
      quote: {
        id: 'q1',
        userId: 'u1',
        folio: 'GIV.CDMX.20260007',
        notes: '<script>alert(1)</script>',
        deadline: null,
      },
      items: ITEMS,
    });
    const html = await render();
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('formato de cotización · pie fiscal', () => {
  it('imprime razón social, domicilio y RFC', async () => {
    const html = await render();
    expect(html).toContain('Estrategia en Suministros Internacionales');
    expect(html).toContain('Cda. Antonio Maceo 67');
    expect(html).toContain('RFC: ESI130515FI3');
  });
});

describe('formato de cotización · cupón', () => {
  /** Los importes de la caja de totales, en orden. */
  function totales(html) {
    const caja = html.split('class="totales"')[1]?.split('</div>\n    </div>')[0] ?? '';
    return [...caja.matchAll(/class="val">([^<]+)</g)].map((m) => m[1]);
  }

  it('sin cupón el PDF no inventa una línea de descuento', async () => {
    const html = await render();
    expect(html).not.toMatch(/Descuento/);
  });

  it('con cupón imprime el descuento y calcula el IVA sobre el neto', async () => {
    // 300 x 29.97 = 8,991 + 100 x 55 = 5,500 -> subtotal 14,491
    getQuoteWithItems.mockResolvedValue({
      quote: {
        id: 'q1', userId: 'u1', folio: 'GIV.CDMX.20260007', notes: null, deadline: null,
        discountCode: 'BIENVENIDOANDANAC', discountPercentage: 20,
      },
      items: ITEMS,
    });
    const html = await render();
    expect(html).toMatch(/Descuento/);
    expect(html).toMatch(/BIENVENIDOANDANAC/);
    const [subtotal, descuento, iva, total] = totales(html);
    expect(subtotal).toContain('14,491');
    expect(descuento).toContain('2,898.20');
    // IVA del neto (11,592.80), no de los 14,491 originales.
    expect(iva).toContain('1,854.85');
    expect(total).toContain('13,447.65');
  });
});

describe('formato de cotización · variante y descarga', () => {
  it('pone el color y la talla debajo del nombre del producto', async () => {
    getQuoteWithItems.mockResolvedValueOnce({
      quote: {id: 'q1', userId: 'u1', folio: 'GIP.Web.Cotización_007'},
      items: [{...ITEMS[0], options: [{name: 'Color', value: 'ROSA'}, {name: 'Talla', value: 'M'}]}],
    });
    expect(await render()).toContain('Color: ROSA · Talla: M');
  });

  it('con ?descargar=1 baja el PDF solo, con el folio como nombre', async () => {
    const res = await loader({
      params: {id: 'q1'},
      context,
      request: new Request('https://gi.test/print/cotizacion/q1?descargar=1'),
    });
    const html = await res.text();
    expect(html).toContain('var AUTO = true');
    expect(html).toContain('GIV.CDMX.20260007.pdf');
  });

  it('sin el parámetro sólo ofrece el botón', async () => {
    const html = await render();
    expect(html).toContain('var AUTO = false');
    expect(html).toContain('Descargar PDF');
  });
});
