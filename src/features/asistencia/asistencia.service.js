import { prisma } from '../../config/database.config.js';
import { recuperacionService } from '../recuperaciones/recuperacion.service.js'

/**
 * Función auxiliar para calcular fechas DENTRO DE UN RANGO (Dinámico) 📅
 * Ahora recibe una 'fechaLimite' en lugar de una cantidad fija.
 */
const calcularProximasFechas = (fechaInicio, diaSemanaClase, fechaLimite) => {
  const fechas = [];
  const fechaActual = new Date(fechaInicio);

  // 🔥 CORRECCIÓN DE ZONA HORARIA (Mediodía)
  fechaActual.setHours(12, 0, 0, 0);

  // Aseguramos que el límite también sea a mediodía para comparar peras con peras
  const limiteFijo = new Date(fechaLimite);
  limiteFijo.setHours(12, 0, 0, 0);

  // 1. Buscamos el primer día de clase válido
  while (fechaActual.getDay() !== diaSemanaClase) {
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  // 2. Generamos fechas MIENTRAS estemos dentro del rango de tiempo
  // (Esto cubre automáticamente si el mes tiene 4 o 5 clases)
  while (fechaActual <= limiteFijo) {
    fechas.push(new Date(fechaActual)); // Guardamos copia
    fechaActual.setDate(fechaActual.getDate() + 7); // Saltamos a la próxima semana
  }

  return fechas;
};

export const asistenciaService = {

  /**
   * Genera masivamente las clases futuras respetando el CICLO DE 30 DÍAS.
   */
  generarClasesFuturas: async (tx, params) => {
    // Desestructuramos los datos
    const { inscripcion_id, dia_semana, usuario_admin_id, profesor_id } = params;

    // =================================================================
    // 🧠 CONFIGURACIÓN DE TIEMPO (Aquí definimos la regla de negocio)
    // =================================================================
    const DIAS_CICLO = 30; // El estándar comercial que acordamos

    // =================================================================
    // 🧠 LÓGICA SMART APPEND: ¿Desde cuándo empezamos?
    // =================================================================

    // 1. Buscamos la última clase registrada
    const ultimaClase = await tx.registros_asistencia.findFirst({
      where: { inscripcion_id: inscripcion_id },
      orderBy: { fecha: 'desc' }
    });

    let fechaInicioCalculo = new Date(); // Por defecto: HOY

    if (ultimaClase) {
      const fechaUltima = new Date(ultimaClase.fecha);

      // Si renueva antes de tiempo (Upgrade o Renovación)
      if (fechaUltima > fechaInicioCalculo) {
        console.log(`📅 Renovación detectada. Empalmando después de: ${fechaUltima.toISOString()}`);
        fechaUltima.setDate(fechaUltima.getDate() + 1);
        fechaInicioCalculo = fechaUltima;
      } else {
        console.log('📅 Renovación tardía o reingreso. Generando desde HOY.');
      }
    } else {
      console.log('🌟 Alumno nuevo. Generando desde HOY.');
    }

    // =================================================================
    // 🧠 LÓGICA DE CÁLCULO DE LÍMITE (El "Hasta Cuándo")
    // =================================================================
    // Calculamos la fecha en la que se le vence el derecho a asistir
    const fechaLimite = new Date(fechaInicioCalculo);
    fechaLimite.setDate(fechaLimite.getDate() + (DIAS_CICLO - 1));
    // Nota: Restamos 1 porque si entro el 1, venzo el 30 (inclusive), no el 31.

    // 2. Calculamos las fechas dinámicamente
    // Si hay 5 lunes en este rango, generará 5. Si hay 4, generará 4.
    const fechasClases = calcularProximasFechas(fechaInicioCalculo, dia_semana, fechaLimite);

    // 3. Preparamos los objetos para insertar
    const datosAsistencia = fechasClases.map(fecha => ({
      inscripcion_id: inscripcion_id,
      fecha: fecha,
      estado: 'PROGRAMADA',
      registrado_por: profesor_id,
      comentario: `Generado auto (Ciclo 30 días) - Admin ID: ${usuario_admin_id}`
    }));

    // 4. Insertamos usando la transacción
    if (datosAsistencia.length > 0) {
      await tx.registros_asistencia.createMany({
        data: datosAsistencia,
        skipDuplicates: true
      });
    }

    console.log(`✅ Se generaron ${datosAsistencia.length} clases para inscripción ${inscripcion_id} (Rango: ${fechaInicioCalculo.toLocaleDateString()} al ${fechaLimite.toLocaleDateString()})`);

    return datosAsistencia.length;
  },

  // NO SE USA
  // marcarAsistencia: async (asistenciaId, estado, comentario) => {
  //   const asistenciaRegistrada = await prisma.registros_asistencia.update({
  //     where: { id: asistenciaId },
  //     data: {
  //       estado,
  //       comentario,
  //       actualizado_en: new Date()
  //     },
  //     include: {
  //       inscripciones: true
  //     }
  //   });

  //   // Crea un registro en la tabla recuperaciones con estado PENDIENTE en caso la asistencia sea registrada como FALTA.
  //   if (asistenciaRegistrada.estado === "FALTA") {
  //     const idAlumnoInscripcion = asistenciaRegistrada.inscripciones.alumno_id;
  //     await recuperacionService.registrarFaltaPendiente(idAlumnoInscripcion, asistenciaRegistrada.fecha)
  //   }

  //   return asistenciaRegistrada
  // },

  obtenerHistorial: async (inscripcionId) => {
    return await prisma.registros_asistencia.findMany({
      where: { inscripcion_id: parseInt(inscripcionId) },
      orderBy: { fecha: 'asc' }
    });
  },
  obtenerPorAlumno: async (alumnoId) => {
    return await prisma.registros_asistencia.findMany({
      where: {
        inscripciones: {
          alumno_id: parseInt(alumnoId)
        }
      },
      include: {
        inscripciones: {
          include: {
            horarios_clases: {
              include: {
                canchas: { include: { sedes: true } },
                // 🔥 ESTO ES LO QUE DEBES AGREGAR:
                profesores: {
                  include: {
                    usuarios: {
                      select: {
                        nombres: true,
                        apellidos: true
                      }
                    }
                  }
                },
                niveles_entrenamiento: true
              }
            }
          }
        }
      },
      orderBy: { fecha: 'asc' } // Recomendado 'asc' para ver cronológicamente
    });
  },

  /**
   * 🆕 Obtener todas las asistencias (Vista Admin)
   */
  obtenerTodas: async () => {
    return await prisma.registros_asistencia.findMany({
      include: {
        inscripciones: {
          include: {
            alumnos: { include: { usuarios: true } }
          }
        }
      },
      orderBy: { fecha: 'desc' }
    });
  },

  obtenerClasesDelDiaPorProfesor: async (profesorId, fecha) => {
    const fechaConsulta = new Date(fecha);
    fechaConsulta.setHours(0, 0, 0, 0);
    const diaSemana = fechaConsulta.getDay();

    return await prisma.horarios_clases.findMany({
      where: {
        profesor_id: profesorId,
        dia_semana: diaSemana,
        activo: true
      },
      include: {
        niveles_entrenamiento: true,
        canchas: { include: { sedes: true } },
        inscripciones: {
          where: { estado: 'ACTIVO' },
          include: {
            alumnos: {
              include: {
                usuarios: {
                  select: { id: true, nombres: true, apellidos: true }
                }
              }
            },
            // IMPORTANTE: Buscamos el registro de asistencia específico para este día
            registros_asistencia: {
              where: { fecha: fechaConsulta },
              select: {
                id: true,       // Este es el ID que usará el profesor para marcar
                estado: true,   // Saldrá "PROGRAMADA" inicialmente
                comentario: true
              }
            }
          }
        }
      },
      orderBy: { hora_inicio: 'asc' }
    });
  },
  // En asistencia.service.js
  obtenerAgendaProfesor: async (profesorId, fecha = null) => {
    const whereCondition = {
      profesor_id: profesorId,
      activo: true
    };

    const horarios = await prisma.horarios_clases.findMany({
      where: whereCondition,
      include: {
        niveles_entrenamiento: true,
        canchas: { include: { sedes: true } },
        inscripciones: {
          where: { estado: 'ACTIVO' },
          include: {
            alumnos: {
              include: {
                usuarios: {
                  select: { id: true, nombres: true, apellidos: true, numero_documento: true }
                }
              }
            },
            registros_asistencia: {
              where: fecha ? { fecha: new Date(fecha) } : {},
              orderBy: { fecha: 'asc' },
              select: {
                id: true,
                fecha: true,
                estado: true,
                comentario: true
              }
            }
          }
        }
      },
      orderBy: { hora_inicio: 'asc' }
    });

    // TRANSFORMACIÓN: Limpiamos la data para el Frontend
    return horarios.map(h => {
      // Función interna para extraer solo HH:mm y evitar el bug de 1970
      const formatTime = (timeField) => {
        if (!timeField) return '--:--';
        const d = new Date(timeField);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      };

      return {
        ...h,
        hora_inicio: formatTime(h.hora_inicio),
        hora_fin: formatTime(h.hora_fin)
      };
    });
  },

  procesarAsistenciaMasiva: async (asistencias) => {
    return await prisma.$transaction(async (tx) => {

      for (const a of asistencias) {

        // 1️⃣ Actualizamos asistencia
        const asistenciaRegistrada = await tx.registros_asistencia.update({
          where: { id: Number(a.id) },
          data: {
            estado: a.estado,
            comentario: a.comentario || "",
            registrado_en: new Date()
          },
          include: {
            inscripciones: true
          }
        });
        // Crea un registro en la tabla recuperaciones con estado PENDIENTE en caso la asistencia sea registrada como FALTA.
        if (asistenciaRegistrada.estado === "FALTA") {
          const idAlumnoInscripcion = asistenciaRegistrada.inscripciones.alumno_id;
          await recuperacionService.registrarFaltaPendiente(tx, idAlumnoInscripcion, asistenciaRegistrada.fecha)
        }
      }
    });
  }
};