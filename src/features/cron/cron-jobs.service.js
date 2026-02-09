import cron from 'node-cron';
import { prisma } from '../../config/database.config.js';

// ✅ CORRECCIÓN: Importamos con llaves { } y en SINGULAR (tal como está en tu servicio)
import { inscripcionService } from '../inscripciones/inscripcion.service.js';

export const iniciarCronJobs = () => {
  console.log('🕰️ Cron Jobs iniciados: El sistema está vigilando...');

  // ------------------------------------------------------------------
  // TAREA 1: EL FRANCOTIRADOR (Cada minuto) 🧟‍♂️🔫
  // Objetivo: Eliminar inscripciones nuevas que no se pagaron en 20 min.
  // ------------------------------------------------------------------
  cron.schedule('* * * * *', async () => {
    try {
      await limpiarReservasZombies();
    } catch (error) {
      console.error('❌ [CRON ERROR] Falló el Francotirador:', error);
    }
  });

  // ------------------------------------------------------------------
  // TAREA 2: EL VERDUGO DE VENCIMIENTOS (Todos los días a las 00:00 AM) ⏳💀
  // Objetivo: Congelar (VENCIDO) y luego Eliminar (FINALIZADO) según ciclo de 30 días.
  // ------------------------------------------------------------------
  cron.schedule('0 0 * * *', async () => {
    console.log(`🕒 [CRON] Iniciando revisión nocturna de ciclos: ${new Date().toISOString()}`);
    try {
      await gestionarVencimientos();
    } catch (error) {
      console.error('❌ [CRON ERROR] Falló el Verdugo de Vencimientos:', error);
    }
  });

  // ------------------------------------------------------------------
  // 🆕 TAREA 3: EL PROFETA (Todos los días a las 00:30 AM) 🔮
  // Objetivo: Generar la deuda del próximo mes X días antes del vencimiento.
  // ------------------------------------------------------------------
  // 💡 TRUCO DE PRUEBA: Si quieres probarlo YA, cambia '30 0 * * *' por '* * * * *'
  cron.schedule('30 0 * * *', async () => {
    console.log(`🔮 [CRON] El Profeta buscando renovaciones futuras...`);
    try {
      await ejecutarProfetaRenovaciones();
    } catch (error) {
      console.error('❌ [CRON ERROR] Falló el Profeta:', error);
    }
  });
};

// =====================================================================
// 🧠 LÓGICA 1: LIMPIEZA DE ZOMBIES
// =====================================================================
// 🧠 LÓGICA 1: LIMPIEZA DE ZOMBIES (MEJORADA)
const limpiarReservasZombies = async () => {
  const param = await prisma.parametros_sistema.findUnique({
    where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' },
  });
  const minutosLimite = param ? Number.parseInt(param.valor) : 20;
  const horaCorte = new Date(Date.now() - minutosLimite * 60 * 1000);

  const zombies = await prisma.inscripciones.findMany({
    where: {
      estado: 'PENDIENTE_PAGO',
      fecha_inscripcion: { lt: horaCorte },
    },
  });

  if (zombies.length === 0) return;

  return await prisma.$transaction(async (tx) => {
    for (const zombie of zombies) {
      // 🛡️ FILTRO DE SEGURIDAD:
      // Solo borramos deudas que coincidan exactamente con la fecha de la inscripción.
      // Las deudas del "Profeta" tienen fechas de creación distintas (día 25).
      await tx.cuentas_por_cobrar.deleteMany({
        where: {
          alumno_id: zombie.alumno_id,
          estado: 'PENDIENTE',
          // CRUCIAL: Solo deudas creadas junto con la inscripción zombie
          creado_en: {
            gte: new Date(zombie.fecha_inscripcion.getTime() - 30000), // 30s antes
            lte: new Date(zombie.fecha_inscripcion.getTime() + 30000), // 30s después
          },
        },
      });

      await tx.inscripciones.delete({
        where: { id: zombie.id },
      });
    }
    console.log(`🗑️ [FRANCOTIRADOR] Limpieza segura de ${zombies.length} zombies. Deudas de renovación respetadas.`);
  });
};

// =====================================================================
// 🧠 LÓGICA 2: GESTIÓN DE CICLO DE VIDA (Verdugo)
// =====================================================================
const gestionarVencimientos = async () => {
  const hoy = new Date();

  // A. OBTENER TOLERANCIA
  const paramTolerancia = await prisma.parametros_sistema.findUnique({
    where: { clave: 'DIAS_TOLERANCIA_VENCIMIENTO' },
  });
  const diasGracia = paramTolerancia ? Number.parseInt(paramTolerancia.valor) : 5;

  // B. FASE 1: CONGELAR (De ACTIVO a VENCIDO) ❄️
  const limiteCiclo = new Date();
  limiteCiclo.setDate(hoy.getDate() - 30);

  const congelados = await prisma.inscripciones.updateMany({
    where: {
      estado: 'ACTIVO',
      fecha_inscripcion: { lt: limiteCiclo },
    },
    data: {
      estado: 'VENCIDO',
      actualizado_en: new Date(),
    },
  });

  if (congelados.count > 0) {
    console.log(`🧊 [VERDUGO] Se congelaron ${congelados.count} inscripciones (Fin de mes).`);
  }

  // C. FASE 2: ELIMINAR (De VENCIDO a FINALIZADO) 🪓
  const limiteTotal = new Date();
  limiteTotal.setDate(hoy.getDate() - (30 + diasGracia));

  const finalizados = await prisma.inscripciones.updateMany({
    where: {
      estado: 'VENCIDO',
      fecha_inscripcion: { lt: limiteTotal },
    },
    data: {
      estado: 'FINALIZADO',
      actualizado_en: new Date(),
    },
  });

  if (finalizados.count > 0) {
    console.log(`🗑️ [VERDUGO] Se liberaron ${finalizados.count} cupos tras vencer su tolerancia.`);
  }
};

// =====================================================================
// 🧠 LÓGICA 3: PRE-AVISO DE RENOVACIÓN (El Profeta)
// =====================================================================
const ejecutarProfetaRenovaciones = async () => {
  // 1. Obtener días de anticipación
  const param = await prisma.parametros_sistema.findUnique({
    where: { clave: 'DIAS_ANTICIPACION_RENOVACION' },
  });
  const diasAnticipacion = param ? Number.parseInt(param.valor) : 5;

  // 2. Invocar al Servicio
  // ✅ CORRECCIÓN: Usamos 'inscripcionService' (SINGULAR)
  const renovacionesGeneradas =
    await inscripcionService.generarRenovacionesMasivas(diasAnticipacion);

  if (renovacionesGeneradas > 0) {
    console.log(
      `🔮 [PROFETA] Se generaron ${renovacionesGeneradas} deudas de renovación anticipada.`
    );
  }
};
