/* ============================================================
   Generando Ideas — Mock catalog data
   ============================================================ */

const CATEGORIES = [
  { id: "drinkware", name: "Bebibles", count: 142, icon: "drink" },
  { id: "eco", name: "Ecológicos", count: 86, icon: "leaf" },
  { id: "home", name: "Hogar", count: 113, icon: "home" },
  { id: "tech", name: "Tecnología", count: 91, icon: "tech" },
  { id: "office", name: "Oficina", count: 168, icon: "office" },
  { id: "textil", name: "Textil", count: 224, icon: "shirt" },
  { id: "bags", name: "Mochilas y bolsas", count: 73, icon: "bag" },
  { id: "wellness", name: "Bienestar", count: 41, icon: "heart" },
];

const COLLECTIONS = [
  { id: "maxema", name: "Maxema", subtitle: "Bolígrafos y escritura premium", count: 38, tint: "ph-tinted-amber" },
  { id: "collection-brands", name: "Collection Brands", subtitle: "Marcas curadas internacionales", count: 64, tint: "ph-tinted-ink" },
  { id: "mundial-2026", name: "Mundial 2026", subtitle: "Edición especial deportiva", count: 22, tint: "ph-tinted-sage" },
  { id: "gray", name: "Gray", subtitle: "Línea neutra y elegante", count: 47, tint: "ph-tinted-stone" },
  { id: "blue", name: "Blue", subtitle: "Línea corporativa azul", count: 51, tint: "ph-tinted-sky" },
  { id: "green", name: "Green", subtitle: "100% ecológicos", count: 39, tint: "ph-tinted-mint" },
  { id: "black", name: "Black", subtitle: "Línea premium minimalista", count: 33, tint: "ph-tinted-ink" },
  { id: "agendas", name: "Agendas 2026", subtitle: "Planeación profesional", count: 28, tint: "ph-tinted-clay" },
  { id: "textiles", name: "Textiles", subtitle: "Fabricación nacional", count: 156, tint: "ph-tinted-rose" },
];

const COLORS = [
  { id: "ink", name: "Negro", hex: "#14110a" },
  { id: "stone", name: "Piedra", hex: "#a89e85" },
  { id: "white", name: "Blanco", hex: "#fbfaf7" },
  { id: "amber", name: "Ámbar", hex: "#f5b800" },
  { id: "blue", name: "Azul cobalto", hex: "#1e4d8a" },
  { id: "green", name: "Verde olivo", hex: "#5d6a3a" },
  { id: "red", name: "Rojo", hex: "#b3261e" },
  { id: "navy", name: "Marino", hex: "#1a2d4a" },
];

const TINTS = ["ph-tinted-amber", "ph-tinted-sage", "ph-tinted-stone", "ph-tinted-clay", "ph-tinted-mint", "ph-tinted-sky", "ph-tinted-rose", "ph-tinted-ink"];

