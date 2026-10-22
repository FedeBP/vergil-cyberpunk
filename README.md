# Ficha Cyberpunk

Ficha de personaje editable y offline (PWA) para la campaña de Cyberpunk. Cualquier jugador carga su personaje; los valores base salen siempre de las fórmulas.

## Qué hace

- Varios personajes por dispositivo, con importación/exportación JSON. Incluye a Vergil como ejemplo (`vergil.json`).
- **Características**: 320 puntos iniciales + 10 por cada nivel subido (`INITIAL_POINTS` en `rules.js`). Los implantes y méritos van en el +/-.
- **Habilidades**: base = (A+B)/5+10. El jugador asigna sus PH (PH × NV = INT/5+5 por nivel). La especialidad suma +20 y duplica los PH asignados. Se pueden agregar habilidades propias (ej. Estilo = DET×2).
- **Defensas y secundarias** calculadas; el +/- muestra de dónde sale cada bono (tocá el valor).
- **Implantes** desde el catálogo del Excel (o personalizados). Cada efecto escrito como `+N Objetivo` se aplica solo; lo condicional queda como texto. `D 2T, CD 6T` vuelve al implante activable (sus bonos solo valen activo). `+N X al usar Kerenzikov` vale con ese implante activo.
- **Méritos** del catálogo con rangos, requisitos y nivel mínimo.
- **Combate**: turnos, duración y cooldown de implantes, recursos (vitalidad, suerte, resolución) y d100 (90–94 fallo, 95–100 pifia), con opción de combinar dos habilidades usando la menor (Estilo).
- Redondeo hacia abajo en todo, salvo cooldowns (hacia arriba).

## Fórmulas

| Valor | Fórmula |
|---|---|
| Evasión | (DES+PER)/10 |
| Reflejos | (DES+PER)/5+10 |
| Fortaleza | (CON+FUE)/5+10 |
| Voluntad | (DET+FUE)/5+10 |
| PA | DES/10+5 |
| Vitalidad | CON/2+DET/5+30 |
| Potencia | FUE/5−5 |
| Rango | PER/2 |
| Iniciativa | (DES+PER)/10 |
| Vel. de curación | CON/20 |
| Resolución | DET/2 |
| Suerte | 50 |
| Carga máx. | (FUE+CON)/2+20 |
| Límite de implantes | DET+CON/2 |

Todas están en `rules.js`.

## Actualizar el catálogo

```
python tools/build_catalog.py ruta/Cyberpunk.xlsx > catalog.js
node tools/test.js
```

Los méritos generales y los implantes que no están en el Excel (Kerenzikov, Defenzikov) están dentro de `tools/build_catalog.py`.

## Instalar en el celular

Abrir [la ficha](https://fedebp.github.io/vergil-cyberpunk/) desde Safari, después **Compartir → Agregar a pantalla de inicio**. Los datos quedan en el dispositivo; exportá el JSON para respaldarlos. La ficha guardada por la versión anterior se migra sola la primera vez.
