import cron from 'node-cron';
import { prisma } from '../config/database.config.js';

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
      console.error("❌ [CRON ERROR] Falló el Verdugo de Vencimientos:", error);
    }
  });
};

// =====================================================================
// 🧠 LÓGICA 1: LIMPIEZA DE ZOMBIES (Tu código original recuperado)
// =====================================================================
const limpiarReservasZombies = async () => {
  // 1. Obtener el tiempo límite de la BD
  const param = await prisma.parametros_sistema.findUnique({
    where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' }
  });
  
  // Si no existe, usamos 20 min por defecto
  const minutosLimite = param ? parseInt(param.valor) : 20;

  // 2. Calcular la "Hora de Corte"
  const horaCorte = new Date(Date.now() - minutosLimite * 60 * 1000);

  // 3. Ejecutar la limpieza
  // Borramos solo las que siguen en PENDIENTE_PAGO y son viejas
  const resultado = await prisma.inscripciones.deleteMany({
    where: {
      estado: 'PENDIENTE_PAGO',
      fecha_inscripcion: {
        lt: horaCorte // Antes de hace 20 min
      }
    }
  });

  if (resultado.count > 0) {
    console.log(`🗑️ [FRANCOTIRADOR] Se eliminaron ${resultado.count} reservas zombies expiradas.`);
  }
  // No hacemos log si es 0 para no ensuciar la consola cada minuto
};

// =====================================================================
// 🧠 LÓGICA 2: GESTIÓN DE CICLO DE VIDA (La lógica nueva)
// =====================================================================
const gestionarVencimientos = async () => {
    const hoy = new Date();

    // A. OBTENER TOLERANCIA
    const paramTolerancia = await prisma.parametros_sistema.findUnique({
      where: { clave: 'DIAS_TOLERANCIA_VENCIMIENTO' }
    });
    const diasGracia = paramTolerancia ? parseInt(paramTolerancia.valor) : 5;
    
    // B. FASE 1: CONGELAR (De ACTIVO a VENCIDO) ❄️
    // Criterio: Han pasado 30 días desde la inscripción
    const limiteCiclo = new Date();
    limiteCiclo.setDate(hoy.getDate() - 30); 

    const congelados = await prisma.inscripciones.updateMany({
      where: { 
        estado: 'ACTIVO', 
        fecha_inscripcion: { lt: limiteCiclo } 
      },
      data: { 
        estado: 'VENCIDO',
        actualizado_en: new Date()
      }
    });

    if (congelados.count > 0) {
      console.log(`🧊 [VERDUGO] Se congelaron ${congelados.count} inscripciones (Fin de mes).`);
    }

    // C. FASE 2: ELIMINAR (De VENCIDO a FINALIZADO) 🪓
    // Criterio: Han pasado (30 + Tolerancia) días
    const limiteTotal = new Date();
    limiteTotal.setDate(hoy.getDate() - (30 + diasGracia)); 

    const finalizados = await prisma.inscripciones.updateMany({
      where: { 
        estado: 'VENCIDO', 
        fecha_inscripcion: { lt: limiteTotal } 
      },
      data: { 
        estado: 'FINALIZADO',
        actualizado_en: new Date()
      }
    });

    if (finalizados.count > 0) {
      console.log(`🗑️ [VERDUGO] Se liberaron ${finalizados.count} cupos tras vencer su tolerancia.`);
    }
};