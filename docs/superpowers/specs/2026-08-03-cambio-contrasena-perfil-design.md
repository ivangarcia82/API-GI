# Cambio de contraseña desde "Mi perfil"

**Fecha:** 2026-08-03
**Ruta afectada:** `/account/profile`

## Contexto

Hoy un usuario autenticado sólo puede cambiar su contraseña saliendo de la sesión y pasando por el
flujo de recuperación por correo: `/auth/forgot` → email → `/auth/reset?token=…`. Es un rodeo para
una operación que debería estar en la pantalla de perfil.

La infraestructura necesaria ya existe y no hace falta inventar nada nuevo en la capa de datos:

- `app/lib/auth/password.js` — `hashPassword()` / `verifyPassword()` (PBKDF2-SHA256 con pepper HMAC,
  comparación en tiempo constante).
- `app/lib/auth/users.js` — `updatePassword(db, env, id, nueva)` escribe el hash **y** sube
  `session_version`, devolviendo la versión nueva.
- `app/lib/auth/guard.js` — `requireUser()` compara el `session_version` de la cookie contra el de la
  base y expulsa a `/login` cuando hay desfase.
- `app/lib/http/csrf.js` — `assertSameOrigin()`, ya invocado por la acción actual de la ruta.
- Tabla `login_attempts` — ventana de 15 minutos, 8 fallos, usada por `auth.login.jsx`.

El trabajo es de composición: una acción nueva, una sección de UI y la re-sincronización de la cookie.

## Alcance

**Dentro:** formulario de cambio de contraseña en `/account/profile`, verificación de la contraseña
actual, límite de intentos fallidos, y continuidad de la sesión del navegador que hace el cambio.

**Fuera, por decisión explícita:**

- **Correo de aviso "tu contraseña fue actualizada".** La infraestructura está disponible
  (`app/lib/email/resend.js` + `templates.js`), pero se descartó para esta ronda. Consecuencia: un
  cambio hecho desde una sesión robada es silencioso para el dueño real de la cuenta. Anotado como
  candidato para una ronda posterior.
- **Reglas de contraseña más estrictas.** Se mantiene el mínimo de 8 caracteres que ya aplican
  `/registro` y `/auth/reset`. Subir el listón sólo aquí crearía una inconsistencia: una cuenta creada
  con 8 caracteres cualesquiera no podría cambiar su contraseña sin cumplir una regla que su registro
  nunca pidió.
- **Cambio de correo de acceso.** El campo sigue deshabilitado, como hoy.

## Decisión de arquitectura: dos formularios, un `action`

`useActionData()` devuelve **un solo valor por ruta**. Si el formulario de perfil y el de contraseña
lo compartieran, guardar los datos de contacto pintaría "Cambios guardados" dentro de la tarjeta de
seguridad, y un error de contraseña aparecería junto a los campos de facturación.

La solución es darle a cada bloque su propio canal de estado:

| Formulario | Método | Componente | Estado |
|---|---|---|---|
| Datos de perfil (existente) | `PUT` | `<Form>` | `useActionData()` |
| Cambiar contraseña (nuevo) | `POST` | `<fetcher.Form>` | `fetcher.data` |

El método HTTP es lo que ramifica la acción del servidor; no hace falta un campo `intent` oculto. La
acción actual ya rechaza todo lo que no sea `PUT` con 405, así que la rama `POST` se agrega donde hoy
está ese rechazo y el 405 pasa a cubrir el resto de métodos.

## Flujo del servidor

```
POST /account/profile
  ├─ assertSameOrigin(request)              → 403 si el Origin no coincide
  ├─ requireUser(context)                   → redirect /login si no hay sesión válida
  ├─ findById(db, userId)                   → necesario: la sesión no guarda el email
  ├─ recentFailures(db, user.email, ip) >= 8 → 429
  ├─ validatePasswordChange({...})          → 400 con el mensaje correspondiente
  ├─ getPasswordRecord(db, userId)
  ├─ verifyPassword(actual, rec, env)       → falso: recordAttempt(false) + 401
  ├─ updatePassword(db, env, userId, nueva) → devuelve el session_version nuevo
  └─ loginSession(session, {..., sessionVersion: versiónNueva})
```

