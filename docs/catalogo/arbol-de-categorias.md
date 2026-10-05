# Árbol de categorías — etiquetas por categoría

Aprobado el 2026-10-05. Fuente única: `app/lib/category-tree.js`.
Cada categoría es una **colección automática** de Shopify que incluye un producto
si tiene **cualquiera** de sus etiquetas. Las colecciones ya están creadas y
publicadas (Online Store y API GI).

## Qué tiene que hacer la sincronización con proveedores

Por cada producto, asignar:

1. **Nivel 1 y nivel 2** — las etiquetas que ya asigna hoy (`bebidas` + `termos`, `oficina` + `libretas y carpetas`…). Sin cambios.
2. **Nivel 3 (nuevo)** — **una** etiqueta de tipo, calculada así: dentro de la
   subcategoría del producto, recorrer los tipos **en el orden de la tabla** y
   asignar la etiqueta del **primero** que coincida.
   - *Regla de título*: el título en MAYÚSCULAS y sin acentos contiene alguna de
     las palabras (expresión regular; `\b` = palabra completa).
   - *Desde etiqueta*: el producto ya trae esa etiqueta del proveedor; no se
     agrega nada.
   - Si ningún tipo coincide, el producto no lleva etiqueta de tipo: aparece en
     la subcategoría ("Ver todo") y no en un tipo.
   - La función `typeTagFor()` de `app/lib/category-tree.js` implementa
     exactamente esta regla, por si el script puede reutilizarla.

Las etiquetas van en minúsculas y sin acentos, como las actuales.

### Ajustes recomendados a la sincronización (opcionales)

- Productos de **belleza** y **salud y bienestar**: hoy también llevan `hogar`,
  así que aparecen en "Hogar → Ver todo". En el árbol aprobado viven en
  "Salud y belleza". Para separarlos, dejar de asignarles `hogar`.
- Productos de **niños** (`ninos`): hoy llevan `hogar`; en el árbol viven en
  Oficina → Escolares y niños. Para que salgan en "Oficina → Ver todo",
  asignarles `oficina` en lugar de `hogar`.
- **Ojo:** si la sincronización reemplaza todas las etiquetas del producto en cada
  corrida, las etiquetas de tipo tienen que salir de la sincronización; si se
  agregaran a mano, se borrarían en la siguiente corrida.


## Bebidas  ·  `bebidas`  ·  etiqueta: `bebidas`  (1184)

### Termos  ·  `termos`  ·  `termos`  (513)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Mugs de viaje | `mugs-de-viaje` | `mugs de viaje` | título: `\bMUG\b` | 16 |
| 2 | Botellas térmicas | `botellas-termicas` | `botellas termicas` | título: `BOTELLA` | 24 |
| 3 | Termos de acero | `termos-de-acero` | `termos de acero` | título: `ACERO\|INOX\|TERMO\|TMPS` | 449 |

24 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Tazas y tarros  ·  `tazas`  ·  `tazas`  (215)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Tarros | `tarros` | `tarros` | título: `TARRO\|CERVECERO` | 34 |
| 2 | Tazas para sublimar | `tazas-para-sublimar` | `tazas para sublimar` | título: `SUBLIM\|SULIM\|\bSUB\b\|MAGICA` | 22 |
| 3 | Tazas de cerámica | `tazas-de-ceramica` | `tazas de ceramica` | título: `TAZA\|\bTAZ\b` | 149 |

10 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Vasos  ·  `vasos`  ·  `vasos`  (178)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Vasos térmicos | `vasos-termicos` | `vasos termicos` | título: `TMPS\|DOBLE PARED\|TERMIC\|ACERO\|ALUMINIO` | 31 |
| 2 | Vasos de plástico | `vasos-de-plastico` | `vasos de plastico` | título: `VASO\|TARRO` | 136 |

11 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Cilindros y botellas  ·  `cilindros-y-botellas`  ·  `cilindros de plastico` o `cilindros de metal y vidrio`  (278)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Cilindros de plástico | `cilindros-de-plastico` | `cilindros de plastico` | desde etiqueta `cilindros de plastico` | 198 |
| 2 | Cilindros de metal y vidrio | `cilindros-de-metal-y-vidrio` | `cilindros de metal y vidrio` | desde etiqueta `cilindros de metal y vidrio` | 80 |

## Oficina  ·  `oficina`  ·  etiqueta: `oficina`  (1606)

