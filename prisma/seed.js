import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear roles
  console.log('📝 Creando roles...');
  const roles = await Promise.all([
    prisma.roles.upsert({
      where: { nombre: 'Alumno' },
      update: {},
      create: {
        nombre: 'Alumno',
        descripcion: 'Estudiante de la academia'
      }
    }),
    prisma.roles.upsert({
      where: { nombre: 'Profesor' },
      update: {},
      create: {
        nombre: 'Profesor',
        descripcion: 'Instructor de clases'
      }
    }),
    prisma.roles.upsert({
      where: { nombre: 'Administrador' },
      update: {},
      create: {
        nombre: 'Administrador',
        descripcion: 'Administrador del sistema'
      }
    })
  ]);

  console.log(`✅ ${roles.length} roles creados`);

  // Crear tipos de documento
  console.log('📝 Creando tipos de documento...');
  const tiposDoc = await Promise.all([
    prisma.tipos_documento.upsert({
      where: { id: 'DNI' },
      update: {},
      create: {
        id: 'DNI',
        descripcion: 'Documento Nacional de Identidad'
      }
    }),
    prisma.tipos_documento.upsert({
      where: { id: 'CE' },
      update: {},
      create: {
        id: 'CE',
        descripcion: 'Carnet de Extranjería'
      }
    }),
    prisma.tipos_documento.upsert({
      where: { id: 'PASAPORTE' },
      update: {},
      create: {
        id: 'PASAPORTE',
        descripcion: 'Pasaporte'
      }
    })
  ]);

  console.log(`✅ ${tiposDoc.length} tipos de documento creados`);

  console.log('🎉 Seed completado exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
