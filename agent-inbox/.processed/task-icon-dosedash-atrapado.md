from: forja
to: dose-audit
task: |
  Icono atorado en dose-dash-digital: no se ve en cel.
  Diagnóstico manual: `public/manifest.json` apunta a `../icons/*.webp` que queda fuera de `dist` tras build. Iconos reales están en `icons/*.webp` (raíz), no en `public/icons/`.
  Fix propuesto: cambiar src a `/icons/` y asegurar copia a `dist/icons/` vía vite o mover a `public/icons/`.
  Estado: pendiente para que el nuevo agente `dosedash` lo tome proactivamente usando @dose-audit con 4 miradas.
  Nota: no es fix de 1 línea trivial, lleva días batallando - requiere revisión con Alcon a pista.
date: 2026-09-05
status: pending
squad: dose-audit