`requireUser()` devuelve sólo el snapshot de la cookie —`{userId, role, gid, sessionVersion}`— sin el
correo. El `findById()` es necesario para dos cosas: la clave del contador de intentos y los campos
`role` y `gid` que `loginSession()` necesita al final. La ruta ya recibe el usuario por
`useOutletContext`, pero eso es del lado del cliente y no sirve dentro de la acción.

### La re-sincronización de la cookie es el punto crítico

`updatePassword()` incrementa `session_version` en la base, lo que invalida **todas** las sesiones —
incluida la del navegador que acaba de hacer el cambio. Sin el `loginSession()` final, `requireUser()`
detecta el desfase en la siguiente navegación y manda al usuario a `/login`, que es exactamente el
comportamiento que se decidió evitar.

`updatePassword()` ya devuelve la versión nueva (`bumpSessionVersion` la retorna), así que se usa
directamente sin una segunda lectura a la base.

Los demás dispositivos conservan la versión vieja en su cookie y quedan desconectados en su siguiente
navegación. Ese es el efecto buscado.

### Sobre `session.destroy()`

`auth.reset.jsx:45` llama a `context.session.destroy()` antes de re-loguear, con la intención de
prevenir fijación de sesión. En esta implementación esa llamada **no limpia el objeto de sesión en
memoria**: `AppSession.destroy()` (`app/lib/session.js:74`) sólo devuelve una cadena `Set-Cookie` con
`Max-Age=0`, y en ese flujo el valor retornado se descarta. Como la sesión vive entera en una cookie
firmada —no hay identificador de servidor que rotar— no hay fijación que prevenir.

Por eso esta acción **no** replica esa llamada. Lo que protege la cuenta es el `session_version`, no
la rotación del identificador.

### Persistencia de la cookie

`server.js:35` emite el `Set-Cookie` cuando `session.isPending` es verdadero, y `loginSession()` lo
activa a través del getter `set` (`app/lib/session.js:69`). Esto aplica igual para una respuesta
`data()` que para un `redirect()`, así que la respuesta del fetcher lleva la cookie actualizada.

**Verificación manual obligatoria:** cambiar la contraseña y navegar a otra sección de la cuenta sin
recargar. Si el usuario termina en `/login`, la cookie nueva no alcanzó a aplicarse antes de que
React Router revalidara el loader de `account.jsx`, y habría que pasar la acción a `redirect()` en vez
de `data()`.

## Validaciones y mensajes

`validatePasswordChange({current, next, confirm})` es una función pura, sin acceso a base de datos,
para poder probarla sin DOM ni fixtures. Sigue el precedente de `app/routes/registro.validation.js`.

Cubre **sólo las tres reglas que se resuelven comparando strings en memoria**. La corrección de la
contraseña actual no es asunto suyo: eso lo decide `verifyPassword()` contra el hash.

| Caso | Quién lo detecta | Estado | Mensaje |
|---|---|---|---|
| Nueva contraseña < 8 caracteres | `validatePasswordChange` | 400 | `La contraseña debe tener al menos 8 caracteres.` |
| Confirmación distinta de la nueva | `validatePasswordChange` | 400 | `Las contraseñas no coinciden.` |
| Nueva igual a la actual (`next === current`) | `validatePasswordChange` | 400 | `La nueva contraseña debe ser distinta a la actual.` |
| Contraseña actual vacía o incorrecta | `verifyPassword` | 401 | `La contraseña actual es incorrecta.` |
| 8+ fallos en 15 minutos | `recentFailures` | 429 | `Demasiados intentos. Intenta de nuevo en unos minutos.` |
| Éxito | — | 200 | `Contraseña actualizada. Cerramos la sesión en tus otros dispositivos.` |

La comparación `next === current` es de texto plano, sin criptografía: en este punto la acción tiene
ambas cadenas en memoria.

El orden importa: las validaciones puras corren **antes** de `verifyPassword()`, para no gastar un
PBKDF2 de 100 000 iteraciones en una petición que ya se sabe inválida. Una contraseña actual vacía sí
llega hasta `verifyPassword()` y consume ese costo; es un caso poco frecuente y no justifica duplicar
la regla en dos lugares.

A diferencia de `/auth/login`, aquí **no** hay riesgo de enumeración de cuentas —el usuario ya está
autenticado y sólo puede operar sobre sí mismo— así que los mensajes pueden ser específicos en vez de
genéricos.