### Bolígrafos  ·  `boligrafos`  ·  `boligrafos de plastico` o `boligrafos de metal` o `boligrafos ecologicos` o `boligrafos multifuncionales`  (765)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Bolígrafos multifuncionales | `boligrafos-multifuncionales` | `boligrafos multifuncionales` | desde etiqueta `boligrafos multifuncionales` | 80 |
| 2 | Bolígrafos ecológicos | `boligrafos-ecologicos` | `boligrafos ecologicos` | desde etiqueta `boligrafos ecologicos` | 97 |
| 3 | Bolígrafos metálicos | `boligrafos-de-metal` | `boligrafos de metal` | desde etiqueta `boligrafos de metal` | 286 |
| 4 | Bolígrafos de plástico | `boligrafos-de-plastico` | `boligrafos de plastico` | desde etiqueta `boligrafos de plastico` | 302 |

### Libretas y agendas  ·  `libretas-y-carpetas`  ·  `libretas y carpetas`  (433)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Libretas ecológicas | `libretas-ecologicas` | `libretas ecologicas` | desde etiqueta `libretas ecologicas` | 147 |
| 2 | Agendas | `agendas` | `agendas` | título: `AGENDA` | 39 |
| 3 | Carpetas | `carpetas` | `carpetas` | título: `CARPETA\|PADFOLIO` | 30 |
| 4 | Libretas | `libretas` | `libretas` | título: `LIBRETA\|\bLIB\b\|BLOCK\|NOTAS` | 199 |

18 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Accesorios de oficina  ·  `accesorios-de-oficina`  ·  `accesorios de oficina`  (411)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Relojes | `relojes` | `relojes` | título: `RELOJ` | 43 |
| 2 | Calculadoras | `calculadoras` | `calculadoras` | título: `CALCULADORA` | 15 |
| 3 | Tarjeteros y portagafetes | `tarjeteros-y-portagafetes` | `tarjeteros y portagafetes` | título: `TARJETERO\|PORTAGAFETE\|GAFETE\|CARTERA` | 32 |
| 4 | Notas y blocks | `notas-y-blocks` | `notas y blocks` | título: `NOTAS\|BLOCK\|POST` | 42 |
| 5 | Escritorio y organizadores | `escritorio-y-organizadores` | `escritorio y organizadores` | título: `ESCRITORIO\|ORGANIZADOR\|PORTA\|LAMPARA\|MOUSE\|CAJA\|ESTUCHE` | 93 |

186 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Escolares y niños  ·  `ninos`  ·  `ninos`  (116)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Colores y marcadores | `colores-y-marcadores` | `colores y marcadores` | título: `MARCADOR\|MARCATEXTO\|LAPICERA\|CRAYON\|COLORES\|PINTA` | 29 |
| 2 | Alcancías y peluches | `alcancias-y-peluches` | `alcancias y peluches` | título: `ALCANCIA\|PELUCHE\|MUNECO\|\bOSO\b` | 17 |

70 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

## Textil  ·  `textil`  ·  etiqueta: `textil`  (1499)

### Mochilas y maletas  ·  `mochilas-y-maletas`  ·  `mochilas y maletas`  (480)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Maletas y trolleys | `maletas-y-trolleys` | `maletas y trolleys` | título: `MALETA\|\bMAL\b\|TROLLEY\|CARRY` | 145 |
| 2 | Mochilas para laptop | `mochilas-para-laptop` | `mochilas para laptop` | título: `LAPTOP\|EJECUTIV\|BUSINESS` | 16 |
| 3 | Mochilas | `mochilas` | `mochilas` | título: `MOCHILA\|\bMOC\b\|BACKPACK` | 310 |

9 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Bolsas y morrales  ·  `bolsas-y-morrales`  ·  `bolsas y morrales`  (358)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Bolsas de algodón y yute | `bolsas-de-algodon-y-yute` | `bolsas de algodon y yute` | título: `ALGODON\|YUTE\|MANTA` | 24 |
| 2 | Bolsas non woven y plegables | `bolsas-non-woven-y-plegables` | `bolsas non woven y plegables` | título: `\bNON\b\|NONW\|PLEGABLE` | 14 |
| 3 | Morrales y bolsos | `morrales-y-bolsos` | `morrales y bolsos` | título: `MORRAL\|BOLSO\|MOCHILA\|JARETA` | 70 |
| 4 | Bolsas promocionales | `bolsas-promocionales` | `bolsas promocionales` | título: `BOLSA` | 233 |

17 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Hieleras y loncheras  ·  `hieleras-y-loncheras`  ·  `hieleras y loncheras`  (237)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Hieleras | `hieleras` | `hieleras` | título: `HIELERA\|COOLER` | 106 |
| 2 | Loncheras | `loncheras` | `loncheras` | título: `LONCHERA\|\bLON\b\|LUNCH` | 120 |

11 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Gorras y cangureras  ·  `gorras-y-cangureras`  ·  `gorras y cangureras`  (193)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Gorras y sombreros | `gorras-y-sombreros` | `gorras y sombreros` | título: `GORRA\|\bCAP\b\|SOMBRERO\|\bHAT\b\|VISERA` | 88 |
| 2 | Cangureras | `cangureras` | `cangureras` | título: `CANGURERA\|BANDOLERA` | 35 |

70 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Ropa  ·  `ropa`  ·  `chamarras y chalecos` o `playeras y camisas`  (90)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Chamarras y chalecos | `chamarras-y-chalecos` | `chamarras y chalecos` | desde etiqueta `chamarras y chalecos` | 69 |
| 2 | Playeras y camisas | `playeras-y-camisas` | `playeras y camisas` | desde etiqueta `playeras y camisas` | 21 |

### Paraguas e impermeables  ·  `paraguas-e-impermeables`  ·  `paraguas e impermeables`  (92)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Impermeables | `impermeables` | `impermeables` | título: `IMPERMEABLE` | 11 |
| 2 | Paraguas | `paraguas` | `paraguas` | título: `PARAGUAS\|\bPAR\b` | 80 |

1 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Portafolios y portalaptop  ·  `portafolios-y-portalaptop`  ·  `portafolios y portalaptop`  (49)

Sin tipos (nivel 3).

## Hogar  ·  `hogar`  ·  etiqueta: `hogar`  (1221)

### Cocina  ·  `cocina`  ·  `cocina`  (522)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Bar y vino | `bar-y-vino` | `bar y vino` | título: `\bBAR\b\|DESTAPADOR\|LICORERA\|VINO\|SACACORCHO\|COCTEL\|SHAKER\|CERVEZA` | 106 |
| 2 | BBQ y asadores | `bbq-y-asadores` | `bbq y asadores` | título: `BBQ\|ASADOR\|PARRILL` | 26 |
| 3 | Contenedores y lunch | `contenedores-y-lunch` | `contenedores y lunch` | título: `CONTENEDOR\|LONCHERA\|LUNCH\|TOPPER` | 73 |
| 4 | Tablas y utensilios | `tablas-y-utensilios` | `tablas y utensilios` | título: `TABLA\|QUESO\|CUBIERTO\|UTENSILIO\|CUCHILLO\|PRENSA\|CAFE\|\bTE\b` | 96 |

221 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Accesorios del hogar  ·  `accesorios-del-hogar`  ·  `accesorios del hogar`  (125)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Decoración | `decoracion` | `decoracion` | título: `VELA\|PORTARRETRATO\|\bPRT\b\|DECORATIV\|LAMPARA\|CESTO` | 39 |
| 2 | Mascotas | `mascotas` | `mascotas` | título: `MASCOTA\|\bPET\b\|PERRO\|GATO` | 10 |
| 3 | Confort | `confort` | `confort` | título: `FRAZADA\|HUMIDIFICADOR\|COBIJA\|ALMOHADA` | 11 |

65 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

## Salud y belleza  ·  `salud-y-belleza`  ·  etiqueta: `belleza` o `salud y bienestar`  (458)

### Belleza  ·  `belleza`  ·  `belleza`  (316)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Cosmetiqueras y neceseres | `cosmetiqueras-y-neceseres` | `cosmetiqueras y neceseres` | título: `COSMETIQUERA\|NECESER\|NECESSAIRE\|\bDAM\b\|ORGANIZADOR` | 166 |
| 2 | Espejos | `espejos` | `espejos` | título: `ESPEJO` | 36 |
| 3 | Sets de manicure y maquillaje | `sets-de-manicure-y-maquillaje` | `sets de manicure y maquillaje` | título: `MANICURE\|MAQUILLAJE\|BROCHA\|CEPILLO\|ESPONJA\|APLICADOR` | 12 |

102 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Salud y bienestar  ·  `salud-y-bienestar`  ·  `salud y bienestar`  (142)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Pastilleros | `pastilleros` | `pastilleros` | título: `PASTILLERO` | 45 |
| 2 | Cuidado personal | `cuidado-personal` | `cuidado personal` | título: `\bGEL\b\|SANITIZANTE\|JABON\|TOALLA\|CEPILLO\|DIENTE\|CORPORAL\|\bKIT\b` | 30 |

67 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

## Tecnología  ·  `tecnologia`  ·  etiqueta: `tecnologia`  (603)

