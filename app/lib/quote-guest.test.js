import {describe, it, expect} from 'vitest';
import {
  normalizeGuestLine,
  addGuestLine,
  parseGuestQuote,
  serializeGuestQuote,
  guestMergePayload,
  priceGuestLine,
  guestMergeOutcome,
  MAX_GUEST_LINES,
  GUEST_TTL_MS,
} from './quote-guest.js';

/* La línea de invitado la arman tres botones distintos (ficha, quick-add de la
   tarjeta y selección múltiple del catálogo), cada uno con la información que
   tiene a la mano. Normalizar es lo que evita que el cajón pinte NaN o que la
   migración mande basura al servidor. */
describe('normalizeGuestLine', () => {
  const AHORA = 1_700_000_000_000;

  it('conserva las cuatro claves de intención que el servidor va a leer', () => {
    const linea = normalizeGuestLine(
      {variantId: 'gid://v1', technique: 'Serigrafía', surface: 'Tela', size: '10x10', qty: 50},
      AHORA,
    );
    expect(linea).toMatchObject({
      variantId: 'gid://v1',
      technique: 'Serigrafía',
      surface: 'Tela',
      size: '10x10',
      qty: 50,
    });
  });

  it('descarta la línea sin variantId, que no se podría cotizar', () => {
    expect(normalizeGuestLine({title: 'Taza', qty: 10}, AHORA)).toBeNull();
  });

  it('asume "Sin decorado" cuando el botón no eligió técnica', () => {
    const linea = normalizeGuestLine({variantId: 'gid://v1', qty: 1}, AHORA);
    expect(linea.technique).toBe('Sin decorado');
    expect(linea.surface).toBe('');
    expect(linea.size).toBe('');
  });

  it('sube a 1 las cantidades cero, negativas o ilegibles', () => {
    const qty = (v) => normalizeGuestLine({variantId: 'gid://v1', qty: v}, AHORA).qty;
    expect(qty(0)).toBe(1);
    expect(qty(-8)).toBe(1);
    expect(qty('abc')).toBe(1);
    expect(qty(undefined)).toBe(1);
    expect(qty(12.7)).toBe(12);
  });

  it('deja el precio en 0 cuando no es un número usable, para no pintar NaN', () => {
    const precio = (v) =>
      normalizeGuestLine({variantId: 'gid://v1', qty: 1, baseUnitPrice: v}, AHORA).baseUnitPrice;
    expect(precio('89.50')).toBe(89.5);
    expect(precio(undefined)).toBe(0);
    expect(precio(Number.NaN)).toBe(0);
    expect(precio(-5)).toBe(0);
  });

  it('le pone id propio y sello de tiempo para poder borrarla del cajón', () => {
    const linea = normalizeGuestLine({variantId: 'gid://v1', qty: 1}, AHORA);
    expect(typeof linea.id).toBe('string');
    expect(linea.id.length).toBeGreaterThan(0);
    expect(linea.addedAt).toBe(AHORA);
  });

  it('respeta el id que ya traía, para que reescribir una línea no la duplique', () => {
    const linea = normalizeGuestLine({id: 'local-1', variantId: 'gid://v1', qty: 1}, AHORA);
    expect(linea.id).toBe('local-1');
  });
});

/* Sumar por las CUATRO claves y no sólo por variante: la misma taza con
   serigrafía y con bordado son dos líneas con precios distintos, y colapsarlas
   cobraría el decorado equivocado. */
describe('addGuestLine', () => {
  const AHORA = 1_700_000_000_000;
  const linea = (over = {}) =>
    normalizeGuestLine({variantId: 'gid://v1', technique: 'Serigrafía', qty: 10, ...over}, AHORA);

  it('suma la cantidad cuando la variante y el decorado coinciden', () => {
    const lista = addGuestLine([linea()], linea({qty: 15}), AHORA);
    expect(lista).toHaveLength(1);
    expect(lista[0].qty).toBe(25);
  });

  it('abre línea nueva cuando cambia la técnica sobre la misma variante', () => {
    const lista = addGuestLine([linea()], linea({technique: 'Bordado'}), AHORA);
    expect(lista).toHaveLength(2);
    expect(lista.map((l) => l.technique)).toEqual(['Serigrafía', 'Bordado']);
  });

  it('abre línea nueva cuando cambia la talla del decorado', () => {
    const lista = addGuestLine([linea({size: '5x5'})], linea({size: '10x10'}), AHORA);
    expect(lista).toHaveLength(2);
  });

  it('deja la lista intacta si la línea no se podía cotizar', () => {
    const previa = [linea()];
    expect(addGuestLine(previa, null, AHORA)).toEqual(previa);
  });

  it('corta en el tope y descarta la más vieja, no la que acaban de agregar', () => {
    let lista = [];
    for (let i = 0; i < MAX_GUEST_LINES; i += 1) {
      lista = addGuestLine(lista, linea({variantId: `gid://v${i}`}), AHORA);
    }
    expect(lista).toHaveLength(MAX_GUEST_LINES);
    lista = addGuestLine(lista, linea({variantId: 'gid://ultima'}), AHORA);
    expect(lista).toHaveLength(MAX_GUEST_LINES);
    expect(lista.at(-1).variantId).toBe('gid://ultima');
    expect(lista.some((l) => l.variantId === 'gid://v0')).toBe(false);
  });
});

/* Lo que hay en localStorage es entrada NO confiable: la escribió una versión
   anterior del sitio, otra pestaña, o el propio usuario desde la consola.
   Ante cualquier duda se empieza en blanco: perder un carrito de invitado es
   barato, reventar la app en el primer render no. */
describe('parseGuestQuote', () => {
  const AHORA = 1_700_000_000_000;
  const sobre = (lineas, savedAt = AHORA) =>
    serializeGuestQuote(lineas, savedAt);
  const linea = (over = {}) =>
    normalizeGuestLine({variantId: 'gid://v1', qty: 10, ...over}, AHORA);

  it('devuelve las líneas que guardó serializeGuestQuote', () => {
    const leidas = parseGuestQuote(sobre([linea()]), AHORA);
    expect(leidas).toHaveLength(1);
    expect(leidas[0].variantId).toBe('gid://v1');
  });

  it('empieza en blanco ante JSON corrupto en vez de reventar', () => {
    expect(parseGuestQuote('{no es json', AHORA)).toEqual([]);
    expect(parseGuestQuote('null', AHORA)).toEqual([]);
    expect(parseGuestQuote(undefined, AHORA)).toEqual([]);
  });

  it('empieza en blanco ante un sobre de otra versión del formato', () => {
    const viejo = JSON.stringify({version: 0, savedAt: AHORA, lines: [linea()]});
    expect(parseGuestQuote(viejo, AHORA)).toEqual([]);
  });

  it('descarta el carrito caducado: sus precios de lista ya no son de fiar', () => {
    const guardado = AHORA - GUEST_TTL_MS - 1;
    expect(parseGuestQuote(sobre([linea()], guardado), AHORA)).toEqual([]);
  });

  it('conserva el carrito justo antes de caducar', () => {
    const guardado = AHORA - GUEST_TTL_MS + 1000;
    expect(parseGuestQuote(sobre([linea()], guardado), AHORA)).toHaveLength(1);
  });

  it('tira las líneas sin variante que se hayan colado y conserva el resto', () => {
    const sucio = JSON.stringify({
      version: 1,
      savedAt: AHORA,
      lines: [linea(), {title: 'basura'}, linea({variantId: 'gid://v2'})],
    });
    const leidas = parseGuestQuote(sucio, AHORA);
    expect(leidas.map((l) => l.variantId)).toEqual(['gid://v1', 'gid://v2']);
  });

  it('recorta al tope aunque el sobre venga con más líneas de las permitidas', () => {
    const muchas = Array.from({length: MAX_GUEST_LINES + 10}, (_, i) =>
      linea({variantId: `gid://v${i}`}),
    );
    expect(parseGuestQuote(sobre(muchas), AHORA)).toHaveLength(MAX_GUEST_LINES);
  });
});

