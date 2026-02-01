// src/features/asistencia/asistencia.service.js
import { prisma } from '../../config/database.config.js';

/**
 * Función auxiliar para calcular fechas (Interna)
 * Mantiene la corrección de zona horaria (Mediodía)
 */
const calcularProximasFechas = (fechaInicio, diaSemanaClase, cantidadSemanas) => {
  const fechas = [];
  const fechaActual = new Date(fechaInicio); 
  
  // 🔥 CORRECCIÓN CRÍTICA DE ZONA HORARIA 🔥
  // Fijamos la hora a las 12:00 del mediodía para evitar saltos de día por UTC.
  fechaActual.setHours(12, 0, 0, 0);

  // 1. Buscamos el primer día de clase válido
  // Si fechaActual ya es el día correcto, el bucle no corre (perfecto para Smart Append)
  // Si no, avanza hasta encontrarlo.
  while (fechaActual.getDay() !== diaSemanaClase) {
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  // 2. Generamos las fechas para las semanas solicitadas
  for (let i = 0; i < cantidadSemanas; i++) {
    fechas.push(new Date(fechaActual)); // Guardamos copia
    fechaActual.setDate(fechaActual.getDate() + 7); // +7 días
  }
  
  return fechas;
};

export const asistenciaService = {
  
  /**
   * Genera masivamente las clases futuras.
   * Lógica: "Smart Append" (Continuidad Inteligente)
   */
  generarClasesFuturas: async (tx, params) => {
    // Desestructuramos los datos
    const { inscripcion_id, dia_semana, usuario_admin_id, profesor_id } = params;
    
    // Configuración: 4 semanas por defecto
    const CANTIDAD_SEMANAS = 4;

    // =================================================================
    // 🧠 LÓGICA SMART APPEND: ¿Desde cuándo empezamos a contar?
    // =================================================================
    
    // 1. Buscamos la última clase registrada para esta inscripción
    const ultimaClase = await tx.registros_asistencia.findFirst({
      where: { inscripcion_id: inscripcion_id },
      orderBy: { fecha: 'desc' } // La fecha más futura
    });

    let fechaInicioCalculo = new Date(); // Por defecto: HOY

    if (ultimaClase) {
      // Si existe una clase previa, verificamos si es futura
      const fechaUltima = new Date(ultimaClase.fecha);
      
      // Si la última clase es MAYOR a hoy (Ej: El alumno paga su renovación antes de tiempo)
      // entonces empezamos a generar DESPUÉS de esa última clase.
      if (fechaUltima > fechaInicioCalculo) {
        console.log(`📅 Renovación detectada. Empalmando después de: ${fechaUltima.toISOString()}`);
        
        // Movemos el inicio al día siguiente de su última clase
        // La función 'calcularProximasFechas' se encargará de buscar el siguiente día hábil
        fechaUltima.setDate(fechaUltima.getDate() + 1);
        fechaInicioCalculo = fechaUltima;
      } else {
        console.log('📅 Renovación tardía o reingreso. Generando desde HOY.');
      }
    } else {
      console.log('🌟 Alumno nuevo. Generando desde HOY.');
    }

    // =================================================================

    // 2. Calculamos las fechas exactas usando la fecha de inicio inteligente
    const fechasClases = calcularProximasFechas(fechaInicioCalculo, dia_semana, CANTIDAD_SEMANAS);

    // 3. Preparamos los objetos para insertar
    const datosAsistencia = fechasClases.map(fecha => ({
      inscripcion_id: inscripcion_id,
      fecha: fecha,
      estado: 'PROGRAMADA',
      registrado_por: profesor_id, // El profesor titular del horario
      comentario: `Generado automáticamente tras validación de pago por Admin ID: ${usuario_admin_id}`
    }));

    // 4. Insertamos usando la transacción
    if (datosAsistencia.length > 0) {
      await tx.registros_asistencia.createMany({
        data: datosAsistencia,
        skipDuplicates: true
      });
    }

    console.log(`✅ Se generaron ${datosAsistencia.length} clases para inscripción ${inscripcion_id}`);
    return datosAsistencia.length;
  },

  // 📋 Funciones extra que podrías necesitar para la App del Profesor
  
  marcarAsistencia: async (asistenciaId, estado, comentario) => {
    return await prisma.registros_asistencia.update({
      where: { id: asistenciaId },
      data: { 
        estado, 
        comentario,
        actualizado_en: new Date()
      }
    });
  },

  obtenerHistorial: async (inscripcionId) => {
    return await prisma.registros_asistencia.findMany({
      where: { inscripcion_id: parseInt(inscripcionId) },
      orderBy: { fecha: 'asc' }
    });
  }
};