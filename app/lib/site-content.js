// Portado de gi-website-final/src/data/site.ts — contenido estático de marketing.
/**
 * Generando Ideas — site data.
 *
 * Ported verbatim from the Claude Design prototype's JSX sources
 * (shared.jsx, extras.jsx). Image URLs come from project/__metas.txt,
 * where the prototype mapped resource ids (img0…img41) to Unsplash URLs.
 */

// ---------------------------------------------------------------------------
// Image resource map (img0 … img41) — exact URLs from the design bundle.
// ---------------------------------------------------------------------------
export const IMAGES = {
  img0: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&q=80',
  img1: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
  img2: 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=600&q=80',
  img3: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80',
  img4: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  img5: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  img6: 'https://images.unsplash.com/photo-1608228088998-57828365d486?w=600&q=80',
  img7: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=600&q=80',
  img8: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80',
  img9: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=600&q=80',
  img10: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80',
  img11: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=500&q=80',
  img12: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&q=80',
  img13: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
  img14: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500&q=80',
  img15: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80',
  img16: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
  img17: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=500&q=80',
  img18: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&q=80',
  img19: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
  img20: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&q=80',
  img21: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
  img22: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&q=80',
  img23: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
  img24: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=600&q=80',
  img25: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=800&q=80',
  img26: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
  img27: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80',
  img28: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80',
  img29: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80',
  img30: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&q=80',
  img31: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80',
  img32: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80',
  img33: 'https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=800&q=80',
  img34: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
  img35: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
  img36: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1400&q=80',
  img37: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1400&q=80',
  img38: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1400&q=80',
  img39: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1400&q=80',
  img40: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80',
  img41: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=80',
};

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------
export const BRAND = {
  name: 'Generando Ideas',
  phone: '(55) 7098 8100',
  email: 'marketing@generandoideas.com',
};

// ---------------------------------------------------------------------------
// Navigation (canonical routes for the Astro multi-page build)
// ---------------------------------------------------------------------------
/**
 * @typedef {object} NavItem
 * @property {string} id
 * @property {string} label
 * @property {string} href
 */

/** @type {NavItem[]} */
export const NAV_ITEMS = [
  {id: 'home', label: 'Inicio', href: '/'},
  {id: 'about', label: 'Conócenos', href: '/conocenos'},
  {id: 'services', label: 'Servicios', href: '/servicios'},
  {id: 'catalog', label: 'Catálogo', href: '/catalogo'},
  {id: 'blog', label: 'Blog', href: '/blog'},
  {id: 'contact', label: 'Contacto', href: '/contacto'},
];

export const ROUTES = {
  home: '/',
  about: '/conocenos',
  services: '/servicios',
  catalog: '/catalogo',
  blog: '/blog',
  contact: '/contacto',
  careers: '/bolsa-de-trabajo',
  privacy: '/legal/aviso-de-privacidad-esi-2026.pdf',
  // Pendiente de subir a public/legal/: hasta entonces el enlace da 404.
  terms: '/legal/terminos-y-condiciones.pdf',
  estore: '/catalogo',
  service: (id) => `/servicios/${id}`,
};

// ---------------------------------------------------------------------------
// Services (summary cards)
// ---------------------------------------------------------------------------
/**
 * @typedef {object} Service
 * @property {string} id
 * @property {string} num
 * @property {string} title
 * @property {string} desc
 * @property {string} tone
 */

