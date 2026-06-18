/* ============================================================
   Generando Ideas — shared helpers + catalog config
   ============================================================ */

import {getTechniques} from './decoration/engine.js';

/** Read a `custom.<key>` metafield value from a Storefront metafields array. */
function readMetafield(node, key) {
  const list = node?.metafields || [];
  const mf = list.find((m) => m && m.namespace === 'custom' && m.key === key);
  return mf?.value ?? null;
}

/** Format a money amount in MXN (or given currency). */
export function formatPrice(amount, currency = 'MXN') {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (n == null || Number.isNaN(n)) return '';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Map a Shopify variant option value (Spanish color name) to a hex swatch.
 * Falls back to a neutral stone for unknown names.
 */
const COLOR_HEX = {
  negro: '#14110a',
  blanco: '#fbfaf7',
  gris: '#8a8167',
  plata: '#c7c7c7',
  plateado: '#c7c7c7',
  dorado: '#d99c00',
  oro: '#d99c00',
  amarillo: '#f5b800',
  rojo: '#b3261e',
  vino: '#6e1423',
  rosa: '#e08aa8',
  'rosa mexicano': '#e0218a',
  naranja: '#e5631e',
  azul: '#1e4d8a',
  'azul cielo': '#5a9bd4',
  'azul marino': '#1a2d4a',
  marino: '#1a2d4a',
  turquesa: '#1a9aa0',
  verde: '#3f7d3f',
  'verde militar': '#5d6a3a',
  'verde bandera': '#1f7a4a',
  morado: '#6a3d9a',
  cafe: '#5a3a22',
  café: '#5a3a22',
  beige: '#d8c9a8',
  natural: '#e0d4b8',
  transparente: '#e9e9e9',
  unico: '#a89e85',
  único: '#a89e85',
  multicolor:
    'linear-gradient(135deg,#f5b800,#b3261e,#1e4d8a,#3f7d3f)',
};

export function colorHex(name) {
  if (!name) return '#a89e85';
  const key = String(name).trim().toLowerCase();
  return COLOR_HEX[key] || '#a89e85';
}

/**
 * Extract the minimum order quantity from a product description.
 * Real GI products embed it as "La compra mínima es de N piezas".
 */
export function parseMoq(description = '') {
  const m = String(description).match(
    /compra m[ií]nima[^0-9]*([\d.,]+)\s*(piezas|pz|pzas|unidades)/i,
  );
  if (m) {
    const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/** Build volume price tiers from a unit price (display heuristic). */
export function volumeTiers(unitPrice, moq = 50) {
  const p = typeof unitPrice === 'string' ? parseFloat(unitPrice) : unitPrice;
  if (!p) return [];
  const base = moq || 50;
  return [
    {qty: base, price: p * 1.12},
    {qty: base * 2, price: p * 1.05},
    {qty: base * 5, price: p},
    {qty: base * 10, price: p * 0.92},
  ];
}

/** Print/customization techniques offered (B2B standard). */
export const TECHNIQUES = [
  {id: 'serigrafia', name: 'Serigrafía', cost: 'desde $4/pz'},
  {id: 'laser', name: 'Grabado láser', cost: 'desde $8/pz'},
  {id: 'sublimacion', name: 'Sublimación', cost: 'desde $6/pz'},
];

/**
 * Normalize a Storefront API product node into the shape GI screens use.
 * Tolerant of missing fields so it works against any Shopify store.
 */
export function normalizeProduct(node) {
  if (!node) return null;
  const price = node.priceRange?.minVariantPrice;
  const variants = node.variants?.nodes || node.variants?.edges?.map((e) => e.node) || [];
  const first = node.selectedOrFirstAvailableVariant || variants[0];
  const tags = node.tags || [];
  // Color swatches come from a "Color" option's variant values
  const colorOption = (node.options || []).find((o) =>
    /color/i.test(o.name),
  );
  const colors = colorOption
    ? (colorOption.optionValues || colorOption.values || []).map((v) =>
        typeof v === 'string' ? v : v.name,
      )
    : [...new Set(variants.map((v) => v.title).filter(Boolean))];
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    sku: first?.sku || node.handle?.toUpperCase() || '',
    description: node.description || '',
    image: node.featuredImage?.url || first?.image?.url || null,
    imageAlt: node.featuredImage?.altText || node.title,
    images: (node.images?.nodes || []).map((i) => i.url),
    price: price ? parseFloat(price.amount) : null,
    currency: price?.currencyCode || 'MXN',
    firstVariantId: first?.id || null,
    available: first?.availableForSale ?? true,
    colors: colors.slice(0, 8),
    tags,
    isNew: tags.includes('nuevo'),
    isOffer: tags.includes('oferta'),
    moq: parseMoq(node.description) || 50,
    techniques: getTechniques(readMetafield(node, 'tecnicas_de_impresion')),
    surface: String(readMetafield(node, 'material') ?? ''),
  };
}

/* ---------------------------------------------------------------
   Catalog mapping — which REAL store collections power the
   curated home sections. Handles come from development-gi.
   --------------------------------------------------------------- */

// 8 hero categories shown on the home grid (handle + display label)
export const HOME_CATEGORIES = [
  {handle: 'bebidas', name: 'Bebidas', icon: 'drink'},
  {handle: 'ecologicos', name: 'Ecológicos', icon: 'leaf'},
  {handle: 'hogar', name: 'Hogar', icon: 'home'},
  {handle: 'tecnologia', name: 'Tecnología', icon: 'tech'},
  {handle: 'oficina', name: 'Oficina', icon: 'office'},
  {handle: 'textil', name: 'Textil', icon: 'shirt'},
  {handle: 'mochilas-y-maletas', name: 'Mochilas y maletas', icon: 'bag'},
  {handle: 'salud-y-bienestar', name: 'Bienestar', icon: 'heart'},
];

// Curated "featured collections" row on home + which to spotlight
export const FEATURED_COLLECTIONS = [
  'mundial',
  'nuevos',
  'ofertas',
  'termos',
  'tazas',
  'boligrafos-de-metal',
  'textil',
  'libretas-y-carpetas',
  'tecnologia',
];

/* Editorial lookbook editions — campaign concepts mapped to real
   collection handles. Imagery is editorial/lifestyle (not in Shopify). */
const unsplash = (id, w = 1000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export const LOOKBOOK = [
  {id: 'kit-bienvenida', title: 'Kit Bienvenida 2026', tag: 'RRHH', season: 'Onboarding', collection: 'nuevos', span: 'tall', image: unsplash('1607083206869-4c7672e72a8a')},
  {id: 'eco-office', title: 'Eco Office', tag: 'Sostenible', season: 'Día de la Tierra', collection: 'ecologicos', span: 'wide', image: unsplash('1542601906990-b4d3fb778b09')},
  {id: 'tech-essentials', title: 'Tech Essentials', tag: 'Tecnología', season: 'Q1 Corporativo', collection: 'tecnologia', span: 'normal', image: unsplash('1496181133206-80ce9b88a853')},
  {id: 'cafe-co', title: 'Café & Co.', tag: 'Bebidas', season: 'Edición Invierno', collection: 'tazas', span: 'normal', image: unsplash('1514228742587-6b1558fcca3d')},
  {id: 'uniforme-activo', title: 'Uniforme Activo', tag: 'Textil', season: 'Equipos en campo', collection: 'textil', span: 'wide', image: unsplash('1556905055-8f358a7a47b2')},
  {id: 'mundial-2026', title: 'Mundial 2026', tag: 'Especial', season: 'Activación deportiva', collection: 'mundial', span: 'tall', image: unsplash('1517466787929-bc90951d0974')},
];

export const LIFESTYLE = {
  team: unsplash('1497032628192-86f99bcd76bc', 1600),
  workspace: unsplash('1521737604893-d14cc237f11d', 1600),
  unboxing: unsplash('1607082348824-0a96f2a4b9da', 1200),
  printing: unsplash('1572044162444-ad60f128bdea', 1200),
};

export const REVIEWS = [
  {name: 'Mariana Ruiz', company: 'HR Lead · Banorte', avatar: unsplash('1573496359142-b8d87734a5a2', 200), quote: 'Pedimos 1,200 kits de bienvenida personalizados. Llegaron impecables, justo como los pedimos.'},
  {name: 'Luis Treviño', company: 'Marketing · Heineken', avatar: unsplash('1507003211169-0a1dd7228f2d', 200), quote: 'Cotizar y aprobar arte en una sola plataforma cambió completamente nuestro flujo de campañas.'},
  {name: 'Andrea Solís', company: 'Agencia · Mass', avatar: unsplash('1494790108377-be9c29b29330', 200), quote: 'Trabajamos varias marcas desde un solo dashboard. El soporte responde en menos de 2 horas.'},
];

export const FAQ = [
  {q: '¿Cuánto tarda la producción?', a: 'El tiempo de producción depende de la técnica de personalización y el volumen. Tu asesor te confirma la fecha estimada al cotizar.'},
  {q: '¿Cuál es la cantidad mínima?', a: 'La mayoría de productos parten en 50 unidades. Algunas líneas premium desde 25 piezas.'},
  {q: '¿Puedo solicitar muestras?', a: 'Sí, ofrecemos muestras físicas con costo reembolsable al confirmar la orden.'},
  {q: '¿Manejan facturación electrónica?', a: 'Emitimos CFDI 4.0 inmediatamente al confirmar el pedido o cotización aceptada.'},
];
