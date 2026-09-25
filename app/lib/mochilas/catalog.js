// Catálogo de la campaña interna de mochilas. Cada línea se elige por tag en
// Shopify; la búsqueda de Storefront no es del todo estricta con los tags (ver
// lib/filters.js), así que además se filtra aquí. Sumar una línea a la campaña
// es agregarla a LINES.
export const LINES = [
  {id: 'takayama', name: 'Takayama', tag: 'mochila-takayama'},
  {id: 'wagner', name: 'Wagner', tag: 'mochila-wagner'},
];

export const CATALOG_SEARCH = LINES.map((l) => `tag:${l.tag}`).join(' OR ');

export const CATALOG_QUERY = `#graphql
  query CampanaMochilas(
    $query: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: 100, query: $query) {
      nodes {
        id
        handle
        title
        description
        tags
        featuredImage { url altText }
        variants(first: 20) {
          nodes { id title availableForSale image { url altText } }
        }
      }
    }
  }
`;

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|[\s/])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** ("MOCHILA WAGNER ARMOR MAX MOC-ARX", "Wagner") → "Armor Max" */
export function modelName(title, lineName) {
  const prefix = new RegExp(`^mochila\\s+${lineName}\\s+`, 'i');
  const core = String(title ?? '')
    .trim()
    .replace(prefix, '')
    .replace(/\s+moc-[a-z0-9]+$/i, '');
  return titleCase(core);
}

/** "NEGRO/GRIS" → "Negro / Gris" */
export function colorName(variantTitle) {
  return String(variantTitle ?? '')
    .split('/')
    .map((p) => titleCase(p.trim()))
    .filter(Boolean)
    .join(' / ');
}

/**
 * Las descripciones vienen de HTML aplanado: "aguaFabricada". Donde una
 * minúscula toca una mayúscula se separan como dos oraciones.
 */
export function tidyDescription(text) {
  return String(text ?? '').replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1. $2');
}

function lineForTags(tags) {
  return LINES.find((l) => (tags ?? []).includes(l.tag)) ?? null;
}

export function normalizeCatalog(nodes) {
  const byLine = new Map(LINES.map((l) => [l.id, []]));

  for (const p of nodes ?? []) {
    const line = lineForTags(p.tags);
    if (!line) continue;

    const fallback = p.featuredImage ?? null;
    const variants = (p.variants?.nodes ?? [])
      .filter((v) => v.availableForSale)
      .map((v) => {
        const image = v.image ?? fallback;
        return {
          id: v.id,
          color: colorName(v.title),
          image: image?.url ?? null,
          imageAlt: image?.altText ?? null,
        };
      });
    if (variants.length === 0) continue;

    byLine.get(line.id).push({
      id: p.id,
      handle: p.handle,
      name: modelName(p.title, line.name),
      description: tidyDescription(p.description),
      variants,
    });
  }

  return LINES.map((l) => ({
    id: l.id,
    name: l.name,
    products: byLine.get(l.id).sort((a, b) => a.name.localeCompare(b.name, 'es')),
  })).filter((l) => l.products.length > 0);
}

export function findVariant(lines, variantId) {
  for (const line of lines) {
    for (const product of line.products) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) return {line, product, variant};
    }
  }
  return null;
}

export async function fetchCatalog(storefront) {
  const {products} = await storefront.query(CATALOG_QUERY, {
    variables: {query: CATALOG_SEARCH},
    cache: storefront.CacheShort(),
  });
  return normalizeCatalog(products?.nodes);
}