/* Lo que viaja al servidor al migrar. Todo lo de display se queda en el
   navegador: el servidor vuelve a pedirle a Shopify precio, título e imagen,
   así que mandarlos sólo agrandaría el cuerpo y daría la falsa impresión de
   que el cliente puede opinar sobre el precio. */
describe('guestMergePayload', () => {
  const AHORA = 1_700_000_000_000;
  const linea = (over = {}) =>
    normalizeGuestLine(
      {variantId: 'gid://v1', qty: 10, title: 'Taza', image: 'x.jpg', baseUnitPrice: 89.5, ...over},
      AHORA,
    );

  it('manda sólo las cinco claves que el servidor lee', () => {
    expect(guestMergePayload([linea({technique: 'Serigrafía', surface: 'Tela', size: '10x10'})])).toEqual([
      {variantId: 'gid://v1', technique: 'Serigrafía', surface: 'Tela', size: '10x10', qty: 10},
    ]);
  });

  it('no deja pasar el precio que traía el navegador', () => {
    const [enviada] = guestMergePayload([linea()]);
    expect(enviada).not.toHaveProperty('baseUnitPrice');
    expect(enviada).not.toHaveProperty('effectiveUnitPrice');
  });

  it('respeta el tope de líneas aunque le pasen de más', () => {
    const muchas = Array.from({length: MAX_GUEST_LINES + 5}, (_, i) =>
      linea({variantId: `gid://v${i}`}),
    );
    expect(guestMergePayload(muchas)).toHaveLength(MAX_GUEST_LINES);
  });

  it('devuelve lista vacía si no hay nada que migrar', () => {
    expect(guestMergePayload([])).toEqual([]);
    expect(guestMergePayload(null)).toEqual([]);
  });
});

/* El invitado tiene que ver el MISMO precio por pieza que verá al entrar. El
   motor de decorado es cálculo puro (no toca db ni env), así que el navegador
   puede correrlo; el servidor lo vuelve a correr al migrar y su resultado
   manda. Esto es display, no autoridad. */
describe('priceGuestLine', () => {
  const AHORA = 1_700_000_000_000;
  const linea = (over = {}) =>
    normalizeGuestLine({variantId: 'gid://v1', baseUnitPrice: 100, qty: 100, ...over}, AHORA);

  it('sin decorado el precio por pieza es el precio de lista', () => {
    const p = priceGuestLine(linea({technique: 'Sin decorado'}));
    expect(p.decorationTotal).toBe(0);
    expect(p.effectiveUnitPrice).toBe(100);
  });

  it('con decorado sube el precio por pieza y lo reparte entre las piezas', () => {
    const p = priceGuestLine(linea({technique: 'BORDADO', surface: 'TEXTIL', size: '8 x 8'}));
    expect(p.decorationTotal).toBeGreaterThan(0);
    expect(p.effectiveUnitPrice).toBeGreaterThan(100);
    // La cuenta que ve el usuario tiene que cuadrar con el total que le enseñamos.
    expect(p.effectiveUnitPrice).toBeCloseTo(100 + p.decorationTotal / 100, 2);
  });

  it('ante una combinación de decorado imposible cae al precio de lista, sin NaN', () => {
    const p = priceGuestLine(linea({technique: 'BORDADO', surface: 'TEXTIL', size: 'inventada'}));
    expect(Number.isFinite(p.effectiveUnitPrice)).toBe(true);
    expect(p.effectiveUnitPrice).toBe(100);
    expect(p.decorationTotal).toBe(0);
  });

  it('conserva el resto de la línea para que el cajón la siga pintando', () => {
    const p = priceGuestLine(linea({title: 'Playera', technique: 'Sin decorado'}));
    expect(p.title).toBe('Playera');
    expect(p.variantId).toBe('gid://v1');
    expect(p.qty).toBe(100);
  });
});

/* La migración es de un solo tiro: si se borra el localStorage antes de que el
   servidor confirme, un 500 o una red caída se lleva el carrito para siempre.
   Eso es justo lo que hace hoy la migración de favoritos (AppContext.jsx:143)
   y lo que aquí no se repite: sólo se borra contra una respuesta buena. */
describe('guestMergeOutcome', () => {
  it('borra el carrito local sólo cuando el servidor confirmó', () => {
    const r = guestMergeOutcome({ok: true, migradas: 3, descartadas: 0});
    expect(r.clearLocal).toBe(true);
    expect(r.message).toMatch(/3/);
  });

  it('CONSERVA el carrito local si la migración falló', () => {
    expect(guestMergeOutcome(null).clearLocal).toBe(false);
    expect(guestMergeOutcome({error: 'boom'}).clearLocal).toBe(false);
    expect(guestMergeOutcome({ok: false}).clearLocal).toBe(false);
    expect(guestMergeOutcome(undefined).clearLocal).toBe(false);
  });

  it('avisa del fallo en vez de quedarse callado', () => {
    expect(guestMergeOutcome(null).message).toBeTruthy();
    expect(guestMergeOutcome(null).isError).toBe(true);
  });

  it('dice cuántos artículos se quedaron fuera y no los esconde', () => {
    const r = guestMergeOutcome({ok: true, migradas: 2, descartadas: 1});
    expect(r.clearLocal).toBe(true);
    expect(r.message).toMatch(/2/);
    expect(r.message).toMatch(/1/);
  });

  it('no dice nada cuando no había nada que migrar', () => {
    const r = guestMergeOutcome({ok: true, migradas: 0, descartadas: 0});
    expect(r.clearLocal).toBe(true);
    expect(r.message).toBeNull();
  });

  it('usa singular cuando es un solo artículo', () => {
    expect(guestMergeOutcome({ok: true, migradas: 1, descartadas: 0}).message).toMatch(
      /1 artículo /,
    );
  });
});

/* El mensaje lo lee un cliente real: concordar el plural no es cosmético
   cuando el aviso ya trae la mala noticia de que le quitamos algo. */
describe('guestMergeOutcome · concordancia', () => {
  const msg = (migradas, descartadas) =>
    guestMergeOutcome({ok: true, migradas, descartadas}).message;

  it('concuerda en singular con un solo descartado', () => {
    expect(msg(3, 1)).toContain('1 que ya no está disponible');
  });

  it('concuerda en plural con varios descartados', () => {
    expect(msg(3, 2)).toContain('2 que ya no están disponibles');
  });

  it('lo dice bien aunque no se haya migrado nada', () => {
    expect(msg(0, 2)).toContain('2 que ya no están disponibles');
  });
});

/* El código anterior guardaba `gi_quote` como un array pelón (JSON.stringify
   del estado). Ese formato sigue en el navegador de gente que ya visitó el
   sitio, así que leerlo no puede reventar: se empieza en blanco, que además es
   lo correcto —esos carritos nunca llegaron a tener nada. */
describe('parseGuestQuote · formato anterior', () => {
  const AHORA = 1_700_000_000_000;

  it('ignora el array pelón que dejó la versión anterior', () => {
    expect(parseGuestQuote('[]', AHORA)).toEqual([]);
    expect(
      parseGuestQuote('[{"variantId":"gid://v1","qty":10}]', AHORA),
    ).toEqual([]);
  });

  it('tampoco se atraganta con un array anidado raro', () => {
    expect(parseGuestQuote('[[1,2],[3]]', AHORA)).toEqual([]);
  });
});
