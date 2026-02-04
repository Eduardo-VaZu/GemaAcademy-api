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

  // Admin
  await prisma.usuarios.upsert({
    where: { email: 'admin@gema.com' },
    update: {},
    create: {
      nombres: 'Super', apellidos: 'Admin', email: 'admin@gema.com',
      rol_id: rolAdmin.id, tipo_documento_id: 'DNI', numero_documento: '00000001', telefono_personal: '900000000'
    },
  });

  // Profesor
  const usuarioProfe = await prisma.usuarios.upsert({
    where: { email: 'coach@gema.com' },
    update: {},
    create: {
      nombres: 'Carlos', apellidos: 'Coach', email: 'coach@gema.com',
      rol_id: rolProfe.id, tipo_documento_id: 'DNI', numero_documento: '10203040',
    },
  });

  await prisma.profesores.upsert({
    where: { usuario_id: usuarioProfe.id },
    update: {},
    create: { usuario_id: usuarioProfe.id, especializacion: 'Voley Alto Rendimiento' },
  });

  // =================================================================
  // 3. INFRAESTRUCTURA 🏢
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
  // 4. PARÁMETROS DEL SISTEMA (CEREBRO) 🧠
  // =================================================================
  console.log('🧠 Inyectando Parámetros del Sistema (Reglas de Negocio)...');
  
  const parametrosSistema = [
    { 
      clave: 'TIEMPO_LIMITE_RESERVA_MIN', 
      valor: '20', 
      descripcion: 'Minutos que tiene un alumno nuevo para pagar antes de liberar el cupo (Modo Zombie)' 
    },
    { 
      clave: 'DIAS_TOLERANCIA_PAGO', 
      valor: '3', 
      descripcion: 'Días extra que tiene un alumno para regularizar su pago tras el vencimiento' 
    },
    {
      clave: 'DIAS_TOLERANCIA_VENCIMIENTO',
      valor: '5',
      descripcion: 'Días de gracia después de los 30 días del ciclo antes de marcar como VENCIDO'
    },
    {
      clave: 'DIAS_ANTICIPACION_RENOVACION',
      valor: '5',
      descripcion: 'Días antes del vencimiento para generar la deuda del próximo ciclo automáticamente'
    }
  ];

  for (const param of parametrosSistema) {
    await prisma.parametros_sistema.upsert({
      where: { clave: param.clave },
      update: { valor: param.valor, descripcion: param.descripcion }, // Actualiza si ya existe
      create: param
    });
  }

  // =================================================================
  // 5. CATÁLOGO DE PRECIOS (NUEVOS Y LEGACY) 💰
  // =================================================================
  console.log('💰 Configurando Catálogo de Precios Completo...');

  const conceptos = [
    // --- 🟢 1. PLANES VIGENTES 2026 ---
    { codigo: 'MENSUAL_1_DIA_2026', nombre: 'Mensualidad Básica (1 vez x semana)', precio: 150.00, clases: 1, vigente: true },
    { codigo: 'MENSUAL_2_DIA_2026', nombre: 'Plan Estándar (2 veces x semana)', precio: 280.00, clases: 2, vigente: true },
    { codigo: 'MENSUAL_3_DIA_2026', nombre: 'Plan Intensivo (3 veces x semana)', precio: 400.00, clases: 3, vigente: true },
    { codigo: 'MENSUAL_4_DIA_2026', nombre: 'Plan Atleta (4 veces x semana)', precio: 500.00, clases: 4, vigente: true },
    { codigo: 'CLASE_UNITARIA_2026', nombre: 'Costo por Clase Unitaria (Referencial)', precio: 37.50, clases: 0, vigente: true },

    // --- 🔴 2. PLANES LEGACY (ANTIGUOS) ---
    { codigo: 'M_LEGACY_1_DIA', nombre: 'Mensualidad Antigua (1 vez x semana)', precio: 100.00, clases: 1, vigente: false },
    { codigo: 'M_LEGACY_2_DIA', nombre: 'Plan Estándar Antiguo (2 veces x semana)', precio: 190.00, clases: 2, vigente: false },
    { codigo: 'M_LEGACY_3_DIA', nombre: 'Plan Intensivo Antiguo (3 veces x semana)', precio: 270.00, clases: 3, vigente: false },
    { codigo: 'M_LEGACY_4_DIA', nombre: 'Plan Atleta Antiguo (4 veces x semana)', precio: 340.00, clases: 4, vigente: false },
    { codigo: 'CLASE_UNI_LEGACY', nombre: 'Costo por Clase Unitaria (Legacy)', precio: 25.00, clases: 0, vigente: false },
  ];

  for (const c of conceptos) {
    await prisma.catalogo_conceptos.upsert({
      where: { codigo_interno: c.codigo },
      update: { 
          nombre: c.nombre, 
          precio_base: c.precio, 
          cantidad_clases_semanal: c.clases, 
          es_vigente: c.vigente,
          activo: true 
      },
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
  // 6. HORARIOS Y MÉTODOS DE PAGO 📅
  // =================================================================
  console.log('📅 Creando Horarios y Métodos de Pago...');

  const fechaBase = '1970-01-01T'; 
  
  // Horarios (Upsert manual para evitar duplicados por ID o lógica)
  const horariosData = [
      { dia: 1, inicio: '16:00:00Z', fin: '17:30:00Z', minutos: null }, // Lunes
      { dia: 3, inicio: '16:00:00Z', fin: '17:30:00Z', minutos: 45 }   // Miércoles
  ];

  for (const h of horariosData) {
      const existe = await prisma.horarios_clases.findFirst({ 
          where: { dia_semana: h.dia, hora_inicio: new Date(`${fechaBase}${h.inicio}`) } 
      });

      if (!existe) {
          await prisma.horarios_clases.create({
              data: {
                  cancha_id: cancha.id, profesor_id: usuarioProfe.id, nivel_id: nivel.id,
                  dia_semana: h.dia, 
                  hora_inicio: new Date(`${fechaBase}${h.inicio}`), 
                  hora_fin: new Date(`${fechaBase}${h.fin}`),
                  capacidad_max: 20, activo: true, minutos_reserva_especifico: h.minutos
              }
          });
      }
  }

  // Métodos de Pago
  const metodos = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO', 'OTROS'];
  for (const nombre of metodos) {
    await prisma.metodos_pago.upsert({
      where: { nombre: nombre },
      update: {},
      create: { nombre: nombre, activo: true }
    });
  }

  // =================================================================
  // 7. DATOS DE PRUEBA: EL ALUMNO "JAVIER" 🧪
  // =================================================================
  console.log('🧪 Creando Alumno de Prueba (Javier)...');

  const usuarioJavier = await prisma.usuarios.upsert({
    where: { email: 'javier@prueba.com' },
    update: {},
    create: {
      nombres: 'Javier', apellidos: 'Prueba', email: 'javier@prueba.com',
      rol_id: rolAlumno.id, tipo_documento_id: 'DNI', numero_documento: '88888888', telefono_personal: '999999999'
    },
  });

  await prisma.alumnos.upsert({
    where: { usuario_id: usuarioJavier.id },
    update: {},
    create: { usuario_id: usuarioJavier.id, condiciones_medicas: 'Ninguna', seguro_medico: 'Pacífico' }
  });

  // Intentamos inscribirlo en el Lunes
  const horarioLunes = await prisma.horarios_clases.findFirst({ where: { dia_semana: 1 } });
  
  if (horarioLunes) {
    // Verificar si ya está inscrito para no duplicar en seeds consecutivos
    const inscripcionExistente = await prisma.inscripciones.findFirst({
        where: { alumno_id: usuarioJavier.id, horario_id: horarioLunes.id }
    });

    if (!inscripcionExistente) {
        await prisma.inscripciones.create({
            data: {
                alumno_id: usuarioJavier.id,
                horario_id: horarioLunes.id,
                estado: 'PENDIENTE_PAGO',
                fecha_inscripcion: new Date()
            }
        });

        // Crear Deuda de Prueba (Usando el precio vigente)
        const conceptoMensual = await prisma.catalogo_conceptos.findFirst({ where: { codigo_interno: 'MENSUAL_1_DIA_2026' } });
        
        if (conceptoMensual) {
            await prisma.cuentas_por_cobrar.create({
                data: {
                    alumno_id: usuarioJavier.id,
                    concepto_id: conceptoMensual.id, // IMPORTANTE: Usa concepto_id o catalogo_conceptos_id según tu schema
                    detalle_adicional: 'Mensualidad Prueba Seed',
                    monto_final: 150.00,
                    fecha_vencimiento: new Date(Date.now() + 86400000), 
                    estado: 'PENDIENTE'
                }
            });
            console.log(`✅ Deuda de prueba creada para Javier.`);
        }
    }
  }

  console.log('✅✅ SEED MAESTRO COMPLETADO: Base de datos lista para pruebas.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal en el Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });