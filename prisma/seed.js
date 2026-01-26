import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // --- 1. ROLES (Ya lo tenías) ---
  console.log('📝 Verificando roles...');
  const roles = await Promise.all([
    prisma.roles.upsert({
      where: { nombre: 'Alumno' },
      update: {},
      create: { nombre: 'Alumno', descripcion: 'Estudiante de la academia' },
    }),
    prisma.roles.upsert({
      where: { nombre: 'Profesor' },
      update: {},
      create: { nombre: 'Profesor', descripcion: 'Instructor de clases' },
    }),
    prisma.roles.upsert({
      where: { nombre: 'Administrador' },
      update: {},
      create: { nombre: 'Administrador', descripcion: 'Administrador del sistema' },
    }),
  ]);

  // --- 2. TIPOS DE DOCUMENTO (Ya lo tenías) ---
  console.log('📝 Verificando tipos de documento...');
  await Promise.all([
    prisma.tipos_documento.upsert({
      where: { id: 'DNI' },
      update: {},
      create: { id: 'DNI', descripcion: 'Documento Nacional de Identidad' },
    }),
    prisma.tipos_documento.upsert({
      where: { id: 'CE' },
      update: {},
      create: { id: 'CE', descripcion: 'Carnet de Extranjería' },
    }),
    prisma.tipos_documento.upsert({
      where: { id: 'PASAPORTE' },
      update: {},
      create: { id: 'PASAPORTE', descripcion: 'Pasaporte' },
    }),
  ]);

  // =======================================================
  // NUEVOS DATOS PARA QUE FUNCIONEN LOS HORARIOS
  // =======================================================

  // --- 3. DIRECCIÓN Y SEDE ---
  // Necesitamos una dirección para tener una sede
  console.log('buildings 🏢 Verificando Sede Principal...');
  const direccion = await prisma.direcciones.upsert({
    where: { id: 1 }, // Forzamos ID 1 para el seed
    update: {},
    create: {
      direccion_completa: 'Av. del Voley 123',
      distrito: 'San Borja',
      ciudad: 'Lima',
      referencia: 'Frente al parque',
    },
  });

  const sede = await prisma.sedes.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Sede Central',
      direccion_id: direccion.id,
      telefono_contacto: '999888777',
      tipo_instalacion: 'Coliseo Cerrado',
    },
  });

  // --- 4. CANCHA ---
  // Necesitamos una cancha en esa sede (ID 1)
  console.log('court 🏐 Verificando Cancha...');
  const cancha = await prisma.canchas.upsert({
    where: { id: 1 },
    update: {},
    create: {
      sede_id: sede.id,
      nombre: 'Cancha Principal A',
      descripcion: 'Cancha de madera flotante oficial',
    },
  });

  // --- 5. NIVEL DE ENTRENAMIENTO ---
  // Necesitamos al menos un nivel (ID 1)
  console.log('level 📊 Verificando Nivel...');
  const nivel = await prisma.niveles_entrenamiento.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Formativo',
      precio_referencial: 150.00,
    },
  });

  // --- 6. PROFESOR (USUARIO + PERFIL PROFESOR) ---
  console.log('user 👨‍🏫 Verificando Profesor de prueba...');
  
  // Recuperamos el ID del rol Profesor que creamos arriba
  const rolProfesor = await prisma.roles.findUnique({ where: { nombre: 'Profesor' } });
  
  if (rolProfesor) {
    // a) Crear el Usuario base
    const usuarioProfe = await prisma.usuarios.upsert({
      where: { email: 'profe@ejemplo.com' }, // Usamos email como clave única
      update: {},
      create: {
        nombres: 'Juan',
        apellidos: 'Perez Entrenador',
        email: 'profe@ejemplo.com',
        rol_id: rolProfesor.id,
        tipo_documento_id: 'DNI',
        numero_documento: '87654321',
        genero: 'M',
        // OJO: En un caso real, aquí deberías crear también la credencial (password)
      },
    });

    // b) Crear el perfil en la tabla 'profesores'
    await prisma.profesores.upsert({
      where: { usuario_id: usuarioProfe.id },
      update: {},
      create: {
        usuario_id: usuarioProfe.id,
        especializacion: 'Voley Formativo y Táctico',
        tarifa_hora: 50.00,
      },
    });
  }

  console.log('🎉 Seed completado: ¡Ya puedes crear horarios!');
  console.log(`ℹ️ Datos para tus pruebas:
    - Cancha ID: ${cancha.id}
    - Nivel ID: ${nivel.id}
    - Profesor (Usuario ID): Usar el ID que tenga el email 'profe@ejemplo.com' en tu BD
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });