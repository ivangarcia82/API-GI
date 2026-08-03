
# Técnicas de decorado NO estandarizadas

Las técnicas vienen del metafield `custom.tecnicas_de_impresion` (lista separada por
comas) de cada producto. El motor de precios (`app/lib/decoration/engine.js`) solo cotiza
las técnicas que existen en `PRICE_MATRIX`. Las que **no** existen ahí:

- **no se ofrecen** en el selector de la PDP (se omiten del dropdown), y
- se listan aquí para que revises y decidas si hay que: (a) agregarlas a `PRICE_MATRIX`
  con su tabla de precios, (b) mapearlas a una técnica existente vía alias en `engine.js`,
  o (c) corregir el dato del producto en Shopify.

## Técnicas estándar (en la matriz, sí cotizan)

`SERIGRAFÍA`, `BORDADO`, `PARCHE SUBLIMADO`, `VINIL IMPRIMIBLE Y DTF`,
`IMPRESIÓN UV PLANA FULL COLOR`, `IMPRESIÓN 360° FULL COLOR`, `SUBLIMACION`,
`GRABADO LÁSER`, `GOTA DE RESINA`.

Aliases ya mapeados (label de tienda → llave de matriz): `Serigrafía`→`SERIGRAFÍA`
(por mayúsculas), `Grabado en láser`→`GRABADO LÁSER` (alias).

## No estandarizadas observadas hasta ahora

(De pruebas manuales; corre el audit para la lista completa por producto.)

| Técnica (label de tienda) | Estado                | Decisión pendiente                                              |
| -------------------------- | --------------------- | ---------------------------------------------------------------- |
| Tampografía               | No está en la matriz | ¿Agregar precios o mapear?                                      |
| Impresión Digital         | No está en la matriz | ¿Agregar precios o mapear?                                      |
| DTF UV                     | Ambiguo               | ¿= "VINIL IMPRIMIBLE Y DTF" o "IMPRESIÓN UV PLANA FULL COLOR"? |

## Cómo generar la lista completa por producto

Con el storefront enlazado y las variables `PUBLIC_STORE_DOMAIN` +
`PUBLIC_STOREFRONT_API_TOKEN` en `.env` (puedes traerlas con `npx shopify hydrogen env pull`):

```bash
set -a; . ./.env; set +a
node scripts/audit-techniques.mjs
```

El script recorre todos los productos, separa sus técnicas y **reescribe la sección
"Auditoría automática" de abajo** con una tabla de `producto → técnicas no estandarizadas`.

<!-- AUDIT:START -->

_(Aún no se ha corrido el audit. Ejecuta `node scripts/audit-techniques.mjs`.)_

<!-- AUDIT:END -->
