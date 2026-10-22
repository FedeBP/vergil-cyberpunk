# Vergil — Ficha Cyberpunk

Aplicación web instalable (PWA) para manejar la ficha del personaje **Vergil** (jugador: Fefo) en la campaña Cyberpunk.

## Funcionalidades

- Edición de nivel, experiencia y características.
- Fórmulas automáticas para habilidades, defensas, recursos y secundarios.
- Los implantes aportan modificadores automáticos y no alteran las bases.
- Especialidades, modificadores manuales y tiradas d100 con Estilo.
- Combate por turnos con Kerenzikov, Sandevistan Mirror, Defenzikov y Newton Module.
- Redondeo hacia abajo para estadísticas y hacia arriba para cooldowns.
- Guardado local, importación/exportación JSON y modo sin conexión después de la instalación.

## Instalar en el iPhone

1. Publicar la rama `main` desde **Settings > Pages > Deploy from a branch > main > / (root)**.
2. Abrir [Vergil Character Sheet](https://fedebp.github.io/vergil-cyberpunk/) desde **Safari**.
3. Abrir el menú **Compartir** y elegir **Agregar a pantalla de inicio**.

Los cambios de personaje se guardan en el navegador del dispositivo; no se sincronizan automáticamente entre equipos. Usá la exportación JSON para hacer respaldos.

## Tecnologías

HTML, CSS y JavaScript sin frameworks ni backend. `manifest.webmanifest` permite instalación; `sw.js` conserva recursos para uso sin conexión.

## Aspectos pendientes de confirmar con el máster

- Cómo se computa el límite/carga de implantes según el Excel de campaña.
- Si Defenzikov aplica RD a todos los tipos de daño o solamente a algunos.
- Efectos de ciertos méritos y especialidades situacionales.
- Convenciones precisas del conteo de cooldowns al terminar cada efecto.
