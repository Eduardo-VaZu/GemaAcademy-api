import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed maestro de la Academia...');

  // -------------------------------------------------------
  // 1. CONFIGURACIÓN BÁSICA Y USUARIOS 🛠️
  // -------------------------------------------------------
  
  // Roles
  console.log('📝 Verificando roles...');
  // Usamos un array para asegurar que se crean todos antes de buscar
  await Promise.all([
    prisma.roles.upsert({ where: { nombre: 'Alumno' }, update: {}, create: { nombre: 'Alumno', descripcion: 'Estudiante' } }),
    prisma.roles.upsert({ where: { nombre: 'Profesor' }, update: {}, create: { nombre: 'Profesor', descripcion: 'Instructor' } }),
    prisma.roles.upsert({ where: { nombre: 'Administrador' }, update: {}, create: { nombre: 'Administrador', descripcion: 'Admin total' } }),
  ]);
  
  // Recuperamos los roles de la BD para tener los IDs reales
  const todosLosRoles = await prisma.roles.findMany();
  
  const rolProfe = todosLosRoles.find(r => r.nombre === 'Profesor');
  const rolAlumno = todosLosRoles.find(r => r.nombre === 'Alumno');
  const rolAdmin = todosLosRoles.find(r => r.nombre === 'Administrador');

  // VALIDACIÓN DE SEGURIDAD (Esto evita que el seed explote si falla la base de datos)
  if (!rolProfe || !rolAlumno || !rolAdmin) {
    throw new Error("❌ Error crítico: No se pudieron recuperar los roles necesarios.");
  }

  // Documentos
  await Promise.all([
    prisma.tipos_documento.upsert({ where: { id: 'DNI' }, update: {}, create: { id: 'DNI', descripcion: 'DNI' } }),
    prisma.tipos_documento.upsert({ where: { id: 'CE' }, update: {}, create: { id: 'CE', descripcion: 'Carnet Extranjería' } }),
  ]);

  // ---> NUEVO: CREACIÓN DE USUARIO ADMINISTRADOR <---
  console.log('👮 Creando Usuario Administrador...');
  await prisma.usuarios.upsert({
    where: { email: 'admin@gema.com' },
    update: {},
    create: {
      nombres: 'Super', 
      apellidos: 'Administrador', 
      email: 'admin@gema.com',
      rol_id: rolAdmin.id, 
      tipo_documento_id: 'DNI', 
      numero_documento: '00000001',
      telefono_personal: '900000000'
    },
  });

  // -------------------------------------------------------
  // 2. INFRAESTRUCTURA (SEDE Y CANCHA) 🏢
  // -------------------------------------------------------
  console.log('🏢 Creando Sede y Cancha...');
  
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

  // -------------------------------------------------------
  // 3. PERSONAL (PROFESOR) 👨‍🏫
  // -------------------------------------------------------
  console.log('👨‍🏫 Creando Profesor...');
  
  const usuarioProfe = await prisma.usuarios.upsert({
    where: { email: 'coach@academia.com' },
    update: {},
    create: {
      nombres: 'Carlos', apellidos: 'El Entrenador', email: 'coach@academia.com',
      rol_id: rolProfe.id, tipo_documento_id: 'DNI', numero_documento: '10203040',
    },
  });

  await prisma.profesores.upsert({
    where: { usuario_id: usuarioProfe.id },
    update: {},
    create: { 
        usuario_id: usuarioProfe.id, 
        especializacion: 'Voley Alto Rendimiento', 
        
    },
  });

  // -------------------------------------------------------
  // 4. CATÁLOGO DE PRECIOS 💰
  // -------------------------------------------------------
  console.log('💰 Configurando Precios y Paquetes...');

  // A. Nivel de Entrenamiento
  const nivel = await prisma.niveles_entrenamiento.upsert({
    where: { id: 1 },
    update: {},
    create: { nombre: 'Vóley Formativo', precio_referencial: 0 }, 
  });

  // B. Catálogo de Conceptos
  await prisma.catalogo_conceptos.upsert({
    where: { codigo_interno: 'MENSUAL_1_DIA_2026' },
    update: {},
    create: {
      nombre: 'Mensualidad Básica (1 vez x semana)',
      codigo_interno: 'MENSUAL_1_DIA_2026',
      precio_base: 150.00,
      activo: true,
      es_vigente: true,           
      cantidad_clases_semanal: 1 
    },
  });

  await prisma.catalogo_conceptos.upsert({
    where: { codigo_interno: 'MENSUAL_2_DIA_2026' },
    update: {},
    create: {
      nombre: 'Mensualidad Estándar (2 veces x semana)',
      codigo_interno: 'MENSUAL_2_DIA_2026',
      precio_base: 280.00,
      activo: true,
      es_vigente: true,           
      cantidad_clases_semanal: 2 
    },
  });

  // C. Precio Legacy
  await prisma.catalogo_conceptos.upsert({
    where: { codigo_interno: 'MENSUAL_ANTIGUO_2024' },
    update: {},
    create: {
      nombre: 'Mensualidad Antigua (Legacy)',
      codigo_interno: 'MENSUAL_ANTIGUO_2024',
      precio_base: 100.00,
      activo: true,
      es_vigente: false,        
      cantidad_clases_semanal: 1
    },
  });

  // -------------------------------------------------------
  // 5. CONFIGURACIÓN DEL SISTEMA ⚙️
  // -------------------------------------------------------
  console.log('⚙️ Configurando reglas del sistema...');
  
  const parametros = [
    { 
      clave: 'TIEMPO_LIMITE_RESERVA_MIN', 
      valor: '20', 
      descripcion: 'Minutos que tiene un alumno nuevo para pagar antes de borrar su reserva' 
    },
    { 
      clave: 'DIAS_TOLERANCIA_PAGO', 
      valor: '3', 
      descripcion: 'Días extra que tiene un alumno antiguo para pagar su mensualidad' 
    }
  ];

  for (const param of parametros) {
    await prisma.parametros_sistema.upsert({
      where: { clave: param.clave },
      update: {}, 
      create: {
        clave: param.clave,
        valor: param.valor,
        descripcion: param.descripcion
      }
    });
  }

  // -------------------------------------------------------
  // 6. HORARIOS DE CLASE 📅
  // -------------------------------------------------------
  console.log('📅 Creando Horarios...');

  const fechaBase = '1970-01-01T'; // Fecha dummy para campos Time
  
  // Lunes 4pm
  const lunes = await prisma.horarios_clases.findFirst({ where: { dia_semana: 1, hora_inicio: new Date(`${fechaBase}16:00:00Z`) } });
  if (!lunes) {
    await prisma.horarios_clases.create({
      data: {
        cancha_id: cancha.id, profesor_id: usuarioProfe.id, nivel_id: nivel.id,
        dia_semana: 1, hora_inicio: new Date(`${fechaBase}16:00:00Z`), hora_fin: new Date(`${fechaBase}17:30:00Z`),
        capacidad_max: 20, activo: true, minutos_reserva_especifico: null
      }
    });
  }

  // Miércoles 4pm
  const miercoles = await prisma.horarios_clases.findFirst({ where: { dia_semana: 3, hora_inicio: new Date(`${fechaBase}16:00:00Z`) } });
  if (!miercoles) {
    await prisma.horarios_clases.create({
      data: {
        cancha_id: cancha.id, profesor_id: usuarioProfe.id, nivel_id: nivel.id,
        dia_semana: 3, hora_inicio: new Date(`${fechaBase}16:00:00Z`), hora_fin: new Date(`${fechaBase}17:30:00Z`),
        capacidad_max: 20, activo: true, minutos_reserva_especifico: 45
      }
    });
  }

  // -------------------------------------------------------
  // 7. MÉTODOS DE PAGO 💳
  // -------------------------------------------------------
  console.log('💳 Creando Métodos de Pago...');
  const metodos = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO', 'OTROS'];
  
  for (const nombre of metodos) {
    await prisma.metodos_pago.upsert({
      where: { nombre: nombre },
      update: {},
      create: { nombre: nombre, activo: true }
    });
  }

  // -------------------------------------------------------
  // 8. DATOS DE PRUEBA (ALUMNO CON DEUDA) 🧪
  // -------------------------------------------------------
  console.log('🧪 Creando Alumno de Prueba (Javier) con Deuda...');

  // A. Crear Usuario Alumno (Javier)
  const usuarioJavier = await prisma.usuarios.upsert({
    where: { email: 'alumno@prueba.com' },
    update: {},
    create: {
      nombres: 'Javier', apellidos: 'Prueba', email: 'alumno@prueba.com',
      rol_id: rolAlumno.id, tipo_documento_id: 'DNI', numero_documento: '88888888',
      telefono_personal: '999999999'
    },
  });

  // B. Crear Perfil de Alumno
  await prisma.alumnos.upsert({
    where: { usuario_id: usuarioJavier.id },
    update: {},
    create: { usuario_id: usuarioJavier.id, condiciones_medicas: 'Ninguna', seguro_medico: 'Pacífico' }
  });

  // C. Inscribirlo en el Horario Lunes (Lo buscamos primero)
  const horarioLunesSeed = await prisma.horarios_clases.findFirst({ where: { dia_semana: 1 } });
  
  if (horarioLunesSeed) {
    await prisma.inscripciones.upsert({
      where: { 
        alumno_id_horario_id: { alumno_id: usuarioJavier.id, horario_id: horarioLunesSeed.id }
      },
      update: {},
      create: {
        alumno_id: usuarioJavier.id,
        horario_id: horarioLunesSeed.id,
        estado: 'PENDIENTE_PAGO',
        fecha_inscripcion: new Date()
      }
    });

    // D. Crear la DEUDA
    const conceptoMensual = await prisma.catalogo_conceptos.findFirst({ where: { codigo_interno: 'MENSUAL_1_DIA_2026' } });
    
    // Verificamos si existe deuda PENDIENTE
    const deudaExiste = await prisma.cuentas_por_cobrar.findFirst({
      where: { alumno_id: usuarioJavier.id, estado: 'PENDIENTE' }
    });

    if (!deudaExiste && conceptoMensual) {
      const deudaNueva = await prisma.cuentas_por_cobrar.create({
        data: {
          alumnos: { connect: { usuario_id: usuarioJavier.id } },
          catalogo_conceptos: { connect: { id: conceptoMensual.id } },
          detalle_adicional: 'Mensualidad Prueba Seed',
          monto_final: 150.00,
          fecha_vencimiento: new Date(Date.now() + 86400000), // Vence mañana
          estado: 'PENDIENTE'
        }
      });
      console.log(`✅ Deuda de prueba creada. ID DEUDA: ${deudaNueva.id} | Alumno: Javier`);
    }
  }

  console.log('✅ SEED MAESTRO COMPLETADO CON ÉXITO');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });