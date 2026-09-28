---
target: landing campaña mochilas /campana-mochilas
total_score: 18
max_score: 36
na_heuristics: 7
p0_count: 2
p1_count: 3
target_identity: "file:/Users/ivan/Documents/Generando Ideas/api/API-GI/app/components/mochilas/MochilasLanding.jsx"
target_fingerprint: "sha256:6914808107d0f0199c5d73deb6f5c77a9006f16f6e8330755decd6b75d98ab7d"
target_path: /Users/ivan/Documents/Generando Ideas/api/API-GI/app/components/mochilas/MochilasLanding.jsx
timestamp: 2026-09-25T17-45-01Z
slug: app-components-mochilas-mochilaslanding-jsx
---
# Crítica: Campaña de mochilas (/campana-mochilas)
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score: 18/36 (Aceptable, 50%) — n/a: 7
1 Visibilidad 2 · 2 Lenguaje 3 · 3 Control 2 · 4 Consistencia 2 · 5 Prevención 2 · 6 Reconocer 2 · 7 n/a · 8 Estética 2 · 9 Errores 2 · 10 Ayuda 1

## Veredicto de especificidad
Genérica y sin terminar; andamiaje de catálogo. Detector URL: 19 hallazgos (desktop), 17 (móvil); reales: blanco sobre #ff8300 2.5:1 en .mc-submit, kicker-above-heading x4, overused-font. Falsos: 11 contraste por animación, body-text-viewport-edge (qd-panel oculto). Overlay bloqueado por CSP (wasm).

## Priority issues
- [P0] Formulario descuadrado: reset.css:99-103 form max-width 400px; .gi-mkt .wrap gana a .mc-form-wrap; .mc-field input width:100% estira radios. Fix: form 720px centrado, foráneo como tarjetas. (/impeccable layout)
- [P0] Tarjetas desalineadas: Armor Max 896x1200 estira fila Wagner a 501px, CTA a distinta altura, 14 en 4 cols deja huérfanas. Fix: media aspect fijo overflow hidden object-fit cover, CTA anclado, 3 cols Takayama. (/impeccable layout)
- [P1] Jerarquía: .display sin font-size (H1 25.6px, H2 19.2px); máscara corta descendentes. (/impeccable typeset)
- [P1] Elegir escondido y duplicado (cards + select 23 opciones). Fix: "Elegir esta" en tarjeta, color como texto si es único, tarjeta "Tu mochila", barra fija. (/impeccable distill)
- [P1] Accesibilidad: botón 2.47:1, "Ver detalle" 3.40:1, bordes 1.53:1, modal sin focus trap bajo el header, chips 30px, errores sin aria-describedby. (/impeccable harden)

## Persona red flags
Móvil primera vez: primer producto a ~1329px, tarjetas 133px, radios lejos del texto. Teclado/lector: Tab sale del modal, foco se pierde al elegir, doble botón por tarjeta. No técnico: select 23 opciones, "¿Eres foráneo?", sin fecha/lugar/contacto.

## Minor
GSAP hero opacity 0 congelable; bandas con margen 16px; header muestra login en página con sesión; eyebrow "LÍNEA" redundante; hover scale sin efecto táctil.

## Questions
Regalo vs catálogo; filtro "¿para qué la usas?"; elección que viaja en barra fija.