## Límite de intentos: contador compartido con el login

`recentFailures()` filtra por `email OR ip`, así que los fallos de "contraseña actual" registrados
aquí también cuentan para el bloqueo de `/login`, y viceversa.

**Es deliberado.** Es la misma credencial; separar los contadores le daría a un atacante con una
sesión abierta un canal de adivinanza sin límite propio. La consecuencia aceptada es que un usuario
que se equivoque 8 veces en su perfil quedará bloqueado 15 minutos también en la pantalla de acceso.

Los intentos exitosos **no** se registran en `login_attempts`: esa tabla alimenta un contador de
fallos y `recordAttempt(…, true)` en `auth.login.jsx` existe sólo como bitácora del acceso. Un cambio
de contraseña no es un acceso.

## Interfaz

Sección `Seguridad` debajo del grid actual, separada por un borde superior, dentro del mismo
`<>…</>` que ya renderiza la ruta. Tres campos a ancho completo (`.acct-form-full`), cada uno con
toggle de visibilidad reusando `<Icon name="eye" />` / `eye_off` como en `registro.jsx:185`.

```
┌─ Mi perfil ─────────────────────┐
│ Nombre    [____]  Apellido [__] │
│ Empresa   [_____________]       │
│ Razón soc.[_____________]       │
│ Correo    [_______] (bloqueado) │
│           [ Guardar cambios ]   │
├─────────────────────────────────┤
│ Seguridad                       │
│ Contraseña actual [________] 👁 │
│ Nueva contraseña  [________] 👁 │
│ Confirmar nueva   [________] 👁 │
│           [ Cambiar contraseña ]│
└─────────────────────────────────┘
```

Detalles:

- `autoComplete="current-password"` en el primer campo, `new-password` en los otros dos, para que los
  gestores de contraseñas ofrezcan lo correcto en cada uno.
- `minLength={8}` en los campos nuevos, como validación de navegador **además de** la del servidor.
- Los tres campos se limpian tras un cambio exitoso.
- El botón se deshabilita mientras `fetcher.state !== 'idle'` y muestra `Cambiando…`.
- Errores en `.error-msg` con `role="alert"`; éxito en `.help-msg` con `role="status"`, igual que el
  formulario de perfil.

## Archivos

**Nuevos**

- `app/lib/auth/password-policy.js` — `validatePasswordChange({current, next, confirm})` devuelve un
  string de error o `null`.
- `app/lib/auth/password-policy.test.js` — un caso por fila de la tabla de validaciones.
- `app/lib/auth/attempts.js` — `clientIp()`, `recentFailures()`, `recordAttempt()`.

**Modificados**

- `app/routes/account.profile.jsx` — acción ramificada por método, sección "Seguridad".
- `app/routes/auth.login.jsx` — importa las tres funciones desde `attempts.js` en lugar de definirlas
  inline. Sin cambio de comportamiento.
- `app/lib/auth/users.js` — se agrega `getPasswordRecord(db, id)`, que devuelve
  `{hash, salt, iterations}`. Hoy ese `SELECT` está escrito a mano dentro de `auth.login.jsx:70`,
  fuera de la capa de repositorio donde vive todo el resto del SQL de usuarios. Con dos consumidores,
  extraerlo deja de ser opcional.

## Pruebas

**Automatizadas** (`vitest`, `npm test`):

- `password-policy.test.js` — nueva < 8, confirmación distinta, nueva igual a la actual, entrada
  válida, y campos vacíos.

**Manuales**, en este orden:

1. Contraseña actual incorrecta → mensaje de error, la contraseña no cambia.
2. Nueva y confirmación distintas → mensaje de error.
3. Cambio exitoso → mensaje de éxito, campos limpios, **el usuario sigue navegando en `/account`**.
4. Con la sesión anterior abierta en otro navegador, navegar → redirige a `/login`.
5. Cerrar sesión y entrar con la contraseña nueva → funciona; con la vieja → falla.
6. Fallar 8 veces la contraseña actual → 429, y `/login` también responde 429.

El paso 3 es el que valida la decisión central del diseño. Los pasos 4 y 5 confirman que el bump de
`session_version` surtió efecto donde debía.
