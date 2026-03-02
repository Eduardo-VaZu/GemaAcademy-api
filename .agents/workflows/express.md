---
trigger: always_on
---

# GemaAcademy API - Guía de Desarrollo & Arquitectura "Antigravity"

Este documento define las reglas estrictas de desarrollo para el proyecto GemaAcademy API. El objetivo principal es la velocidad extrema ("Antigravity"), la escalabilidad y la limpieza del código usando Clean Architecture (Vertical Slicing).

## 1. Stack Tecnológico
- **Runtime:** Node.js (ES Modules).
- **Framework:** Express.js.
- **ORM:** Prisma (PostgreSQL).
- **Validación:** Zod.
- **Logging:** Winston.
- **Entorno:** Docker / Docker Compose.

## 2. Arquitectura: Vertical Slicing
No agrupamos por "capas" técnicas (Controllers, Services), agrupamos por Features (Dominios).

**Estructura de Directorios:**
Todo el código relacionado con una entidad debe vivir en su propia carpeta dentro de `src/features/`.
```text
src/
└── features/
    ├── [nombre-entidad]/       # Ej: inscripciones, alumnos
    │   ├── [entidad].routes.js     # Definición de endpoints
    │   ├── [entidad].controller.js # Manejo de Request/Response HTTP
    │   ├── [entidad].service.js    # Lógica de negocio y llamadas a Prisma
    │   └── [entidad].schema.js     # (Opcional) Schemas locales de Zod
```

## 3. Reglas de Optimización "Antigravity" (Performance Crítico)

### 3.1 Cero Bloqueo en Bucles (Regla de Oro)
**PROHIBIDO** realizar llamadas `await` (BD o API externa) dentro de un bucle `for`, `forEach`, `map` o `while` de forma secuencial.

❌ **MAL (Bloqueante):**
```javascript
for (const item of items) {
  await prisma.inscripcion.create({ ... }); // Detiene el servidor por cada iteración
}
```

✅ **BIEN (Antigravity):**
Usa `Promise.all` para concurrencia o métodos de escritura por lotes (`createMany`).
```javascript
// Opción A: Escritura en Lote (Preferido)
await prisma.inscripcion.createMany({ data: listaDeInscripciones });

// Opción B: Concurrencia (Si createMany no es posible)
await Promise.all(items.map(item => servicio.procesarItem(item)));
```

### 3.2 Prisma Selectivo (Lean Queries)
Nunca traigas objetos completos de la base de datos si no los necesitas. Reduce el uso de memoria y ancho de banda.

✅ **BIEN:**
```javascript
const user = await prisma.usuario.findUnique({
  where: { id },
  select: { id: true, nombre: true, email: true } // Solo lo necesario
});
```

### 3.3 Transacciones Inteligentes
Para operaciones que modifican múltiples tablas (ej. Inscribir alumno + Actualizar cupo + Generar deuda), usa SIEMPRE `prisma.$transaction`.

## 4. Estándares de Código y Controladores

### 4.1 Manejo de Errores (Clean Code)
No uses bloques `try/catch` explícitos en los controladores (a menos que dependas de errores de motor tipo P2025 específicos). Envuelve las funciones del controlador con el utilitario `catchAsync`.

```javascript
// feature.controller.js
import { catchAsync } from '../../shared/utils/catchAsync.util.js';

export const getItem = catchAsync(async (req, res) => {
  const data = await featureService.getData(req.params.id);
  successResponse(res, data);
});
```

### 4.2 Responses Estandarizados
Usa siempre los utilitarios de respuesta para mantener consistencia en el JSON devuelto al cliente.
- **Éxito:** `apiResponse.success(res, data, message)`
- **Error:** Generalmente manejado por el middleware de error global.

## 5. Seguridad y Validación

### 5.1 Validación Temprana (Fail Fast)
Toda entrada de datos (`req.body`, `req.query`, `req.params`) debe ser validada por un middleware de Zod ANTES de llegar al controlador.
Si la data es inválida, el servidor debe rechazarla inmediatamente (400 Bad Request) sin procesar lógica.

### 5.2 Autenticación y Contexto
El middleware `authenticate` verifica el JWT e inyecta el usuario en `req.user`. No vuelvas a consultar la BD por el usuario en el controlador si `req.user` ya tiene la info necesaria (id, rol, email).

## 6. Convenciones de Nombres (Naming)
- **Variables y Funciones:** `camelCase` (ej. `crearUsuario`, `isActive`).
- **Archivos:** `kebab-case` (ej. `usuario.controller.js`, `auth.routes.js`).
- **Base de Datos:** `snake_case` (según schema de Prisma).
- **Idioma:** Código y Lógica de Negocio en **Español**. Librerías y Keywords en **Inglés**.

## 7. Git & Flujo de Trabajo
- **Commits Semánticos:** `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`.
- **Pre-commit:** El código debe pasar ESLint y Prettier.

---

## 8. Reglas Avanzadas de Base de Datos y Prisma (Agregado)

### 8.1 Adiós al N+1 (Prohibido queries en bucle)
Jamás obtengas una lista de registros y luego iteres sobre ellos para hacer un `await prisma.xyz.findUnique()` por cada uno. Prisma permite usar `include` o `select` anidados para que PostgreSQL resuelva todo en un solo JOIN veloz.

### 8.2 Paginación por Cursor (Keyset Pagination) Obligatoria
Para listas que crecerán masivamente (millones de filas), está **PROHIBIDO** usar `skip` (offset) y `take` (limit) profundos. Se debe usar Paginación por Cursor (`cursor` en Prisma, basado en `id` o fecha) para que los índices de PostgreSQL respondan en 10ms sin importar la página en la que estés.

## 9. Control de Concurrencia (Race Conditions)

### 9.1 Bloqueo Optimista (Optimistic Locking) para Cupos y Dinero
Cuando múltiples peticiones intenten disminuir/aumentar un cupo limitante a la vez (ej. Inscripción a curso sin cupos), el código debe prevenir inscripciones "fantasma". Se debe usar actualización condicional de Prisma:

```javascript
// Antigravity: Update atómico asegurando cupo restante.
const updated = await prisma.curso.updateMany({
  where: { id: cursoId, cupos_disponibles: { gt: 0 } },
  data: { cupos_disponibles: { decrement: 1 } }
});
if (updated.count === 0) throw new Error("Cupos agotados o curso no encontrado");
```

## 10. Resiliencia y Logging (Observabilidad)

### 10.1 Logging Estructurado No Bloqueante
Prohibido usar `console.log` para trazas de sistema en caliente, frena el Event Loop levemente. Todo log vital en producción debe hacerse con Winston.

### 10.2 Timeout y Retries para APIs Externas
Toda llamada `fetch` o `axios` a proveedores externos (ej. Envío de correos, pasarelas de pago) debe tener un Timeout estricto de máximo 5 segundos. La API de GemaAcademy no debe quedar paralizada si SendGrid demora en contestar.

## 11. Caché e Inmutabilidad Esencial

### 11.1 Cacheo de Catálogos Constantes
Datos maestros estáticos (lista de sedes, lista de países, nomencladores) no deben consultarse a Prisma en cada request. Deben cargarse en memoria (Memory Cache) al iniciar el servidor y reutilizarse infinitamente.

## 12. Workflow: Análisis de Features

Cuando el usuario solicite analizar un feature (`analiza el feature de @[src/features/X]`), sigue estos pasos:

### 12.1 Leer todos los archivos del feature
Lee todos los archivos dentro del directorio del feature (routes, controller, service, schema, constants, etc).

### 12.2 Diagnosticar violaciones
Compara el código contra estas directrices y genera una tabla de violaciones:
- §3.1 Cero Bloqueo (await en bucle)
- §3.2 Prisma Selectivo (include: true, sin select)
- §3.3 Transacciones (operaciones multi-tabla sin $transaction)
- §4.1 Manejo de Errores (try/catch explícito en vez de catchAsync)
- §4.2 Responses Estandarizados (res.json manual en vez de apiResponse)
- §5.1 Validación Temprana (parseInt/isNaN redundante, validación que Zod ya cubre)
- §5.2 Autenticación (rutas sin authenticate/authorize)
- Seguridad, bugs, código muerto, DRY

### 12.3 Generar plan de implementación
Crea un `implementation_plan.md` como artifact con:
- Tabla de violaciones
- Cambios propuestos por archivo
- Plan de verificación

### 12.4 Esperar aprobación y ejecutar
Usa `notify_user` para que el usuario revise y apruebe.

### 12.5 Generar documentación técnica del feature
Después de ejecutar los cambios, **SIEMPRE** crea un archivo `[NOMBRE_FEATURE].md` **dentro del directorio del feature** (`src/features/X/FEATURE.md`) con:

- **Estructura de Archivos** — lista de archivos y su responsabilidad
- **Modelo de Datos** — diagrama Mermaid ER de las tablas involucradas
- **Endpoints** — tabla con método, ruta, auth requerida, descripción
- **Flujo de Datos** — diagrama secuencial de cómo fluye un request
- **Schemas Zod** — tabla explicando cada schema (qué valida, dónde se usa)
- **Service detallado** — cada función explicada con lógica de negocio clave
- **Cadena de Middlewares** — qué middlewares protegen cada ruta

> IMPORTANTE: Esta documentación se genera SIEMPRE al finalizar el análisis/refactorización de un feature, sin necesidad de que el usuario lo pida explícitamente.