### Accesorios de tecnología  ·  `accesorios-de-tecnologia`  ·  `accesorios de tecnologia`  (284)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Cargadores y cables | `cargadores-y-cables` | `cargadores y cables` | título: `CARGADOR\|CABLE\|CARGA\|\bUSB\b\|\bCRG\b` | 126 |
| 2 | Soportes | `soportes` | `soportes` | título: `SOPORTE` | 32 |
| 3 | Mouse y hubs | `mouse-y-hubs` | `mouse y hubs` | título: `MOUSE\|\bPAD\b\|\bHUB\b\|CONCENTRADOR\|PUERTO` | 27 |

99 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Audio  ·  `audifonos-y-bocinas`  ·  `audifonos y bocinas`  (222)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Bocinas | `bocinas` | `bocinas` | título: `BOCINA` | 115 |
| 2 | Audífonos | `audifonos` | `audifonos` | título: `AUDIFONO\|\bAUD\b\|AURICULAR\|MANOS LIBRES` | 99 |

8 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Power banks  ·  `power-banks`  ·  `power banks`  (97)

Sin tipos (nivel 3).

## Tiempo libre  ·  `tiempo-libre`  ·  etiqueta: `tiempo libre`  (881)

### Llaveros  ·  `llaveros`  ·  `llaveros`  (218)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Llaveros multifuncionales | `llaveros-multifuncionales` | `llaveros multifuncionales` | título: `DESTAPADOR\|FLEXOMETRO\|LAMPARA\|\bLUZ\b\|MULTI\|HERRAMIENTA` | 28 |
| 2 | Llaveros clásicos | `llaveros-clasicos` | `llaveros clasicos` | título: `.` | 190 |

### Viaje  ·  `viaje`  ·  `viaje`  (184)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Organizadores de viaje | `organizadores-de-viaje` | `organizadores de viaje` | título: `ORGANIZADOR\|NECESER\|PASAPORTE\|IDENTIFICADOR\|CARTERA\|\bKIT\b\|PORTA` | 62 |
| 2 | Accesorios de viaje | `accesorios-de-viaje` | `accesorios de viaje` | título: `ALMOHADA\|FRAZADA\|SILLA\|LENTES\|BOLSA\|BOLSO` | 59 |

63 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Herramientas  ·  `herramientas-de-trabajo`  ·  `herramientas de trabajo`  (143)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Lámparas y linternas | `lamparas-y-linternas` | `lamparas y linternas` | título: `LAMPARA\|LINTERNA\|\bLED\b` | 31 |
| 2 | Navajas y multiherramientas | `navajas-y-multiherramientas` | `navajas y multiherramientas` | título: `NAVAJA\|MULTI` | 29 |
| 3 | Sets de herramientas | `sets-de-herramientas` | `sets de herramientas` | título: `HERRAMIENTA\|\bHER\b\|DESARMADOR\|FLEX\|PINZA\|\bKIT\b\|JUEGO` | 49 |

34 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Antiestrés  ·  `antiestres`  ·  `antiestres`  (141)

Sin tipos (nivel 3).

### Deportes y entretenimiento  ·  `entretenimiento`  ·  `entretenimiento`  (131)

| Orden | Tipo | Colección | Etiqueta | Cómo se asigna | Productos hoy |
|---|---|---|---|---|---|
| 1 | Juegos de mesa | `juegos-de-mesa` | `juegos de mesa` | título: `JUEGO\|DOMINO\|POKER\|TORRE\|CARTAS` | 37 |
| 2 | Deporte | `deporte` | `deporte` | título: `BALON\|PELOTA\|\bSOC\b\|\bFUT\|DEPORT\|\bSPO\b\|TOALLA\|BRAZALETE` | 44 |

50 productos no coinciden con ningún tipo: quedan sólo en "Ver todo".

### Accesorios para auto  ·  `accesorios-para-auto`  ·  `accesorios para auto`  (64)

Sin tipos (nivel 3).

## Ecológicos  ·  `ecologicos`  ·  etiqueta: `ecologicos`  (670)

### Oficina ecológica  ·  `oficina-ecologica`  ·  `oficina ecologica`  (89)

Sin tipos (nivel 3).

### Bolsas ecológicas  ·  `bolsas-ecologicas`  ·  `bolsas ecologicas`  (165)

Sin tipos (nivel 3).

### Hogar ecológico  ·  `hogar-ecologico`  ·  `hogar ecologico`  (85)

Sin tipos (nivel 3).

### Bebidas ecológicas  ·  `bebidas-ecologicas`  ·  `bebidas ecologicas`  (83)

Sin tipos (nivel 3).