// Helper to build Unsplash image URL with size
const unsplash = (id, w = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

function makeProduct(idx, name, category, collection, price, opts = {}) {
  return {
    id: `GI-${String(2000 + idx).padStart(4, "0")}`,
    name,
    category,
    collection,
    price,
    priceFrom: opts.priceFrom ?? true,
    minQty: opts.minQty ?? 50,
    moq: opts.moq ?? 50,
    badge: opts.badge,
    tint: opts.tint ?? TINTS[idx % TINTS.length],
    image: opts.image ? unsplash(opts.image) : null,
    images: opts.images ? opts.images.map(id => unsplash(id, 1200)) : null,
    colors: opts.colors ?? ["ink", "stone", "white", "amber"],
    rating: 4 + (idx % 10) / 10,
    reviews: 18 + ((idx * 7) % 80),
    quoteOnly: opts.quoteOnly ?? false,
    new: opts.new ?? (idx % 11 === 0),
    bestseller: opts.bestseller ?? (idx % 7 === 0),
    desc:
      opts.desc ??
      "Producto promocional de alta calidad con personalización a una o varias tintas. Ideal para campañas corporativas, eventos, kits de bienvenida y obsequios institucionales.",
    materials: opts.materials ?? "Acero inoxidable, plástico ABS reciclado",
    techniques: opts.techniques ?? ["Serigrafía", "Grabado láser", "Sublimación"],
    deliveryDays: opts.deliveryDays ?? "10–15 días hábiles",
    tiers: opts.tiers ?? [
      { qty: 50, price: price * 1.15 },
      { qty: 100, price: price * 1.05 },
      { qty: 250, price: price * 1.0 },
      { qty: 500, price: price * 0.9 },
    ],
  };
}

const PRODUCTS = [
  makeProduct(1, "Termo Aurum Doble Pared 500ml", "drinkware", "black", 189, { tint: "ph-tinted-ink", bestseller: true, image: "1523362628745-0c100150b504", images: ["1523362628745-0c100150b504","1602143407151-7111542de6e8","1517677208171-0bc6725a3e60","1571167530149-c1105da0acff","1542556398-95fb5b9bdc73"] }),
  makeProduct(2, "Taza Cerámica Mate Slim", "drinkware", "gray", 79, { tint: "ph-tinted-stone", image: "1572119865084-43c285814d63", images: ["1572119865084-43c285814d63","1514228742587-6b1558fcca3d","1556228720-195a672e8a03","1577937927133-66ef06acdf18","1517663154410-39e8c79c4d23"] }),
  makeProduct(3, "Vaso Térmico Reusable 350ml", "eco", "green", 145, { tint: "ph-tinted-mint", image: "1592194996308-7b43878e84a6" }),
  makeProduct(4, "Botella Acero Recoge-Tapa", "drinkware", "blue", 215, { tint: "ph-tinted-sky", new: true, image: "1602143407151-7111542de6e8" }),
  makeProduct(5, "Bolígrafo Maxema Tecno", "office", "maxema", 32, { tint: "ph-tinted-amber", priceFrom: true, image: "1602810318383-e386cc2a3ccf" }),
  makeProduct(6, "Cuaderno Tapa Dura A5", "office", "agendas", 110, { tint: "ph-tinted-clay", image: "1531346878377-a5be20888e57" }),
  makeProduct(7, "Agenda 2026 Anual Costura", "office", "agendas", 280, { tint: "ph-tinted-clay", bestseller: true, image: "1455390582262-044cdead277a", images: ["1455390582262-044cdead277a","1517842645767-c639042777db","1531346878377-a5be20888e57","1506784983877-45594efa4cbe","1568667256549-094345857637"] }),
  makeProduct(8, "Mochila Urbana Resistente", "bags", "black", 590, { tint: "ph-tinted-ink", image: "1553062407-98eeb64c6a62" }),
  makeProduct(9, "Bolsa Cambray Reciclada", "eco", "green", 78, { tint: "ph-tinted-mint", image: "1597481499750-3e6b22637e12" }),
  makeProduct(10, "Power Bank 10000 mAh USB-C", "tech", "blue", 420, { tint: "ph-tinted-sky", bestseller: true, image: "1609091839311-d5365f9ff1c5" }),
  makeProduct(11, "Audífonos Bluetooth Pro", "tech", "black", 680, { tint: "ph-tinted-ink", new: true, image: "1505740420928-5e560c06d30e", images: ["1505740420928-5e560c06d30e","1572536147248-ac59a8abfa4b","1583394838336-acd977736f90","1546435770-a3e426bf472b","1484704849700-f032a568e944"] }),
  makeProduct(12, "Memoria USB-C 32GB Aluminio", "tech", "gray", 195, { tint: "ph-tinted-stone", image: "1618410320928-25228d811631" }),
  makeProduct(13, "Playera Cuello Redondo 180g", "textil", "textiles", 145, { tint: "ph-tinted-rose", image: "1521572163474-6864f9cf17ab" }),
  makeProduct(14, "Polo Performance Antibacterial", "textil", "textiles", 285, { tint: "ph-tinted-stone", bestseller: true, image: "1583743814966-8936f5b7be1a" }),
  makeProduct(15, "Chamarra Softshell Bordable", "textil", "textiles", 720, { tint: "ph-tinted-ink", image: "1591047139829-d91aecb6caea" }),
  makeProduct(16, "Gorra Snapback Algodón", "textil", "textiles", 165, { tint: "ph-tinted-rose", image: "1588850561407-ed78c282e89b" }),
  makeProduct(17, "Set Escritorio Bambú", "home", "green", 380, { tint: "ph-tinted-clay", new: true, image: "1593062096033-9a26b09da705" }),
  makeProduct(18, "Aroma Difusor Maderas", "home", "gray", 245, { tint: "ph-tinted-stone", image: "1602928298849-325cec8771c0" }),
  makeProduct(19, "Kit Yoga Mat + Cuerda", "wellness", "green", 320, { tint: "ph-tinted-mint", image: "1601925260368-ae2f83cf8b7f" }),
  makeProduct(20, "Hielera Plegable 24L", "drinkware", "blue", 445, { tint: "ph-tinted-sky", image: "1542838132-92c53300491e" }),
  makeProduct(21, "Pluma Metálica Premium Estuche", "office", "maxema", 95, { tint: "ph-tinted-amber", bestseller: true, image: "1497005367839-6e852de72767" }),
  makeProduct(22, "Bocina Bluetooth Compacta", "tech", "black", 540, { tint: "ph-tinted-ink", image: "1608043152269-423dbba4e7e1" }),
  makeProduct(23, "Set Picnic 4 piezas", "home", "green", 285, { tint: "ph-tinted-mint", image: "1559564484-0e8a86635dd9" }),
  makeProduct(24, "Sudadera Hoodie Felpa Francesa", "textil", "textiles", 425, { tint: "ph-tinted-ink", new: true, image: "1556821840-3a63f95609a7" }),
];

const COLLECTION_IMAGES = {
  "maxema": "1602810318383-e386cc2a3ccf",
  "collection-brands": "1556905055-8f358a7a47b2",
  "mundial-2026": "1517466787929-bc90951d0974",
  "gray": "1532453288672-3a27e9be9efd",
  "blue": "1547949003-9792a18a2601",
  "green": "1542838132-92c53300491e",
  "black": "1523362628745-0c100150b504",
  "agendas": "1455390582262-044cdead277a",
  "textiles": "1521572163474-6864f9cf17ab",
};

const CATEGORY_IMAGES = {
  "drinkware": "1572119865084-43c285814d63",
  "eco": "1597481499750-3e6b22637e12",
  "home": "1593062096033-9a26b09da705",
  "tech": "1505740420928-5e560c06d30e",
  "office": "1531346878377-a5be20888e57",
  "textil": "1521572163474-6864f9cf17ab",
  "bags": "1553062407-98eeb64c6a62",
  "wellness": "1601925260368-ae2f83cf8b7f",
};

// Attach images to collections + categories
COLLECTIONS.forEach((c) => { c.image = unsplash(COLLECTION_IMAGES[c.id], 1200); });
CATEGORIES.forEach((c) => { c.image = unsplash(CATEGORY_IMAGES[c.id], 800); });

// Customer avatars
const AVATARS = {
  "mariana": unsplash("1573496359142-b8d87734a5a2", 200),
  "luis": unsplash("1507003211169-0a1dd7228f2d", 200),
  "andrea": unsplash("1494790108377-be9c29b29330", 200),
};

// Hero collage images
const HERO_IMAGES = [
  unsplash("1523362628745-0c100150b504", 600),  // termo
  unsplash("1572119865084-43c285814d63", 600),  // taza
  unsplash("1505740420928-5e560c06d30e", 600),  // headphones
  unsplash("1521572163474-6864f9cf17ab", 600),  // shirts
  unsplash("1531346878377-a5be20888e57", 600),  // notebook
  unsplash("1597481499750-3e6b22637e12", 600),  // tote
  unsplash("1553062407-98eeb64c6a62", 600),     // backpack
  unsplash("1602810318383-e386cc2a3ccf", 600),  // pens
];

// Lifestyle images for hero / sections
const LIFESTYLE = {
  team: unsplash("1497032628192-86f99bcd76bc", 1600),
  workspace: unsplash("1521737604893-d14cc237f11d", 1600),
  unboxing: unsplash("1607082348824-0a96f2a4b9da", 1200),
  printing: unsplash("1572044162444-ad60f128bdea", 1200),
  warehouse: unsplash("1586528116311-ad8dd3c8310d", 1200),
};

// Lookbook — editorial campaign imagery
const LOOKBOOK = [
  { id: "lb1", title: "Kit Bienvenida 2026", tag: "RRHH", season: "Onboarding", image: unsplash("1607083206869-4c7672e72a8a", 1000), span: "tall", products: 6 },
  { id: "lb2", title: "Eco Office", tag: "Sostenible", season: "Día de la Tierra", image: unsplash("1542601906990-b4d3fb778b09", 1000), span: "wide", products: 9 },
  { id: "lb3", title: "Tech Essentials", tag: "Tecnología", season: "Q1 Corporativo", image: unsplash("1496181133206-80ce9b88a853", 1000), span: "normal", products: 7 },
  { id: "lb4", title: "Café & Co.", tag: "Bebibles", season: "Edición Invierno", image: unsplash("1514228742587-6b1558fcca3d", 1000), span: "normal", products: 5 },
  { id: "lb5", title: "Uniforme Activo", tag: "Textil", season: "Equipos en campo", image: unsplash("1556905055-8f358a7a47b2", 1000), span: "wide", products: 12 },
  { id: "lb6", title: "Mundial 2026", tag: "Especial", season: "Activación deportiva", image: unsplash("1517466787929-bc90951d0974", 1000), span: "tall", products: 8 },
];

const REVIEWS = [
  { name: "Mariana Ruiz", company: "HR Lead · Banorte", quote: "Pedimos 1,200 kits de bienvenida personalizados. Llegaron en 11 días, impecables." },
  { name: "Luis Treviño", company: "Marketing · Heineken", quote: "Cotizar y aprobar arte en una sola plataforma cambió completamente nuestro flujo de campañas." },
  { name: "Andrea Solís", company: "Agencia · Mass" , quote: "Trabajamos varias marcas desde un solo dashboard. El soporte responde en menos de 2 horas." },
];
REVIEWS[0].avatar = AVATARS.mariana;
REVIEWS[1].avatar = AVATARS.luis;
REVIEWS[2].avatar = AVATARS.andrea;

const FAQ = [
  { q: "¿Cuánto tarda la producción?", a: "Entre 8 y 15 días hábiles dependiendo de la técnica de personalización y volumen." },
  { q: "¿Cuál es la cantidad mínima?", a: "La mayoría de productos parten en 50 unidades. Algunas líneas premium desde 25 piezas." },
  { q: "¿Puedo solicitar muestras?", a: "Sí, ofrecemos muestras físicas con costo reembolsable al confirmar la orden." },
  { q: "¿Manejan facturación electrónica?", a: "Emitimos CFDI 4.0 inmediatamente al confirmar el pedido o cotización aceptada." },
];

window.GI_DATA = { CATEGORIES, COLLECTIONS, COLORS, PRODUCTS, REVIEWS, FAQ, HERO_IMAGES, LIFESTYLE, AVATARS, LOOKBOOK };
window.GI_UNSPLASH = unsplash;

/* ============================================================
   Currency + helpers
   ============================================================ */
window.GI_FORMAT_PRICE = (n) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

window.GI_SLUG = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
