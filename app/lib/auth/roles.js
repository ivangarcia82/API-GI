// Nombres de rol. Módulo deliberadamente SIN imports: lo consumen tanto las
// rutas (vía Vite, que resuelve el alias `~`) como los scripts de
// scripts/*.mjs, que corren en Node crudo y no saben nada de alias.
//
// Meter aquí un import de `~/...` rompería los scripts con
// ERR_MODULE_NOT_FOUND, que es exactamente lo que pasó al nacer el portal.

/** Compradores. Es el valor por defecto de users.role. */
export const BUYER_ROLE = 'quoter';

/** Ejecutivos de venta con acceso al portal. */
export const ADVISOR_ROLE = 'asesor';
