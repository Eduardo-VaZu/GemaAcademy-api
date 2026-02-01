// src/features/cron/cron-jobs.service.js
import cron from 'node-cron';
import { prisma } from '../../config/database.config.js';

export const cronJobsService = {
  
  // Función principal para iniciar los relojes
  iniciarCronJobs: () => {
    console.log('🕒 Cron Jobs iniciados: El sistema está vigilando...');

    // ------------------------------------------------------------------
    // TAREA 1: EL FRANCOTIRADOR (Cada 10 minutos) 🧟‍♂️
    // Objetivo: Eliminar inscripciones "zombies" (nuevas sin pagar)
    // ------------------------------------------------------------------
    cron.schedule('* * * * *', async () => {
      console.log('🔫 Ejecutando limpieza de reservas expiradas (Francotirador)...');
      try {
        await limpiarReservasExpiradas();
      } catch (error) {
        console.error('❌ Error en el Cron de Reservas:', error);
      }
    });

    // ------------------------------------------------------------------
    // TAREA 2: LA GUILLOTINA (Todos los días a las 00:01 AM) 🪓
    // Objetivo: Inactivar alumnos con deuda vencida fuera de tolerancia
    // ------------------------------------------------------------------
    cron.schedule('1 0 * * *', async () => {
      console.log('🪓 Ejecutando corte de servicio por morosidad (Guillotina)...');
      try {
        await suspenderAlumnosMorosos();
      } catch (error) {
        console.error('❌ Error en el Cron de Morosos:', error);
      }
    });
  }
};

// --- LÓGICAS INTERNAS ---

/**
 * LÓGICA 1: Eliminar reservas PENDIENTE_PAGO antiguas
 */
async function limpiarReservasExpiradas() {
  // 1. Obtener el tiempo límite desde la BD (Configurable)
  const param = await prisma.parametros_sistema.findUnique({
    where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' }
  });
  
  // Si no existe el parámetro, usamos 20 min por defecto
  const minutosLimite = param ? parseInt(param.valor) : 20;

  // 2. Calcular la "Hora de Corte"
  // (Si son las 4:30pm y el límite es 20min, buscamos reservas creadas antes de las 4:10pm)
  const horaCorte = new Date(Date.now() - minutosLimite * 60 * 1000);

  // 3. Ejecutar la limpieza
  const resultado = await prisma.inscripciones.deleteMany({
    where: {
      estado: 'PENDIENTE_PAGO',
      fecha_inscripcion: {
        lt: horaCorte // "lt" significa "Less Than" (Menor que / Antes de)
      }
      // NOTA: Esto solo borra las que siguen en PENDIENTE_PAGO. 
      // Si subió el voucher, el estado sería 'POR_VALIDAR' y se salva.
    }
  });

  if (resultado.count > 0) {
    console.log(`🗑️  Se eliminaron ${resultado.count} reservas zombies expiradas.`);
  } else {
    console.log('✅ No se encontraron reservas expiradas.');
  }
}

/**
 * LÓGICA 2: Suspender alumnos con deuda vencida
 */
async function suspenderAlumnosMorosos() {
  // 1. Obtener días de tolerancia desde la BD
  const param = await prisma.parametros_sistema.findUnique({
    where: { clave: 'DIAS_TOLERANCIA_PAGO' }
  });

  const diasTolerancia = param ? parseInt(param.valor) : 3;

  // 2. Calcular fecha límite (Hoy - 3 días)
  // Si venció hace 4 días, esa fecha es MENOR a (Hoy - 3).
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - diasTolerancia);

  // 3. Buscar alumnos con deudas vencidas más allá de la tolerancia
  // Primero buscamos las DEUDAS problemáticas
  const deudasVencidas = await prisma.cuentas_por_cobrar.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'VENCIDA'] }, // Aceptamos ambos nombres por si acaso
      fecha_vencimiento: {
        lt: fechaLimite
      }
    },
    select: { alumno_id: true } // Solo queremos los IDs de los culpables
  });

  const idsMorosos = deudasVencidas.map(d => d.alumno_id);

  // Si no hay morosos, terminamos
  if (idsMorosos.length === 0) {
    console.log('✅ Todos los alumnos están al día (o dentro de la tolerancia).');
    return;
  }

  // 4. Ejecutar la suspensión (Update masivo)
  const resultado = await prisma.inscripciones.updateMany({
    where: {
      alumno_id: { in: idsMorosos },
      estado: 'ACTIVO' // Solo suspendemos a los que todavía están activos
    },
    data: {
      estado: 'INACTIVO',
      actualizado_en: new Date()
    }
  });

  if (resultado.count > 0) {
    console.log(`🚫 Se suspendieron ${resultado.count} inscripciones por falta de pago (Usuario IDs: ${idsMorosos.join(', ')}).`);
  }
}