/** @type {Service[]} */
export const SERVICES = [
  {id: 'promo', num: '01', title: 'Promocionales', desc: 'Amplio portafolio de productos promocionales diseñados para incrementar la visibilidad de tu marca.', tone: 'hero'},
  {id: 'print-shop', num: '02', title: 'Print Shop', desc: 'Soluciones de decorado de alta calidad para materiales promocionales y corporativos.', tone: 'a'},
  {id: 'promotional-workshop', num: '03', title: 'Promotional Workshop', desc: 'Showrooms interactivos y demostraciones en vivo para vivir la experiencia de tu marca.', tone: 'b'},
  {id: 'digital-evolution', num: '04', title: 'Digital Evolution', desc: 'Desarrollo e integración de APIs para conectar sistemas y optimizar procesos.', tone: 'c'},
  {id: 'importaciones', num: '05', title: 'Importaciones', desc: 'Gestión integral de importaciones para proyectos personalizados y a gran escala.', tone: 'd'},
];

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
/**
 * @typedef {object} Testimonial
 * @property {string} quote
 * @property {string} company
 */

/** @type {Testimonial[]} */
export const TESTIMONIALS = [
  {quote: 'Su atención es excelente y la calidad de sus productos es muy buena. ¡Gracias por siempre sacarnos del apuro!', company: 'Banco Azteca'},
  {quote: 'Excelente servicio por parte de los ejecutivos, muy profesional. Los productos de muy buena calidad cumpliendo con las expectativas.', company: 'Santander'},
  {quote: 'Excelente trabajo en todo lo que hacen, muchas gracias por hacer tan ameno el trabajo con proveedores y excelentes propuestas de los equipos.', company: 'Mercado Pago'},
  {quote: 'Muy agradecida por muchos años creando sinergias.', company: 'Canon'},
  {quote: 'Me encanta el servicio que nos brindan, siempre muy comprometidos y atentos desde el momento uno de la negociación, nos encanta trabajar con ustedes porque sabemos que es seguridad de éxito en nuestros proyectos.', company: 'Vidanta'},
  {quote: 'Sigan haciendo el extraordinario trabajo que han hecho hasta ahora.', company: 'AT&T'},
  {quote: 'Estoy muy satisfecha con los servicios y material recibidos.', company: 'Banjercito'},
  {quote: 'Todo está muy bien en la comunicación y servicio con mi agente, tiempo de entrega perfecto.', company: 'Cruz Roja'},
  {quote: 'Excelente trato por Carlos Marmolejo, calidad en el servicio y eficacia. ¡¡Muchas gracias!!', company: 'Caffenio'},
  {quote: 'Me parece una empresa comprometida con quien no hemos tenido ningún inconveniente en entregas.', company: 'Totalplay'},
  {quote: 'Son una empresa que se preocupa por sus clientes y siempre hacen algo diferente.', company: 'Grupo Salinas'},
  {quote: 'Me encanta la cercanía con Generando Ideas y la cantidad de propuestas que tienen para satisfacer cualquier necesidad del negocio.', company: 'Mercado Pago'},
  {quote: 'Me gusta mucho su forma de trabajar, son muy innovadores, la respuesta de sus asesores excelente.', company: 'Roshfrans'},
];

// ---------------------------------------------------------------------------
// Offices (map + contact)
// ---------------------------------------------------------------------------
/**
 * @typedef {object} Office
 * @property {string} id
 * @property {string} name
 * @property {string} state
 * @property {string} address
 * @property {string} phone
 * @property {number} mx
 * @property {number} my
 */

/** @type {Office[]} */
export const OFFICES = [
  {id: 'cdmx', name: 'CDMX', state: 'Ciudad de México', address: 'Cda. Antonio Maceo 67, Col. Escandón I Secc, Alc. Miguel Hidalgo, CP 11800', phone: '(55) 7098 8100', mx: 605, my: 672},
  {id: 'sonora', name: 'Sonora', state: 'Hermosillo, Sonora', address: 'Blvd. Navarrete 201, Col. Valle Verde', phone: '(662) 789 0012', mx: 210, my: 300},
  {id: 'yucatan', name: 'Yucatán', state: 'Mérida, Yucatán', address: 'Calle 60 Norte 299-E, Col. Residencial', phone: '(999) 456 7890', mx: 920, my: 612},
];

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/generandoideasgi/',
  facebook: 'https://www.facebook.com/generandoideasesi/',
  linkedin: 'https://www.linkedin.com/company/generandoideasesi/',
  whatsapp: 'https://wa.me/message/EJKZVVRVSYWLD1',
};

export const BUSINESS_HOURS = 'Lunes a viernes · 8:30 a 18:00 h';

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------
/**
 * @typedef {object} BlogPost
 * @property {string} id
 * @property {string} cat
 * @property {string} title
 * @property {string} excerpt
 * @property {string} img
 * @property {string} date
 * @property {string} iso
 * @property {string} read
 */

/** @type {BlogPost[]} */
export const BLOG_POSTS = [
  {id: 'tendencias-2026', cat: 'Tendencias', title: '10 artículos promocionales que dominarán 2026', excerpt: 'De los wearables sustentables a los gadgets IoT personalizados. Esto es lo que veremos en el próximo año.', img: IMAGES.img30, date: 'Ene 15, 2026', iso: '2026-01-15', read: '6 min'},
  {id: 'fulfillment-escala', cat: 'Operaciones', title: 'Cómo escalamos fulfillment para 4 ciudades sin contratar un operador más', excerpt: 'Un caso real: operamos 15,000 kits corporativos mensuales con el mismo equipo de 2023.', img: '/fulfillment.jpg', date: 'Ene 8, 2026', iso: '2026-01-08', read: '8 min'},
  {id: 'textiles-sustentables', cat: 'Sustentabilidad', title: 'Textiles sustentables: más allá del algodón orgánico', excerpt: 'rPET, tencel, cáñamo y bambú. Guía práctica para elegir el material correcto según tu marca.', img: IMAGES.img32, date: 'Dic 20, 2025', iso: '2025-12-20', read: '5 min'},
  {id: 'mundial-2026', cat: 'Casos de estudio', title: 'Kits promocionales para el Mundial 2026: qué funciona y qué no', excerpt: 'Colaboramos con marcas locales en activaciones durante el Mundial. Lo que aprendimos.', img: IMAGES.img33, date: 'Dic 10, 2025', iso: '2025-12-10', read: '7 min'},
  {id: 'impresion-tecnicas', cat: 'Técnicas', title: 'Serigrafía vs sublimación vs DTF: cuándo usar cada una', excerpt: 'Las tres técnicas más comunes en textil promocional, comparadas por costo, durabilidad y volumen.', img: IMAGES.img34, date: 'Nov 28, 2025', iso: '2025-11-28', read: '9 min'},
  {id: 'roi-promocionales', cat: 'Estrategia', title: 'El ROI real de los artículos promocionales (con datos)', excerpt: '¿Cuánto retorno genera cada peso invertido en promocionales? Lo medimos con 8 clientes.', img: IMAGES.img35, date: 'Nov 15, 2025', iso: '2025-11-15', read: '6 min'},
];

export const BLOG_CATEGORIES = ['Todos', 'Tendencias', 'Operaciones', 'Sustentabilidad', 'Casos de estudio', 'Técnicas', 'Estrategia'];

// ---------------------------------------------------------------------------
// Service detail content
// ---------------------------------------------------------------------------
/**
 * @typedef {object} ServiceFeature
 * @property {string} t
 * @property {string} d
 */

/**
 * @typedef {object} ServiceDetail
 * @property {string} num
 * @property {string} title
 * @property {string} tagline
 * @property {string} hero
 * @property {string} intro
 * @property {string} color
 * @property {ServiceFeature[]} features
 * @property {string[]} examples
 * @property {string} [seoTitle]
 * @property {string} [seoDescription]
 */

/** @type {Record<string, ServiceDetail>} */
export const SERVICE_DETAILS = {
  promo: {
    num: '01',
    title: 'Promocionales',
    tagline: 'Productos que convierten marcas en experiencias.',
    hero: '/promocionales.jpg',
    intro: 'Ofrecemos un amplio portafolio de artículos promocionales para fortalecer la conexión entre tu marca y tu audiencia. Seleccionamos soluciones innovadoras, funcionales y alineadas con los objetivos de cada campaña.',
    color: 'var(--orange-500)',
    features: [
      {t: 'Amplio catálogo', d: 'Miles de opciones para diferentes industrias y objetivos.'},
      {t: 'Personalización', d: 'Técnicas de decorado adaptadas a cada producto.'},
      {t: 'Asesoría especializada', d: 'Recomendaciones basadas en tu estrategia de marca.'},
      {t: 'Soluciones integrales', d: 'Desde la selección hasta la entrega de los productos.'},
    ],
    examples: ['Tecnología', 'Oficina', 'Bebidas', 'Bolsas y textiles', 'Regalos corporativos'],
    seoTitle: 'Productos Promocionales para Empresas | Generando Ideas',
    seoDescription: 'Artículos promocionales personalizados para campañas, eventos y estrategias de branding que generan impacto.',
  },
  'print-shop': {
    num: '02',
    title: 'Print Shop',
    tagline: 'Decorados que dan vida a tus ideas.',
    hero: '/printshop.jpg',
    intro: 'Convertimos conceptos en materiales impresos de alta calidad. Desde piezas promocionales hasta comunicación corporativa, ofrecemos soluciones de impresión que reflejan la identidad de tu marca con acabados profesionales y atención al detalle.',
    color: 'var(--orange-500)',
    features: [
      {t: 'Decorado comercial', d: 'Producción de materiales para campañas y comunicación corporativa.'},
      {t: 'Acabados especiales', d: 'Opciones que agregan valor y diferenciación a cada proyecto.'},
      {t: 'Personalización', d: 'Adaptamos cada pieza a las necesidades de tu marca.'},
      {t: 'Producción integral', d: 'Acompañamiento desde la preparación hasta la entrega final.'},
    ],
    examples: ['Folletos', 'Packaging', 'Material POP', 'Material corporativo'],
    seoTitle: 'Soluciones de Impresión para Empresas | Generando Ideas',
    seoDescription: 'Impresión comercial, materiales promocionales y acabados especiales para fortalecer la imagen de tu marca.',
  },
  'promotional-workshop': {
    num: '03',
    title: 'Promotional Workshop',
    tagline: 'Experiencias que conectan marcas y personas.',
    hero: '/workshop.jpg',
    intro: 'Transformamos la presentación de productos promocionales en una experiencia interactiva. A través de showrooms, demostraciones en vivo y recorridos especializados, acercamos a tus colaboradores y clientes al universo de posibilidades que tu marca puede crear.',
    color: 'var(--orange-500)',
    features: [
      {t: 'Showrooms personalizados', d: 'Experiencias diseñadas según las necesidades y objetivos de cada cliente.'},
      {t: 'Activaciones en sitio', d: 'Llevamos la experiencia directamente a tus oficinas o eventos corporativos.'},
      {t: 'Personalización en vivo', d: 'Demostraciones con maquinaria de decorado para conocer el proceso en tiempo real.'},
      {t: 'Recorridos especializados', d: 'Visitas guiadas por nuestros talleres para conocer materiales y técnicas.'},
    ],
    examples: ['Showroom corporativo', 'Activaciones internas', 'Eventos para colaboradores', 'Demostraciones de personalización'],
    seoTitle: 'Showrooms y Experiencias de Marca | Generando Ideas',
    seoDescription: 'Creamos showrooms interactivos, activaciones y demostraciones en vivo para acercar tus productos promocionales a clientes y colaboradores.',
  },
  'digital-evolution': {
    num: '04',
    title: 'Digital Evolution',
    tagline: 'Conectamos sistemas, impulsamos resultados.',
    hero: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1400&q=80',
    intro: 'Desarrollamos soluciones tecnológicas mediante API e integraciones que optimizan procesos, automatizan flujos de trabajo y mejoran la comunicación entre plataformas para impulsar la transformación digital de las empresas.',
    color: 'var(--orange-500)',
    features: [
      {t: 'Desarrollo de API', d: 'Soluciones personalizadas para conectar aplicaciones y plataformas.'},
      {t: 'Integraciones', d: 'Unificamos sistemas para optimizar el flujo de información.'},
      {t: 'Automatización', d: 'Reducimos tareas manuales y mejoramos la eficiencia operativa.'},
      {t: 'Escalabilidad', d: 'Soluciones preparadas para crecer junto con tu negocio.'},
    ],
    examples: ['Tiendas personalizadas', 'Consulta de catálogo', 'E-commerce B2B'],
    seoTitle: 'Desarrollo de API e Integraciones | Generando Ideas',
    seoDescription: 'Desarrollamos API e integraciones para automatizar procesos, conectar sistemas y acelerar la transformación digital de tu empresa.',
  },
  importaciones: {
    num: '05',
    title: 'Importaciones',
    tagline: 'Soluciones globales para proyectos únicos.',
    hero: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=1400&q=80',
    intro: 'Gestionamos importaciones de productos personalizados y desarrollos especiales para satisfacer necesidades específicas. Supervisamos cada etapa del proceso para garantizar calidad, cumplimiento y entregas oportunas.',
    color: 'var(--orange-500)',
    features: [
      {t: 'Búsqueda internacional', d: 'Localizamos productos de acuerdo con tus requerimientos.'},
      {t: 'Desarrollo a medida', d: 'Creamos productos exclusivos para tu marca.'},
      {t: 'Gestión logística', d: 'Coordinamos el proceso de importación de principio a fin.'},
      {t: 'Control de calidad', d: 'Verificamos cada detalle antes de la entrega.'},
    ],
    examples: ['Productos exclusivos', 'Kits corporativos', 'Merchandising personalizado', 'Desarrollos especiales', 'Producción internacional'],
    seoTitle: 'Importación de Productos Promocionales | Generando Ideas',
    seoDescription: 'Gestionamos importaciones y desarrollos especiales para ofrecer productos personalizados con alcance global.',
  },
};

