# Siguientes pasos — asignación y aviso de ejecutiva de venta

Apuntes de lo que quedó **deliberadamente fuera** al construir (2026-08-24):

1. La selección de ejecutiva de venta en el registro (`custom.ejecutiva_de_venta`).
2. El aviso por correo al asesor cuando el usuario verifica su cuenta.

Ninguno es un bug: son decisiones tomadas con Iván. Se listan por orden de
impacto estimado.

---

## 1. Leads que nunca verifican son invisibles

**Qué pasa.** El aviso al asesor sale desde el `action` de `auth.verify.jsx`,
o sea sólo cuando la persona hace clic en el enlace del correo. Quien se
registra y nunca confirma no le llega a nadie: no hay recordatorio de
verificación ni pantalla de "registros pendientes".

**Por qué se eligió así.** Evita que los asesores reciban bots, pruebas y
correos con typo, y hace el aviso idempotente por construcción — el token de
verificación es de un solo uso (`verifyAndConsumeToken`), así que es imposible
notificar dos veces.

**Posibles caminos.**
- Recordatorio automático a las 24/48 h a quien no verificó.
- Vista interna de altas sin verificar (los datos ya están en la tabla `users`:
  `email_verified_at IS NULL`).
- Aviso al asesor al registrarse *además* del de verificación, con asuntos
  distintos.

---

## 2. Reply-To en el correo al asesor

**Qué pasa.** El correo sale de `EMAIL_FROM`. Para responderle al cliente, el
asesor tiene que copiar la dirección a mano.

**Arreglo.** Una línea: pasar `replyTo: user.email` en la llamada a `sendEmail`
dentro de `app/lib/auth/signup-notify.js`. `sendEmail` ya soporta `replyTo` (lo
usa `notifyQuoteSubmitted` para las cotizaciones).

---

## 3. Si el alta no alcanza a crear el customer, se pierde el asesor elegido

**Qué pasa.** `linkSignupCustomer` es best-effort. Si Shopify falla justo en el
alta, el gid se reconcilia después (`reconcileShopifyCustomer`) pero **el handle
del asesor elegido no se guarda en ningún lado**, así que ese cliente queda sin
`custom.ejecutiva_de_venta`. Queda un `console.warn` con el handle para
rastrearlo. Al verificar, el aviso cae en `marketing` (ver
`resolveRecipient` en `signup-notify.js`), así que el lead no se pierde — pero
el asesor que la persona señaló nunca se entera.

**Por qué se eligió así.** Se decidió no tocar el schema de Turso: el metaobject
asignado es la única fuente de verdad.

**Arreglo si molesta.** Columna `advisor_handle` en `users` que la reconciliación
consuma para aplicar el metafield tarde.

---

## 4. `/registro` pega al Admin API en cada carga

**Qué pasa.** El `loader` de `app/routes/registro.jsx` llama a `listAdvisors`
en cada visita. Costo 4 de un bucket de 2000 que se restaura a 100/s — sin
riesgo real hoy.

**Arreglo si el tráfico crece.** Cachear la lista unos minutos con el `cache`
de Hydrogen (ya está en el contexto, ver `app/lib/context.js`). La lista cambia
cuando RH da de alta o baja a alguien: unos minutos de desfase son inofensivos.
