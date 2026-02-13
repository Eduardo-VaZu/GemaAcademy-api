import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed maestro de la Academia GEMA...');

  // =================================================================
  // 1. ROLES Y DOCUMENTOS (CIMIENTOS) 🏗️
  // =================================================================
  console.log('📝 Configurando Roles y Documentos...');
  
  // Roles
  await Promise.all([
    prisma.roles.upsert({ where: { nombre: 'Alumno' }, update: {}, create: { nombre: 'Alumno', descripcion: 'Estudiante' } }),
    prisma.roles.upsert({ where: { nombre: 'Profesor' }, update: {}, create: { nombre: 'Profesor', descripcion: 'Instructor' } }),
    prisma.roles.upsert({ where: { nombre: 'Administrador' }, update: {}, create: { nombre: 'Administrador', descripcion: 'Admin total' } }),
  ]);

  const rolProfe = await prisma.roles.findUnique({ where: { nombre: 'Profesor' } });
  const rolAlumno = await prisma.roles.findUnique({ where: { nombre: 'Alumno' } });
  const rolAdmin = await prisma.roles.findUnique({ where: { nombre: 'Administrador' } });

  if (!rolProfe || !rolAlumno || !rolAdmin) throw new Error("❌ Error: No se encontraron los roles.");

  // Documentos
  await Promise.all([
    prisma.tipos_documento.upsert({ where: { id: 'DNI' }, update: {}, create: { id: 'DNI', descripcion: 'Documento Nacional de Identidad' } }),
    prisma.tipos_documento.upsert({ where: { id: 'CE' }, update: {}, create: { id: 'CE', descripcion: 'Carnet de Extranjería' } }),
    prisma.tipos_documento.upsert({ where: { id: 'PAS' }, update: {}, create: { id: 'PAS', descripcion: 'Pasaporte' } }),
  ]);

  // =================================================================
  // 2. USUARIOS ADMINISTRATIVOS 👮
  // =================================================================
  console.log('👮 Creando Admin y Profesor...');

  // Admin - Corregido para usar username como identificador único
  await prisma.usuarios.upsert({
    where: { username: 'admin.gema' },
    update: {},
    create: {
      username: 'admin.gema',
      nombres: 'Super', 
      apellidos: 'Admin', 
      email: 'admin@gema.com',
      rol_id: rolAdmin.id, 
      tipo_documento_id: 'DNI', 
      numero_documento: '00000001', 
      telefono_personal: '900000000',
      activo: true
    },
  });

  // Profesor - Corregido para asegurar username único
  const usuarioProfe = await prisma.usuarios.upsert({
    where: { username: 'carlos.coach' },
    update: {},
    create: {
      username: 'carlos.coach',
      nombres: 'Carlos', 
      apellidos: 'Coach', 
      email: 'coach@gema.com',
      rol_id: rolProfe.id, 
      tipo_documento_id: 'DNI', 
      numero_documento: '10203040',
      activo: true
    },
  });

  await prisma.profesores.upsert({
    where: { usuario_id: usuarioProfe.id },
    update: {},
    create: { usuario_id: usuarioProfe.id, especializacion: 'Voley Alto Rendimiento' },
  });

  // =================================================================
  // 3. INFRAESTRUCTURA 🏢 (Se mantiene igual)
  // =================================================================
  console.log('🏢 Configurando Sede y Cancha...');

  const direccion = await prisma.direcciones.upsert({
    where: { id: 1 },
    update: {},
    create: { direccion_completa: 'Av. del Deporte 123', distrito: 'San Borja', ciudad: 'Lima' },
  });

  const sede = await prisma.sedes.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: 'Sede Central', direccion_id: direccion.id, tipo_instalacion: 'Coliseo' },
  });

  const cancha = await prisma.canchas.upsert({
    where: { id: 1 },
    update: {},
    create: { sede_id: sede.id, nombre: 'Cancha A (Principal)', descripcion: 'Piso flotante' },
  });

  const nivel = await prisma.niveles_entrenamiento.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: 'Formativo', precio_referencial: 0 }, 
  });

  // =================================================================
  // 4. PARÁMETROS DEL SISTEMA (Se mantiene igual)
  // =================================================================
  console.log('🧠 Inyectando Parámetros del Sistema...');
  
  const parametrosSistema = [
    { clave: 'TIEMPO_LIMITE_RESERVA_MIN', valor: '20', descripcion: 'Minutos para pagar reserva' },
    { clave: 'DIAS_TOLERANCIA_PAGO', valor: '3', descripcion: 'Días tolerancia pago' },
    { clave: 'DIAS_TOLERANCIA_VENCIMIENTO', valor: '5', descripcion: 'Días gracia vencimiento' },
    { clave: 'DIAS_ANTICIPACION_RENOVACION', valor: '5', descripcion: 'Días anticipación deuda' }
  ];

  for (const param of parametrosSistema) {
    await prisma.parametros_sistema.upsert({
      where: { clave: param.clave },
      update: { valor: param.valor, descripcion: param.descripcion },
      create: param
    });
  }

  // =================================================================
  // 5. CATÁLOGO DE PRECIOS (Se mantiene igual)
  // =================================================================
  console.log('💰 Configurando Catálogo de Precios...');

  const conceptos = [
    { codigo: 'MENSUAL_1_DIA_2026', nombre: 'Mensualidad Básica (1 vez x semana)', precio: 150.00, clases: 1, vigente: true },
    { codigo: 'MENSUAL_2_DIA_2026', nombre: 'Plan Estándar (2 veces x semana)', precio: 280.00, clases: 2, vigente: true },
    { codigo: 'MENSUAL_3_DIA_2026', nombre: 'Plan Intensivo (3 veces x semana)', precio: 400.00, clases: 3, vigente: true },
  ];

  for (const c of conceptos) {
    await prisma.catalogo_conceptos.upsert({
      where: { codigo_interno: c.codigo },
      update: { nombre: c.nombre, precio_base: c.precio, cantidad_clases_semanal: c.clases, es_vigente: c.vigente },
      create: {
        codigo_interno: c.codigo,
        nombre: c.nombre,
        precio_base: c.precio,
        cantidad_clases_semanal: c.clases,
        es_vigente: c.vigente,
        activo: true
      }
    });
  }

  // =================================================================
  // 6. MÉTODOS DE PAGO (Se mantiene igual)
  // =================================================================
  const metodos = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'];
  for (const nombre of metodos) {
    await prisma.metodos_pago.upsert({
      where: { nombre: nombre },
      update: {},
      create: { nombre: nombre, activo: true }
    });
  }

  // =================================================================
  // 7. ALUMNO DE PRUEBA: "JAVIER" 🧪
  // =================================================================
  console.log('🧪 Creando Alumno de Prueba (Javier)...');

  // Corregido para usar username único
  const usuarioJavier = await prisma.usuarios.upsert({
    where: { username: 'javier.prueba' },
    update: {},
    create: {
      username: 'javier.prueba',
      nombres: 'Javier', 
      apellidos: 'Prueba', 
      email: 'javier@prueba.com',
      rol_id: rolAlumno.id, 
      tipo_documento_id: 'DNI', 
      numero_documento: '88888888', 
      telefono_personal: '999999999',
      activo: true
    },
  });

  await prisma.alumnos.upsert({
    where: { usuario_id: usuarioJavier.id },
    update: {},
    create: { usuario_id: usuarioJavier.id, condiciones_medicas: 'Ninguna', seguro_medico: 'Pacífico' }
  });

  console.log('✅✅ SEED MAESTRO COMPLETADO.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal en el Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });