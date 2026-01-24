# GemaAcademy API - Docker Setup

## Iniciar PostgreSQL con Docker

### 1. Iniciar la base de datos

```bash
docker-compose up -d
```

### 2. Verificar que el contenedor está corriendo

```bash
docker ps
```

### 3. Ver logs de PostgreSQL

```bash
docker-compose logs -f postgres
```

### 4. Detener la base de datos

```bash
docker-compose down
```

### 5. Detener y eliminar datos (⚠️ CUIDADO)

```bash
docker-compose down -v
```

## Ejecutar Migraciones de Prisma

Una vez que PostgreSQL esté corriendo:

```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# O si ya tienes migraciones, aplicarlas
npx prisma migrate deploy

# Ejecuta la seed 
npx prisma db seed
```

## Insertar Datos Iniciales

### Opción 1: Usando Prisma Studio

```bash
npx prisma studio
```

### Opción 2: Usando SQL directo

```bash
# Conectarse al contenedor
docker exec -it gema_academy_db psql -U postgres -d gema_academy_db

# Insertar roles
INSERT INTO roles (nombre, descripcion) VALUES
('Alumno', 'Estudiante de la academia'),
('Profesor', 'Instructor de clases'),
('Administrador', 'Administrador del sistema');
```

### Opción 3: Crear un seed script

Crear archivo `prisma/seed.js` y ejecutar:

```bash
npx prisma db seed
```

## Configuración de Variables de Entorno

Asegúrate de que tu archivo `.env` tenga:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/gema_academy_db?schema=public"
```

## Troubleshooting

### Puerto 5432 ya en uso

```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :5432

# Detener PostgreSQL local si está corriendo
# O cambiar el puerto en docker-compose.yml a "5433:5432"
```

### Resetear base de datos

```bash
docker-compose down -v
docker-compose up -d
npx prisma migrate dev
```
