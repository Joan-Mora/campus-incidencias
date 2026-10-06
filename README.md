# El Campus También Se Daña

Sistema para que la comunidad de UNIMINUTO reporte daños del campus y para que mantenimiento los atienda en orden, a tiempo y con evidencia.

Tiene dos interfaces independientes sobre la misma API:

- **Centro de mando (escritorio):** un gemelo digital 3D del campus con balizas por nivel de prioridad, la cola ordenada por puntaje, tablero por estados, panel de métricas, sugerencias de agrupación y un modo proyector para pantallas grandes.
- **App de campo (móvil):** reporte guiado en cinco pasos con QR del salón, salón 3D para tocar el punto exacto del daño, dictado por voz, foto comprimida, aviso de duplicados antes de enviar y cola sin conexión. Para técnicos y supervisores, una bandeja con gestos y evidencia antes y después.

## Cómo cumple cada requisito

| Requisito | Dónde se resuelve |
|---|---|
| Registro de incidencias | Asistente móvil (`apps/web/src/mobile/report/`) y `POST /api/incidents`, validado con zod en `packages/shared/src/schemas.ts` |
| Prioridad ponderada con al menos tres variables | `computePriority` en `packages/shared/src/domain/priority.ts`: cinco variables con pesos, sin reglas por palabra clave. El desglose se ve en cada incidencia |
| Detección de incidencias relacionadas | `combineSimilarity` en `packages/shared/src/domain/similarity-score.ts`: ubicación, categoría, texto (TF-IDF o embeddings) y tiempo. Agrupa sola a partir de 75 % y sugiere desde 55 % |
| Escalamiento automático por SLA y marca de vencida | `apps/api/src/modules/sla/`: SLA de respuesta y de resolución por nivel, aviso al 80 %, sube un nivel al vencer y marca la incidencia como vencida |
| Estados con reglas por rol | `TRANSITION_RULES` en `packages/shared/src/domain/transition-policy.ts`. Pendiente, En proceso, Resuelto, Verificado. Un estudiante nunca marca Resuelto |
| Historial con tiempo por etapa | `StatusHistory` guarda la duración de cada etapa; se ve como línea de tiempo y barra de etapas en el detalle |
| Panel | `/panel`: vencidas, tiempo promedio y mediana de resolución por prioridad, espacios con más reportes, cumplimiento de SLA y mapa de calor por bloque y categoría |

## Requisitos para correrlo

- Node.js 20 o superior
- Docker (para PostgreSQL con pgvector)

## Puesta en marcha

```bash
npm install
cp .env.example .env          # en Windows: copy .env.example .env
npm run db:up                 # Postgres en el puerto 5434
npm run db:migrate
npm run db:seed               # 2 sedes, 6 bloques, 38 espacios, 10 usuarios y unas 60 incidencias con una semana de historia
npm run dev                   # API con tsx watch y web con Vite HMR
```

Abre `http://localhost:5173`. Si en ese puerto ves otra aplicación (por un service worker viejo de otro proyecto), usa `http://127.0.0.1:5173`.

La vista se elige sola por tamaño de pantalla. Para forzarla agrega `?view=desktop`, `?view=mobile` o `?view=projector` a la URL; `?view=auto` vuelve al modo automático.

### Usuarios de prueba

Con `ALLOW_DEV_LOGIN=true` la pantalla de ingreso ofrece acceso rápido por rol. Todos usan la contraseña `campus123`.

| Rol | Correo |
|---|---|
| Supervisor | `supervisor@campus.edu.co` |
| Técnico | `tecnico1@campus.edu.co` a `tecnico3@campus.edu.co` |
| Estudiante | `estudiante1@campus.edu.co` a `estudiante6@campus.edu.co` |

### Probar desde un celular

`npm run dev:phone` sirve la web por HTTPS con un certificado local, necesario para la cámara (QR y fotos) y el dictado por voz. El celular debe estar en la misma red; el modo proyector y "Mis reportes" muestran un QR con la dirección correcta.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | API y web con recarga en caliente |
| `npm run dev:phone` | Igual, con HTTPS para probar en el celular |
| `npm run simulate` | Simulador de reportes para la demo (ver abajo) |
| `npm test` | Pruebas de dominio con vitest |
| `npm run lint` | Verifica que no haya emojis y corre ESLint |
| `npm run typecheck` | TypeScript en todos los paquetes |
| `npm run build` | Build de producción de la web |
| `npm run db:seed` | Borra y vuelve a sembrar los datos de demo |
| `npm run db:studio` | Prisma Studio |
| `npm run models` | Optimiza los modelos 3D de `assets-src/` |

## Demo

- **Simulador:** con la API corriendo, `npm run simulate` envía un reporte cada 6 segundos como si fueran estudiantes. Varias personas reportan el mismo daño con otras palabras y en puntos cercanos del salón, así que la agrupación se ve en vivo. Opciones: `npm run simulate -- --interval 4 --count 20`.
- **SLA acelerado:** `SLA_TIME_SCALE=60` en `.env` hace que una hora de SLA dure un minuto; el job revisa cada 10 segundos. Reinicia la API después de cambiarlo.
- **Modo proyector:** `?view=projector` muestra el campus 3D a pantalla completa con lo más urgente, un ticker en vivo y un QR para reportar.
- **Repetición:** la barra inferior del gemelo digital reproduce la semana del seed a 1, 6 o 24 horas por segundo.

El guion paso a paso está en [`docs/guion-demo.md`](docs/guion-demo.md) y la explicación de la fórmula y la similitud, con ejemplos numéricos, en [`docs/formula-y-similitud.md`](docs/formula-y-similitud.md).

## Arquitectura

```
apps/api          Fastify 5 + Prisma + zod. Un módulo por dominio en src/modules/
apps/web          React 19 + Vite + Tailwind v4 + framer-motion + React Three Fiber
packages/shared   Dominio puro en TypeScript: prioridad, SLA, transiciones, similitud y textos
```

- **Dominio compartido:** la misma función calcula la prioridad en la API y en la vista previa del celular, así que lo que el estudiante ve antes de enviar es lo que el sistema guarda.
- **Módulos aislados:** ningún módulo de la API lee tablas de otro. Se comunican por su servicio público o por eventos (`IncidentCreated`, `IncidentGrouped`, `StatusChanged`, `SlaBreached`, ...). El módulo de tiempo real reenvía esos eventos por WebSocket.
- **Escalamiento seguro con varias réplicas:** la pasada de SLA toma filas con `FOR UPDATE SKIP LOCKED`.
- **3D con respaldo:** las escenas se cargan con `React.lazy`. Si el equipo no tiene GPU suficiente (según `detect-gpu`), se muestra un plano isométrico SVG con la misma información.
- **Errores al usuario:** siempre `{ error, field? }` en español, nunca trazas.

## Despliegue

Un solo servicio web: Fastify sirve el build de Vite y la API en `0.0.0.0:$PORT`, más una base PostgreSQL.

```bash
npm ci --include=dev && npm run build && npm run db:deploy && npm run db:seed:once   # build
npm start                                                                            # inicio
```

`db:seed:once` solo carga los datos de demostración si la base está vacía, así que los despliegues siguientes conservan lo que se haya reportado. Se instalan las dependencias de desarrollo porque el servidor corre con `tsx` y el build usa Vite y Prisma.

Variables necesarias: `DATABASE_URL`, `JWT_SECRET` (32 caracteres o más), `NODE_ENV=production`, `CORS_ORIGIN` y `STORAGE_DRIVER=database`, porque el disco de plataformas como Render se borra en cada despliegue. `ALLOW_DEV_LOGIN` debe quedar apagado fuera de la demo.

## Créditos

Recursos gratuitos y de uso libre, detallados en [`CREDITS.md`](CREDITS.md). Íconos de Lucide; sin emojis en ningún lugar del proyecto.
