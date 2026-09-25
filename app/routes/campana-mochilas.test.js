import {describe, it, expect, vi, beforeEach} from 'vitest';

const loadCollaborator = vi.fn();
const sendEmail = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/auth/collaborator-guard', () => ({
  loadCollaborator: (...a) => loadCollaborator(...a),
}));
vi.mock('~/lib/email/resend', () => ({sendEmail: (...a) => sendEmail(...a)}));

const findMochilaRequest = vi.fn();
const createMochilaRequest = vi.fn();
const deleteMochilaRequest = vi.fn();
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/mochilas/requests', () => ({
  findMochilaRequest: (...a) => findMochilaRequest(...a),
  createMochilaRequest: (...a) => createMochilaRequest(...a),
  deleteMochilaRequest: (...a) => deleteMochilaRequest(...a),
}));

import {loader, action} from './campana-mochilas.jsx';

async function read(res) {
  if (res instanceof Response) return {status: res.status, body: await res.json()};
  // data() sin init trae `init: null`; igual es un DataWithResponseInit.
  if (res && 'data' in res && 'init' in res) {
    return {status: res.init?.status ?? 200, body: res.data, headers: res.init?.headers};
  }
  return {status: 200, body: res};
}

const ZEN = {
  id: 'p1',
  handle: 'g4-moc-zen',
  title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN',
  description: 'Ligera.',
  tags: ['mochila-takayama'],
  featuredImage: {url: 'https://cdn/zen.png', altText: null},
  variants: {
    nodes: [
      {id: 'v-ok', title: 'NEGRO', availableForSale: true, image: null},
      {id: 'v-agotada', title: 'ROJO', availableForSale: false, image: null},
    ],
  },
};

const ARMOR = {
  id: 'p2',
  handle: 'g4-moc-arx',
  title: 'MOCHILA WAGNER ARMOR MAX MOC-ARX',
  description: 'Estructura.',
  tags: ['mochila-wagner'],
  featuredImage: {url: 'https://cdn/arx.png', altText: null},
  variants: {nodes: [{id: 'w-ok', title: 'NEGRO/GRIS', availableForSale: true, image: null}]},
};

function makeContext() {
  return {
    env: {},
    session: {},
    storefront: {
      query: vi.fn().mockResolvedValue({products: {nodes: [ZEN, ARMOR]}}),
      CacheShort: () => 'short',
    },
  };
}

function post(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://gi.test/campana-mochilas', {method: 'POST', body});
}

const VALID = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  variantId: 'v-ok',
  foraneo: 'no',
};

beforeEach(() => {
  loadCollaborator.mockReset().mockResolvedValue({
    user: {id: 'u1', email: 'ana@generandoideas.com', firstName: 'Ana', lastName: 'López'},
    allowed: true,
  });
  sendEmail.mockReset().mockResolvedValue({stub: false, id: 'e1'});
  findMochilaRequest.mockReset().mockResolvedValue(null);
  createMochilaRequest.mockReset().mockResolvedValue({created: true});
  deleteMochilaRequest.mockReset().mockResolvedValue(undefined);
});

const EXISTING = {
  line: 'Wagner',
  model: 'Space',
  color: 'Azul',
  image: 'https://cdn/spa.png',
  foraneo: false,
  createdAt: '2026-09-25T17:00:00.000Z',
};

describe('una sola solicitud por colaborador', () => {
  it('loader: quien ya pidió ve su solicitud y no el catálogo', async () => {
    findMochilaRequest.mockResolvedValue(EXISTING);
    const context = makeContext();
    const r = await read(await loader({context}));
    expect(findMochilaRequest).toHaveBeenCalledWith({__db: true}, 'u1');
    expect(r.body.existing).toEqual(EXISTING);
    expect(r.body.lines).toBeUndefined();
    expect(context.storefront.query).not.toHaveBeenCalled();
  });

  it('loader: quien no ha pedido recibe existing null y el catálogo', async () => {
    const r = await read(await loader({context: makeContext()}));
    expect(r.body.existing).toBeNull();
    expect(r.body.lines).toHaveLength(2);
  });

  it('action: guarda la solicitud antes de mandar el correo', async () => {
    await action({request: post(VALID), context: makeContext()});
    expect(createMochilaRequest).toHaveBeenCalledWith(
      {__db: true},
      expect.objectContaining({
        userId: 'u1',
        email: 'ana@generandoideas.com',
        line: 'Takayama',
        model: 'Zen',
        color: 'Negro',
        variantId: 'v-ok',
        image: 'https://cdn/zen.png',
        foraneo: false,
      }),
    );
    expect(createMochilaRequest.mock.invocationCallOrder[0]).toBeLessThan(
      sendEmail.mock.invocationCallOrder[0],
    );
  });

  it('action: una segunda solicitud responde 409 sin correo', async () => {
    createMochilaRequest.mockResolvedValue({created: false});
    findMochilaRequest.mockResolvedValue(EXISTING);
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ok: false, existing: EXISTING});
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('action: si el correo falla se libera la solicitud para reintentar', async () => {
    sendEmail.mockRejectedValue(new Error('Resend caído'));
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(502);
    expect(deleteMochilaRequest).toHaveBeenCalledWith({__db: true}, 'u1');
  });

  it('action: el éxito devuelve la foto para el cierre', async () => {
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.body.summary.image).toBe('https://cdn/zen.png');
  });
});

