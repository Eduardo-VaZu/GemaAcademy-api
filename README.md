# GemaAcademy API

API REST para GemaAcademy - Sistema de gestión de academia deportiva. Construido bajo la arquitectura **"Antigravity"** (Clean Architecture, Vertical Slicing, alto rendimiento).

## Requisitos Previos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [Docker](https://www.docker.com/) y Docker Compose
- [Git](https://git-scm.com/)

## Instalación y Ejecución desde Cero

Sigue estos pasos paso a paso para levantar el entorno de desarrollo local:

### 1. Clonar el repositorio y dependencias

Primero, instala las dependencias de Node.js:

```bash
git clone <url-del-repo>
cd GemaAcademy-api

# Instala todas las dependencias del proyecto
npm install
```

### 2. Configurar Variables de Entorno

El proyecto necesita variables de configuración para funcionar.

1. Copia el archivo `.env.template` o crea un archivo `.env` en la raíz del proyecto.
   ```bash
   cp .env.template .env
   ```
2. Asegúrate de tener las siguientes variables configuradas (por defecto vienen preparadas para funcionar con el Docker local):
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:root@localhost:5432/gema_academy_db?schema=public"
   ```

### 3. Levantar la Base de Datos (Docker)

El proyecto utiliza PostgreSQL. Para instalarlo y correrlo sin complicaciones, usamos Docker.

```bash
# Inicia el contenedor de base de datos en segundo plano
docker-compose up -d
```
Esto levantará la base de datos `gema_academy_db` exponiendo el puerto `5432`.

### 4. Configurar Prisma (ORM) y Base de Datos

Una vez que la base de datos esté corriendo, debes sincronizar las tablas de la base de datos y generar el cliente que conecta el código con la DB:

```bash
# Sincroniza el esquema de tu código con la base de datos real (Crea las tablas)
npm run db:push

# Genera el Prisma Client para poder interactuar desde Node
npm run db:generate
```

*(Opcional)* Una vez migrado, si tienes datos semilla puedes poblarlos con:
```bash
npm run db:seed
```

### 5. Iniciar el Servidor

Ya tienes todo listo, ahora arranca el proyecto:

```bash
# Inicia en modo desarrollo (se actualiza automáticamente al cambiar un archivo)
npm run dev
```

El servidor estará escuchando en `http://localhost:5000`. 
Puedes comprobar su estado en su ruta de diagnóstico: **http://localhost:5000/health**

---

## Comandos Útiles a diario

Aquí tienes comandos clave para tu día a día:

- `npm run dev`: Levantar el entorno local de código.
- `docker-compose up -d`: Levantar tu base de datos si reiniciaste la computadora.
- `npm run db:studio`: Abre una interfaz web interactiva (Prisma Studio) para revisar, editar o borrar datos en tu base de datos fácilmente desde el navegador.
- `npm run db:push`: Si cambias algo en `schema.prisma`, debes ejecutar esto para actualizar la base de datos.

## Guía de Arquitectura "Antigravity"

Este proyecto sigue nuestras estrictas reglas de rendimiento y limpieza:
- **Estructura por Features (Vertical Slicing):** Todo el código vive agrupado según dominio dentro de `src/features/[feature]/`.
- **Cero bloqueos:** Prohibido el uso de `await` dentro de bucles secuenciales. Todo el código aprovecha `Promise.all` y escrituras en lote.
- **Consultas (Lean Queries):** Siempre especificar usando `select` los únicos campos necesarios, optimizando memoria base.
- **Fail Fast:** Entradas de usuario invalidadas por esquemas de verificación usando **Zod** antes del control. Funcionalidad `catchAsync` por defecto en rutas de API.
