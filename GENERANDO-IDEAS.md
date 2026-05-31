# Generando Ideas — Headless Commerce (Remix + Shopify Hydrogen)

B2B promotional-products storefront for **Generando Ideas**, implemented from the
Claude Design handoff bundle. Built on **Shopify Hydrogen** (which runs on Remix /
React Router 7) so the cart, sessions, checkout and Storefront API come for free.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (uses mock.shop by default)
```

By default it boots against Shopify's **mock.shop** demo data (no credentials
needed). To serve the **real `development-gi` catalog**, follow the instructions in
`.env` (`npx shopify hydrogen link` is the easiest path). Nothing else changes —
every screen reads live data from the Storefront API, so "demo → real" is purely a
configuration swap.

## Design system

The prototype's CSS was ported verbatim and is the single source of truth for the
look (amber `#f5b800` accent, Bricolage Grotesque / Manrope / JetBrains Mono, warm
off-white light mode):

- `app/styles/gi-tokens.css` — tokens, buttons, tags, header/footer, base
- `app/styles/gi-screens.css` — home, auth, catalog, product, cart, account
- `app/styles/gi-sections.css` — spotlight, lookbook, stats band, customizer

Fonts + stylesheets are wired in `app/root.jsx`.

## Screens (routes)

| Screen | Route | Data |
|---|---|---|
| Home | `/` (`_index.jsx`) | real collections + best-selling products |
| Catálogo | `/catalogo` | products w/ category, search & sort filters |
| Colecciones | `/collections` | all store collections |
| Colección | `/collections/:handle` | collection products |
| Producto | `/products/:handle` | variants→swatches, volume tiers, customizer |
| Carrito | `/cart` | Hydrogen cart → Shopify checkout (buyers) |
| Cotización | `/cotizacion` | client-side quote list + request form |
| Login / Registro | `/login`, `/registro` | hand off to Shopify Customer Accounts |
| Mi cuenta | `/account/*` | Customer Account API (orders/profile/addresses) |
| Lookbook | `/lookbook` | editorial editions linked to real collections |
| Servicios / Nosotros / Contacto | `/servicios` `/nosotros` `/contacto` | static |

## B2B model

- **Roles** (`app/lib/AppContext.jsx`): `buyer` can add to the Shopify **cart** and
  check out; `quoter` builds a **quote list** (`/cotizacion`) and submits it as a
  request. The role is persisted in `localStorage` and switchable live via the
  black role banner / the floating Tweaks panel (accent color + density too).
- **Auth-gated pricing**: the catalog is fully browsable, but prices, cart and quote
  actions require login (Shopify Customer Accounts).
- **Quote list** is client-side today (localStorage). To persist it server-side,
  wire `addToQuote` to a Shopify **draft order** or a customer metafield.

## Mapping demo data → real catalog

The demo's invented collections/categories were replaced by the real tag-based
collections in `app/lib/gi.js`:

- `HOME_CATEGORIES` — the 8 hero category cards (Bebidas, Ecológicos, Hogar,
  Tecnología, Oficina, Textil, Mochilas y maletas, Salud y bienestar).
- `FEATURED_COLLECTIONS` — the curated "featured collections" row + catalog chips
  (Mundial, Nuevos, Ofertas, Termos, Tazas, …).
- `LOOKBOOK` — editorial editions, each pointing at a real collection handle.
- Product fields are normalized in `normalizeProduct()`:
  - **SKU / colors** ← first variant SKU + the "Color" option values
    (Spanish color names mapped to hex swatches in `colorHex`).
  - **MOQ** ← parsed from the description text ("compra mínima de N piezas")
    via `parseMoq`, falling back to 50.
  - **Volume tiers / techniques** ← `volumeTiers()` / `TECHNIQUES` (display
    heuristics). For exact B2B pricing, replace these with Shopify
    **metafields** on the product and read them in the product fragment.

Lifestyle/editorial photography (hero collage backgrounds, testimonials, lookbook,
"how it works") uses Unsplash — these are brand imagery, not catalog data. Swap them
for owned assets in `app/lib/gi.js` (`LIFESTYLE`, `REVIEWS`, `LOOKBOOK`).

## Notes / next steps

- Account sub-pages (orders/profile/addresses) use the Hydrogen Customer Account
  components inside the GI-styled shell; they only work once Customer Accounts is
  configured on the linked store.
- Favorites are client-side IDs; `/account/favoritos` can be upgraded to fetch the
  saved products via the Storefront `nodes(ids:)` query.
- Original prototype + chat transcript are kept under `design_download/` for
  reference and can be deleted once you're happy with the rebuild.