describe('loader', () => {
  it('pide la puerta con regreso a esta página', async () => {
    await loader({context: makeContext()});
    expect(loadCollaborator.mock.calls[0][1]).toBe('/campana-mochilas');
  });

  it('colaborador: líneas y datos, sin caché', async () => {
    const r = await read(await loader({context: makeContext()}));
    expect(r.body.denied).toBe(false);
    expect(r.body.collaborator).toEqual({email: 'ana@generandoideas.com', fullName: 'Ana López'});
    expect(r.body.lines.map((l) => l.name)).toEqual(['Takayama', 'Wagner']);
    expect(r.headers['Cache-Control']).toMatch(/no-store/);
  });

  it('otro dominio: 403 sin consultar productos', async () => {
    loadCollaborator.mockResolvedValue({user: {email: 'ana@empresa.mx'}, allowed: false});
    const context = makeContext();
    const r = await read(await loader({context}));
    expect(r.status).toBe(403);
    expect(r.body).toEqual({denied: true});
    expect(context.storefront.query).not.toHaveBeenCalled();
  });

  it('propaga el redirect a login', async () => {
    loadCollaborator.mockRejectedValue(new Response(null, {status: 302}));
    await expect(loader({context: makeContext()})).rejects.toMatchObject({status: 302});
  });
});

describe('action', () => {
  it('manda el correo a igarcia con copia al colaborador', async () => {
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.body).toEqual({
      ok: true,
      summary: {
        line: 'Takayama',
        model: 'Zen',
        color: 'Negro',
        image: 'https://cdn/zen.png',
        foraneo: false,
      },
    });
    const [, msg] = sendEmail.mock.calls[0];
    expect(msg.to).toBe('igarcia@generandoideas.com');
    expect(msg.cc).toBe('ana@generandoideas.com');
    expect(msg.replyTo).toBe('ana@generandoideas.com');
    expect(msg.subject).toBe('Mochila – Ana López – Takayama Zen / Negro');
  });

  it('acepta una mochila Wagner', async () => {
    const r = await read(
      await action({request: post({...VALID, variantId: 'w-ok'}), context: makeContext()}),
    );
    expect(r.body.summary).toMatchObject({line: 'Wagner', model: 'Armor Max', color: 'Negro / Gris'});
  });

  it('respeta MOCHILAS_EMAIL', async () => {
    const context = makeContext();
    context.env.MOCHILAS_EMAIL = 'rh@generandoideas.com';
    await action({request: post(VALID), context});
    expect(sendEmail.mock.calls[0][1].to).toBe('rh@generandoideas.com');
  });

  it('otro dominio: 403 sin correo', async () => {
    loadCollaborator.mockResolvedValue({user: {email: 'ana@empresa.mx'}, allowed: false});
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('datos inválidos: 400 con errores por campo', async () => {
    const r = await read(
      await action({request: post({...VALID, phone: '123'}), context: makeContext()}),
    );
    expect(r.status).toBe(400);
    expect(r.body.errors.phone).toBeTruthy();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each(['v-agotada', 'gid://shopify/ProductVariant/de-otro-producto'])(
    'variante no elegible (%s): 400 sin correo',
    async (variantId) => {
      const r = await read(
        await action({request: post({...VALID, variantId}), context: makeContext()}),
      );
      expect(r.status).toBe(400);
      expect(r.body.errors.variantId).toBe('Esa mochila ya no está disponible. Elige otra.');
      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  it('fallo de Resend: 502 con mensaje', async () => {
    sendEmail.mockRejectedValue(new Error('Resend API error (status 500)'));
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(502);
    expect(r.body.formError).toBe('No pudimos enviar tu elección, intenta de nuevo.');
  });
});
