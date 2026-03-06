---
description: express
---

# GemaAcademy API - Guía "Antigravity"

Reglas estrictas: velocidad extrema, escalabilidad, Clean Architecture (Vertical Slicing).

## 1. Stack
Node.js (ESM) · Express · Prisma (PostgreSQL) · Zod · Winston · Docker

## 2. Arquitectura: Vertical Slicing
Agrupamos por **Features**, no por capas técnicas. Cada entidad vive en `src/features/`.

```text
src/
├── config/                     # cloudinary, cookie, database, secret .config.js
├── shared/
│   ├── middlewares/             # auth, authorize, error, rateLimit, upload, validate
│   ├── services/                # brevo.email.service.js, twilio.whatsapp.service.js
│   ├── utils/                   # catchAsync, error, logger, response .util.js
│   └── validation/              # common.validation.js (Zod compartidos)
├── features/[entidad]/
│   ├── [entidad].routes.js      # Endpoints
│   ├── [entidad].controller.js  # Request/Response HTTP
│   ├── [entidad].service.js     # Lógica de negocio + Prisma
│   ├── [entidad].schema.js      # Schemas Zod locales
│   ├── validators/              # (Opcional) Validación imperativa
│   ├── utils/                   # (Opcional) Helpers del feature
│   ├── logic/                   # (Opcional) Lógica extraída del service
│   ├── services/                # (Opcional) Servicios auxiliares
│   └── middlewares/             # (Opcional) Middlewares exclusivos
```

### 2.1 `shared/` — Código transversal agnóstico al dominio

| Package | Propósito | Naming |
|---|---|---|
| `middlewares/` | Auth, validate, error | `[nombre].middleware.js` |
| `services/` | APIs externas (Brevo, Twilio) | `[proveedor].[tipo].service.js` |
| `utils/` | Funciones puras | `[nombre].util.js` |
| `validation/` | Schemas Zod usados por ≥2 features | `[dominio].validation.js` |

> Si menciona "inscripción", "pago" o "usuario" en su lógica → NO pertenece a `shared/`.

### 2.2 Sub-packages de Feature
Crear solo cuando el feature crece más allá de los 4 archivos base:

| Sub-package | Criterio | Naming |
|---|---|---|
| `validators/` | Validación imperativa >30 líneas | `[entidad].validator.js` |
| `utils/` | Helpers de formato/cálculo propios | `[entidad].util.js` |
| `logic/` | Service supera ~300 líneas | `[entidad].logic.js` |
| `services/` | Crons, notificaciones, integraciones | `[nombre].service.js` |
| `middlewares/` | Middleware exclusivo del feature | `[entidad].middleware.js` |

> No crear sub-packages vacíos o con <20 líneas.

### 2.3 ¿`shared/` o Feature-local?
- ¿Lo usan ≥2 features? → `shared/`
- ¿Es infra transversal (auth, error, logging)? → `shared/`
- Si no → Feature-local (promover a `shared/` cuando un segundo feature lo necesite)

### 2.4 Organización de Archivos (Obligatorio)
Cada archivo: **propósito único**. Criterios de reorganización:

| Criterio | Acción |
|---|---|
| Service/Controller >300 líneas | Extraer a `logic/` o sub-servicio |
| Schema/Util >150 líneas | Dividir por dominio |
| Función usada por otro feature | Mover a `shared/` |
| Naming incorrecto (§2.1/§2.2) | Renombrar |
| Archivo sin imports (dead file) | Eliminar |
| Lógica de negocio en controller | Mover al service |
| Lógica de infra en service | Extraer a `services/` |

**Responsabilidad por archivo:**
- **routes.js** — Solo rutas + middlewares. **controller.js** — Solo `catchAsync` → service → `apiResponse` (~5 líneas/handler).
- **service.js** — Lógica de negocio + Prisma (>300 líneas → `logic/`). **schema.js** — Solo Zod (>150 → dividir).

## 3. Optimización "Antigravity"

### 3.1 Cero `await` en Bucles
**PROHIBIDO** `await` secuencial dentro de `for`/`forEach`/`map`/`while`.

```javascript
// ❌ MAL
for (const item of items) { await prisma.inscripcion.create({...}); }

// ✅ Opción A: Lote (preferido)
await prisma.inscripcion.createMany({ data: listaDeInscripciones });
// ✅ Opción B: Concurrencia
await Promise.all(items.map(item => servicio.procesarItem(item)));
```

> **Límite:** Para >50 elementos, usar `p-limit` para no saturar el pool de Prisma:
```javascript
import pLimit from 'p-limit';
const limit = pLimit(10);
await Promise.all(items.map(item => limit(() => servicio.procesarItem(item))));
```

### 3.2 Prisma Selectivo
Nunca traer objetos completos. Siempre usar `select` con solo los campos necesarios.

### 3.3 Transacciones
Operaciones multi-tabla → SIEMPRE `prisma.$transaction`.

## 4. Estándares de Código

### 4.1 Manejo de Errores
No `try/catch` en controllers (salvo errores Prisma tipo P2025). Usar `catchAsync`:

```javascript
import { catchAsync } from '../../shared/utils/catchAsync.util.js';
import { apiResponse } from '../../shared/utils/response.util.js';

export const getItem = catchAsync(async (req, res) => {
  const data = await featureService.getData(req.params.id);
  apiResponse.success(res, data, 'Item obtenido');
});
```

### 4.2 Responses
- **Éxito:** `apiResponse.success(res, data, message)`
- **Error:** Manejado por middleware de error global.

### 4.3 Legibilidad: Extracción de Métodos (Obligatorio)
Refactorizar cuando una función cumple CUALQUIERA: >40 líneas, >3 niveles de anidación, >1 responsabilidad, o tiene comentarios `// Paso N:`.

**Reglas:** Una función = una tarea. Nombre describe **qué** hace (verbo infinitivo: `calcularDeuda`, `validarCupos`). Si hay <5 funciones extraídas → mismo archivo, si más → `logic/[entidad].logic.js`.

```javascript
// ❌ MAL — monolítico: valida + calcula + persiste + notifica en una función
export const inscribirAlumno = async (data) => {
  const curso = await prisma.curso.findUnique({ where: { id: data.cursoId } });
  if (!curso || curso.cupos_disponibles <= 0) throw new AppError('Sin cupos');
  const precioFinal = curso.precio * (1 - (data.esBecado ? 0.5 : 0));
  const inscripcion = await prisma.$transaction(async (tx) => { /* crear + update + deuda */ });
  await emailService.enviarConfirmacion(data.email, inscripcion);
  return inscripcion;
};

// ✅ BIEN — cada función hace una sola cosa
export const inscribirAlumno = async (data) => {
  const curso = await obtenerCursoConCupos(data.cursoId);
  const precio = calcularPrecioConDescuento(curso.precio, data.esBecado);
  const inscripcion = await ejecutarInscripcion(data, curso, precio);
  await notificarInscripcion(data.email, inscripcion);
  return inscripcion;
};
```

> En §12: reportar como **"§4.3 Legibilidad — función monolítica"**.

## 5. Seguridad y Validación

### 5.1 Fail Fast
Toda entrada (`req.body`, `req.query`, `req.params`) validada por middleware Zod ANTES del controller. Data inválida → 400 inmediato.

### 5.2 Autenticación
`authenticate` verifica JWT e inyecta `req.user`. No re-consultar BD si `req.user` ya tiene id, rol, email.

## 6. Naming
- Variables/Funciones: `camelCase` · Archivos: `kebab-case` · BD: `snake_case`
- Lógica de negocio en **Español**, keywords/librerías en **Inglés**.

## 7. Git
Commits semánticos (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`). Pre-commit: ESLint + Prettier.

---

## 8. BD y Prisma Avanzado

### 8.1 Prohibido N+1
No iterar para hacer `findUnique()` por cada registro. Usar `include`/`select` anidados para resolver en un solo JOIN.

### 8.2 Paginación por Cursor
**PROHIBIDO** `skip/take` profundos en tablas grandes. Usar `cursor` (basado en `id` o fecha).

> **Excepción:** `skip/take` permitido en tablas <10,000 filas o admin panels. Documentar con `// OFFSET OK: tabla acotada`.

## 9. Concurrencia

### 9.1 Optimistic Locking (Cupos/Dinero)
Update atómico condicional para prevenir race conditions:

```javascript
const updated = await prisma.curso.updateMany({
  where: { id: cursoId, cupos_disponibles: { gt: 0 } },
  data: { cupos_disponibles: { decrement: 1 } }
});
if (updated.count === 0) throw new Error("Cupos agotados");
```

## 10. Resiliencia y Logging

### 10.1 Logging
Prohibido `console.log` en producción. Usar Winston para todo log estructurado.

### 10.2 Timeout y Retries
Timeout de **5s** en toda llamada a APIs externas. Patrón de retries:
- Máximo **3 reintentos** con backoff exponencial (`500ms → 1s → 2s`)
- Solo reintentar errores transitorios (timeouts, 502/503/504). No reintentar 4xx.

```javascript
async function fetchConRetry(url, opts, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(5000) });
      if (r.ok) return r;
      if (r.status < 500) throw new Error(`${r.status}`);
    } catch (e) { if (i === retries) throw e; await new Promise(w => setTimeout(w, 500 * 2**i)); }
  }
}
```

## 11. Caché

### 11.1 Catálogos en Memoria
Datos estáticos (sedes, países) → cargar en Memory Cache al iniciar. No consultar Prisma por request.

**Invalidación:** TTL (ej. 60 min) · Endpoint admin `POST /admin/cache/invalidate/:key` · Invalidar en escritura tras `update`/`create`.

## 12. Workflow: Análisis de Features

Cuando el usuario solicite analizar un feature (`analiza el feature de @[src/features/X]`):

1. **Leer** todos los archivos del feature
2. **Diagnosticar** violaciones contra §2-§11:
   - §2.4 Estructura: archivos >300 líneas, naming incorrecto, lógica en controller, dead files, funciones que deberían estar en `shared/`
   - §3.1 Cero Bloqueo (await en bucle)
   - §3.2 Prisma Selectivo (sin select)
   - §3.3 Transacciones (multi-tabla sin $transaction)
   - §4.1 Errores (try/catch sin catchAsync)
   - §4.2 Responses (res.json sin apiResponse)
   - §4.3 Legibilidad (funciones monolíticas >40 líneas)
   - §5.1 Validación redundante
   - §5.2 Rutas sin auth
   - Seguridad, bugs, código muerto, DRY
3. **Generar** `implementation_plan.md` con tabla de violaciones, cambios por archivo (incluyendo los cambios necesarios en `shared/` si se extrae código común), plan de verificación
4. **Esperar** aprobación vía `notify_user`
5. **Ejecutar** cambios aprobados (Si la refactorización lo requiere, asegurar que los cambios y el código extraído también se agreguen correctamente en la carpeta `shared/`)
6. **Documentar** — Crear `FEATURE.md` dentro del feature con:
   - Estructura de archivos y responsabilidades
   - Modelo de datos (Mermaid ER)
   - Endpoints (método, ruta, auth, descripción)
   - Flujo de datos (diagrama secuencial)
   - Schemas Zod (qué valida, dónde se usa)
   - Service detallado (cada función con lógica clave)
   - Cadena de middlewares por ruta

> Esta documentación se genera SIEMPRE al finalizar, sin que el usuario lo pida.

## 13. Testing
Funciones en `*.logic.js`, `*.validator.js`, `*.util.js` → unitarias (happy path, edge cases, errores). Endpoints → integración (HTTP status, JSON conforme a `apiResponse`, auth bloquea). Dir: `__tests__/`, naming: `[entidad].[tipo].test.js`, runner: Vitest/Jest. Mockear Prisma y servicios externos.