export const SERVICE_DETAIL_IDS = Object.keys(SERVICE_DETAILS);

// ---------------------------------------------------------------------------
// Job postings (careers)
// ---------------------------------------------------------------------------
/**
 * @typedef {object} Job
 * @property {number} id
 * @property {string} title
 * @property {string} dept
 * @property {string} location
 * @property {string} type
 * @property {string} salary
 * @property {string[]} offer
 * @property {string[]} requirements
 * @property {string[]} responsibilities
 */

// Datos de contacto de reclutamiento (vacantes).
export const RECRUITMENT = {
  email: 'reclutamiento@generandoideas.com',
  altEmail: 'mfarela@generandoideas.com',
  phone: '56 1013 8387',
};

// Aviso anti-fraude que aparece en todas las vacantes.
export const RECRUITMENT_DISCLAIMER =
  'La participación en cualquiera de nuestros procesos de selección de talento no tiene ningún costo, por lo que queda prohibido que cualquiera de nuestros colaboradores del área de reclutamiento solicite algún tipo de remuneración a los candidatos.';

/* Vacantes activas. Fuente: los .docx de `vacantes/` en la raíz del repo
   (actualizados el 2026-08-04). Los documentos traen tres bloques —"Necesitas",
   "Actividades a realizar" y "Ofrecemos"— que se mapean a requirements,
   responsibilities y offer.

   En "Ofrecemos", el documento anida las prestaciones bajo un encabezado
   ("A partir de los 2 meses:") con sus propias viñetas. Aquí se funden en una
   sola línea porque la ficha las pinta como lista plana y las sub-viñetas
   sueltas se leerían sin contexto. */
/** @type {Job[]} */
export const JOBS = [
  {
    id: 8,
    title: 'Ejecutivo de Ventas',
    dept: 'Ventas',
    // El documento se llama "Ejecutivo de Cuenta.docx", pero el puesto se
    // titula "Ejecutivo de Ventas" dentro del texto; se publica este último.
    location: 'CDMX · Escandón o Álamos',
    type: 'Tiempo completo',
    salary: '$15,000 – $20,000 / mes (base + comisiones)',
    offer: [
      'Sueldo mensual aproximado de 15 a 20 mil pesos (sueldo base + comisiones sin tope)',
      'Prestaciones de ley desde el primer día',
      'A partir de los 3 meses: $1,000 mensuales en vales de despensa, $1,000 mensuales en fondo de ahorro y check-up médico anual',
      'Servicio de comedor subsidiado',
      'Horario: lunes a viernes de 8:30 a.m. a 6:00 p.m.',
      'Dos sedes de trabajo (Colonia Escandón / Colonia Álamos)',
    ],
    requirements: [
      'Escolaridad: mínimo bachillerato concluido',
      'Experiencia: 1 a 2 años en puesto similar (indispensable)',
      'Manejo de Excel y ERP',
      'Excelente actitud de servicio y trato con clientes (gerentes, directores)',
      'Dinamismo, proactividad y facilidad de palabra (oral y escrita)',
    ],
    responsibilities: [
      'Realizar y enviar cotizaciones a clientes',
      'Seguimiento de pedidos para su entrega en tiempo y forma',
      'Elaboración de reportes de ventas',
      'Realizar activación de pedidos en ERP',
      'Negociaciones internas y con clientes',
    ],
  },
  {
    id: 9,
    title: 'Ejecutivo de Ventas Jr.',
    dept: 'Ventas',
    location: 'CDMX · Escandón o Álamos',
    type: 'Tiempo completo',
    salary: '$13,833 / mes + bonos',
    offer: [
      'Sueldo mensual $13,833 más bonos por cumplimiento de metas',
      'Prestaciones de ley desde el primer día',
      'A partir de los 3 meses: $1,000 mensuales en vales de despensa, $1,000 mensuales en fondo de ahorro y check-up médico anual',
      'Servicio de comedor subsidiado',
      'Horario: lunes a viernes de 8:30 a.m. a 6:00 p.m.',
      'Dos sedes de trabajo (Colonia Escandón / Colonia Álamos)',
    ],
    requirements: [
      'Escolaridad: licenciatura trunca, en curso o concluida en Mercadotecnia, Relaciones Comerciales, Administración o afín',
      'Experiencia mínima de 6 meses',
      'Manejo de Excel y ERP (deseable)',
      'Excelente actitud de servicio y trato con clientes',
      'Excelente organización',
      'Dinamismo, proactividad y facilidad de palabra (oral y escrita)',
    ],
    responsibilities: [
      'Realizar y enviar cotizaciones a clientes',
      'Preparar propuestas comerciales y presentaciones para clientes',
      'Capturar y actualizar información de clientes en el ERP',
      'Dar seguimiento a órdenes de compra recibidas',
      'Verificar disponibilidad de inventarios y muestras',
      'Dar seguimiento a dudas sobre entregas, facturación o estatus de órdenes',
      'Apoyo a realización de maquilas',
      'Servir como enlace entre ventas, compras, operaciones y finanzas',
      'Programación de rutas de entrega y seguimiento de su cumplimiento',
    ],
  },
  {
    id: 7,
    title: 'Chófer de Reparto',
    dept: 'Logística',
    location: 'CDMX · Colonia Álamos',
    type: 'Tiempo completo',
    salary: '$13,264.44 / mes',
    offer: [
      'Sueldo mensual $13,264.44',
      'Prestaciones de ley a partir del primer día',
      'Servicio de comedor subsidiado al 50% desde el primer día',
      'A partir de los 3 meses: $1,000 mensuales en vales de despensa, $1,000 mensuales en fondo de ahorro y check-up médico anual',
      'Horario: lunes a viernes de 8:30 a.m. a 6:00 p.m.',
      'Zona para laborar: Colonia Álamos',
    ],
    requirements: [
      'Escolaridad: bachillerato concluido',
      'Experiencia: 2 años en puesto similar (comprobable)',
      'Conocimiento del reglamento de tránsito',
      'Conocimiento de la CDMX y zona metropolitana',
      'Uso de apps de tránsito y GPS en tiempo real (Waze y Google Maps)',
      'Contar con licencia vigente tipo B (indispensable)',
    ],
    responsibilities: [
      'Entrega y/o recolecciones de materiales con clientes y/o proveedores',
      'Carga y descarga de las unidades y manejo adecuado de los materiales',
      'Reportar mercancía al área de recibo con su documentación para su entrada o salida en sistema',
      'Apoyo al área de almacén y recibo',
      'Llevar a cabo el mantenimiento rutinario de las unidades',
    ],
  },
  {
    id: 6,
    title: 'Auxiliar de Reparto',
    dept: 'Logística',
    location: 'CDMX · Colonia Álamos',
    type: 'Tiempo completo',
    salary: '$9,582.47 / mes',
    offer: [
      'Sueldo mensual $9,582.47',
      'Prestaciones de ley a partir del primer día',
      'Servicio de comedor subsidiado al 50%',
      'A partir de los 2 meses: $1,000 mensuales en vales de despensa, $1,000 mensuales en fondo de ahorro y check-up médico',
      'Horario: lunes a viernes de 8:30 a.m. a 6:00 p.m.',
      'Zona para laborar: Colonia Álamos',
    ],
    requirements: [
      'Escolaridad: bachillerato concluido',
      'Experiencia: 1 año mínimo en reparto de paquetería (indispensable)',
      'Manejo de aplicaciones GPS como Google Maps o Waze',
      'Conocimiento amplio de la Ciudad de México y del reglamento de tránsito',
      'Contar con licencia de conducir vigente (indispensable)',
      'Saber conducir (deseable)',
    ],
    responsibilities: [
      'Carga y descarga de las unidades',
      'Entrega y recolección de mercancía en diferentes puntos de la CDMX',
      'Revisión de mercancía',
      'Entrega de reporte de incidencias',
      'Mantener las unidades de reparto en óptimas condiciones de limpieza',
    ],
  },
  {
    id: 5,
    title: 'Auxiliar de Almacén',
    dept: 'Almacén',
    location: 'CDMX · Colonia Álamos',
    type: 'Tiempo completo',
    salary: '$9,582.47 / mes',
    offer: [
      'Sueldo mensual $9,582.47',
      'Prestaciones de ley (a partir del primer día)',
      'Servicio de comedor subsidiado al 50%',
      'A partir de los 2 meses: $1,000 mensuales en vales de despensa, $1,000 mensuales en fondo de ahorro y check-up médico anual',
      'Horario: lunes a viernes de 8:30 a.m. a 6:00 p.m.',
      'Zona para laborar: Colonia Álamos',
    ],
    requirements: [
      'Escolaridad: bachillerato concluido',
      'Experiencia de 6 meses a 1 año en puesto similar',
      'Manejo básico de computadora',
      'Excelente organización y atención al detalle',
      'Responsable y puntual',
    ],
    responsibilities: [
      'Empaque y maquila de materiales',
      'Levantamiento de inventarios',
      'Realizar etiquetado de identificación para materiales',
      'Carga y descarga de mercancía',
      'Mantener el orden y limpieza dentro del almacén',
    ],
  },
];

// Ticker words (home)
export const TICKER_WORDS = ['Promotional Workshop', 'Print Shop', 'Digital Evolution', 'Promocionales', 'Importaciones'];
