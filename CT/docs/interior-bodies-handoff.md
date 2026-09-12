> Update, 2026-09-12: the construction described below has been replaced.
> `pieceBodyGeometry` now intersects all cap-footprint prisms into one shell,
> with hard cap junctions and smooth shallow contour facets. The overlapping
> per-face bottoms, depth offsets, and ineffective clearance settings are gone.
> Walls have nondegenerate two-dimensional UVs for normal and roughness wear.
> `tests/interior-bodies.cjs` checks all three models at all five quality levels,
> including outward winding, finite attributes and usable UVs on every triangle.
> The historical notes below retain the user's shape constraints.

# Handoff: cuerpos interiores de los speedcubes

Documento de traspaso. Describe el pedido, el estado actual del código, lo que se
verificó, lo que quedó pendiente y todos los enfoques que ya se probaron y por qué
se descartaron. Pensado para que otro modelo continúe sin repetir caminos muertos.

## 1. Pedido del usuario (en orden cronológico)

1. Las "piezas interiores" (los 26 cuerpos negros debajo de las tapas de color) de
   los 3 speedcubes (`speedcube`, `uv`, `og`) deben seguir la forma de las tapas
   exteriores y "conectarse" con ellas, **un pelo más chicas** ("muy poquito") que
   las exteriores, siguiendo la forma. `tiles` y `stickers` quedan igual.
2. Aclaración posterior: **sin taper** — la sección que toca la tapa debe
   extenderse hacia el centro **sin achicarse** (se había agregado un taper por
   modelo que el usuario nunca pidió; se eliminó).
3. El encuentro entre la pared del cuerpo y la cara exterior debe ser **en ángulo
   recto, no redondeado** ("la punta del prisma no debe ser redondeada").
4. "Recordá que el cuerpo también tiene que tener el material de wear si
   corresponde" — al generar geometría nueva se perdieron los UVs y los mapas de
   desgaste no se aplicaban. **Arreglado** (se generan UVs), verificado a ojo con
   `body-wear.cjs`.

Preguntas ya respondidas por el usuario antes de empezar (no volver a preguntar):
- Alcance: los 26 cuerpos negros (no el núcleo, no pies/torpedos).
- Fidelidad: silueta completa por pieza (radios internos/externos incluidos).
- Los 3 speedcubes: "geometría distinta para cada uno" (hoy la diferencia es
  mínima, ver §5).
- Visibilidad: no hace falta marcar más la ranura en el cubo resuelto; importa en
  giros.

## 2. Arquitectura relevante

Todo el render realista está en `assets/cube-realistic.js` (módulo ES).

- `MODELS` (línea ~47): `tiles`, `stickers`, `speedcube`, `uv`, `og`.
  `SCULPTED(model)` = shape `"speedcube"` → true para speedcube/uv/og.
- `faceGeometry(model, cell, ...)` (línea ~577): genera las 54 tapas (capas
  exteriores). Los perfiles están extraídos a constantes de módulo:
  `SCULPTED_PROFILE`, `SCULPTED_CENTER_RINGS`, `UV_CENTER_RINGS` (~línea 572).
- `chamferedSquareContour` (línea ~789): contorno octogonal de las tapas de
  centro; se extrajo del branch `cell === 4` de `faceGeometry` para reusarlo.
- Cuerpos interiores (todo lo nuevo): líneas ~833–1052:
  - `BODY` (833): por modelo, `{ inset, clearance }`.
    `inset = .006` (el "pelo" lateral), `clearance = .75/.74/.76` (radio de la
    esfera de recorte alrededor del núcleo).
  - `BODY_BASE = .487 - .045 = .442` (plano de la base de las tapas en coords de
    pieza; las tapas se posicionan a `p + n*.487` y sus perfiles arrancan en
    `z = -.045`).
  - `BODY_FRAMES` (840): los 6 frames (n/right/down) copiados de `CT.FACES` de
    `core.js`. Se usan para saber `col`/`row`/`cell` de la tapa de cada pieza.
  - `bodyFootprint` (906): tabla de radios (256 muestras) del contorno de la
    base de la tapa para (model, cell, col, row), cacheada en módulo.
  - `bodyFaces` (918): para una pieza `p ∈ {-1,0,1}³`, devuelve sus caras
    expuestas con `{ n, right, up, footprint }`.
  - `bodyClip` (935): Sutherland–Hodgman contra semiespacios
    `a*x + b*y <= BODY_BASE` (los planos de las otras caras expuestas).
  - `bodyDepth` (950): profundidad donde la pared corta la esfera de clearance
    (resuelve la cuadrática; fallback `BODY_BASE - .9`).
  - `pieceBodyGeometry` (962): construcción explícita por cara:
    - polígono = contorno base de la tapa menos `inset`, muestreado
      (40/56/88 puntos según calidad low/balanced/high+);
    - clip por los planos de las otras caras;
    - por cara: tapa superior (fan con normal `n`), pared de extrusión recta
      (`wallTop`/`wallBottom` con normal de contorno por vértice) y tapa inferior
      (fan con normal `-n`) **como juegos de vértices separados**, para que el
      filo superior sea duro (sin promediar normales tapa/pared);
    - UVs: proyección `(x/.9+.5, y/.9+.5)` con `right`/`up` de la cara. Esto
      continúa el mapeo de las tapas y hace que los mapas de wear apliquen.
    - las tapas inferiores por cara llevan un offset `faceIndex * .003` de
      profundidad para que no queden coplanares entre caras (z-fighting).
  - El cuerpo completo es la **unión** de los sólidos por cara (cada uno clipado
    por los planos de las otras). No es la intersección exacta; ver §5.
- Constructor (línea ~1160):
  - `speedcube ? null : new RoundedBoxGeometry(.972, .972, .972, 5, .085)`.
  - Para los 3 speedcubes: 26 × `pieceBodyGeometry(model, [x,y,z], this.quality)`,
    uno por pieza; la geometría queda en `this.bodies` como `{ mesh, p }` y
    `draw()` la sigue moviendo igual que antes.
  - `tiles`/`stickers`: intactos con la caja redondeada compartida.
- Material del cuerpo: `this.shellMaterial` (ABS + `CORE_FINISH`): ya declara
  `roughnessMap`, `clearcoatRoughnessMap`, `normalMap`/`bumpMap` de wear. Con los
  UVs nuevos ahora sí se ve el desgaste.

## 3. Estado actual (lo que está en el archivo)

- `assets/cube-realistic.js` compila (`node --check` sobre una copia `.mjs`).
- Prismas rectos, sin taper y sin fillet/redondeo en el encuentro.
- `inset = .006` lateral; tapa superior a `BODY_BASE` exacto (sin luz vertical).
- Puntas/aristas duras por separación de vértices; paredes con normal de contorno
  suave.
- UVs presentes (`cube.bodies[0].mesh.geometry.getAttribute("uv")` existe).
- Modelos distintos solo por `clearance` (.75/.74/.76) = profundidad del recorte
  interno; visualmente casi idénticos (el usuario había pedido "distinta").
- `tiles`/`stickers` no cambiaron.

### Verificado antes del último retoque
- `node tests/og-speedcube.cjs`: pasó low/balanced/high en la última corrida
  completa; la corrida final se abortó después de esos 3 (ultra/cinematic sin
  verificar con el último cambio). Ese test sólo mira tapas/holders, no cuerpos.
- `node tests/uv-coating.cjs`: pasó en versiones anteriores de este cambio.
- `npm test` (core/timer/effects/trainer/server): 47/47 en una corrida anterior.
- `node tests/cube-appearance.cjs` con `CT_SCREENSHOT_DIR` a una carpeta temporal:
  PASS (evita bloqueos de OneDrive al escribir screenshots).
- Renders manuales (ver §6) mostraron: costura limpia siguiendo las tapas,
  paredes interiores rectas con filo limpio, wear visible en las paredes.
- **El último cambio** (separar `wallTop`/`wallBottom` de `top`/`bottom` y el
  offset `faceIndex * .003`) sólo se verificó con `og-speedcube` low/balanced/high
  y capturas de `body-close`/`body-shape`; **faltan** ultra/cinematic, uv-coating,
  appearance y una revisión visual final a escala de app.

## 4. Historial de enfoques probados (para NO repetirlos)

1. **Malla radial alrededor del eje entrante** (lat/long; `bodyRadius` con
   prismas + esfera + campo de altura de la tapa). Problemas:
   - Con normales suavizadas el filo se veía redondeado (bisel de una celda de
     malla; el usuario lo notó).
   - Con normales analíticas duras aparecía sierra/zigzag ("teeth") porque el
     borde del prisma no es una arista topológica en esa malla.
   - Se probaron: `computeVertexNormals`, normales analíticas, blend con banda
     (`BODY_EDGE`), fillet chico `R=.026`, snapping de vértices al rim. Todos
     dejaron redondeo, sierra, peine o picos. El snap además generó picos bajo la
     tapa (comb) y se revirtió.
2. **Taper por modelo** (achicaba la sección hacia el núcleo). El usuario lo
   rechazó explícitamente ("no pedí que se achique"). Eliminado; no reintroducir.
3. **Fillet/redondeo del encuentro**. El usuario lo rechazó ("no redondeado").
   Eliminado; no reintroducir.
4. **Plug que copiaba la cara inferior de la tapa** (campo de altura del perfil).
   Invisible (está tapado) y agregaba artefactos. Descartado.
5. **Construcción explícita por cara** (la actual): evita todos los problemas
   anteriores. Es la dirección que quedó.
6. **Bug encontrado y corregido**: `new T.Float32BufferAttribute(array, 3)`
   **copia** el array en el momento de `setAttribute`. Cualquier mutación de
   posiciones posterior no llegaba al buffer. Ahora los atributos se setean
   después de todos los pases que mutan posiciones.

## 5. Problemas conocidos / puntos abiertos

1. **No es la intersección exacta de prismas**: es la unión de los sólidos por
   cara clipados por los planos vecinos. En las aristas verticales de la pieza
   (donde se cruzan dos paredes) el contorno redondeado real puede quedar algo
   más "esquinado" que la intersección. No se notó en los renders, pero es una
   aproximación.
2. **Diferencias entre los 3 speedcubes**: sólo `clearance`. Si el usuario quiere
   que se vean claramente distintos, habría que definir una diferencia
   estructural consensuada (no inventar taper).
3. **Tapas inferiores**: offset por cara para evitar coplanaridad; no se verificó
   específicamente un giro de 45° mirando desde abajo con las tapas puestas.
4. **Shadows/self-shadow** de las nuevas paredes no se revisó en detalle (los
   tests de calidad pasan).
5. **Costos**: construcción del cubo speedcube ~200 ms (26 cuerpos); aceptable y
   se cachea por slot/modelo. `BODY_FOOTPRINTS` es caché de módulo sin dispose
   (arrays planos, no recursos GL).
6. **Screenshots del repo**: al correr tests hay que restaurar
   `git checkout -- tests/screenshots` o usar `CT_SCREENSHOT_DIR` (OneDrive
   bloquea a veces los PNG existentes → error `UNKNOWN: open ...`).

## 6. Herramientas de verificación (temporales, fuera del repo)

En `C:\Users\alejo\AppData\Local\Temp\opencode\` (no forman parte del repo; se
pueden recrear):

- `body-review.cjs`: 3 modelos, resuelto/giro/scramble/edge, 800×800, imprime
  estadísticas de normales/radios de los cuerpos.
- `body-close.cjs`: comparación old vs new a zoom alto (solved/turn).
- `body-shape.cjs`: cuerpos sin tapas (turn/under + variante sin sombras).
- `body-wear.cjs`: wear on/off por modelo + chequeo de UVs.
- `body-macro.cjs` / `joint.cjs`: primeros planos de la costura y del encuentro.
- `body-ab.cjs`: A/B contra la versión de HEAD servida como `/assets/cube-old.js`.
- Todos levantan su propio server HTTP sirviendo `C:\...\CubeTracker\CT` y usan
  Playwright/Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`).

Tests del repo a correr tras cualquier cambio:
```
node tests/og-speedcube.cjs
node tests/uv-coating.cjs
node --test tests/core.test.cjs tests/timer.test.cjs tests/effects.test.cjs tests/trainer.test.cjs tests/server.test.mjs
$env:CT_SCREENSHOT_DIR="C:\temp\appearance"; node tests/cube-appearance.cjs
```

## 7. Estado del working tree

Mío (este trabajo):
- `assets/cube-realistic.js` (M). Único archivo tocado por esta tarea.
- `tests/screenshots/*` se restauraron a HEAD (side effect de los tests).

NO míos (hay actividad concurrente en el repo; no tocar):
- `assets/app.js`, `assets/style.css`, `tests/trainer-interface.cjs`,
  `cubedesk-...csv`, `a-22cba4ad.csv`, `aaa-eb27a529.csv`, `.cubetracker.json`,
  `tests/import-fixture.csv`, `assets/vendor/dm-sans-OFL.txt`,
  `tests/verification-records/*`, y `Normal map.png` (untracked).
- El servidor local puede estar corriendo en `http://127.0.0.1:4173` y sirve el
  archivo actualizado (Cache-Control: no-cache; alcanza con recargar la página).

## 8. Cómo seguir

1. Terminar de verificar el último cambio (correr los tests del §6 completos).
2. Revisar a escala de app (cubo ~400–600 px, resuelto y en giro) que el filo se
   vea recto y que el wear se aplique en las paredes interiores.
3. Si se quiere exactitud total: construir la **intersección** de los prismas por
   cara (p. ej. clipar cada pared por el *contorno* de las caras vecinas, no sólo
   por sus planos) manteniendo la topología explícita actual.
4. Definir con el usuario si los 3 modelos deben diferir más y cómo.
