import { prisma } from '../../config/database.config.js';

import * as Utils from './utils/inscripcion.util.js';
import * as Validators from './validators/inscripcion.validator.js';
import * as Logic from './logic/inscripcion.logic.js';

export const inscripcionService = {
  // =================================================================
  // 📦 LÓGICA MAESTRA: INSCRIPCIÓN / UPGRADE (Con Switch Legacy/Nuevo)
  // =================================================================
  inscribirPaquete: async (data) => {
    const { alumno_id, horario_ids } = data;

    try {
      // 1. Validación de entrada (desde utils)
      Utils.validarInputInscripcion(horario_ids);

      return await prisma.$transaction(async (tx) => {
        // 🛡️ PASO 0.1: Muro de Deuda (desde validators)
        await Validators.validarMuroDeDeuda(tx, alumno_id);

        // 🛡️ PASO 0.2: Muro de Recuperaciones (🔥 EL NUEVO FILTRO)
        await Validators.validarSinRecuperacionesPendientes(tx, alumno_id);

        // 🧟 PASO 1: Configuración Anti-Zombie (desde logic/tiempo)
        const param = await tx.parametros_sistema.findUnique({ where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' } });
        const fechaLimiteZombie = new Date(Date.now() - (param ? parseInt(param.valor) : 20) * 60 * 1000);

        // 🕵️‍♂️ PASO 2: Detective de Régimen (desde logic)
        const esAlumnoLegacy = await Logic.detectarRegimenAlumno(tx, alumno_id);
        const fechaCorte = await Logic.calcularCicloUpgrade(tx, alumno_id);
        const esInscripcionAdicional = !!fechaCorte;

        // =================================================================
        // 🔥 PASO 2.5: BLOQUEO DE CIERRE DE CICLO (Anti-Limbo)
        // =================================================================
        if (esInscripcionAdicional) {
          const paramAnti = await tx.parametros_sistema.findUnique({ 
            where: { clave: 'DIAS_ANTICIPACION_RENOVACION' } 
          });
          const diasAnticipacion = paramAnti ? Number.parseInt(paramAnti.valor) : 5;
          
          const hoy = new Date();
          const diasRestantes = (fechaCorte.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);

          if (diasRestantes <= diasAnticipacion) {
            throw new Error(
              `⛔ BLOQUEO DE CICLO: Estás a menos de ${Math.ceil(diasRestantes)} días de terminar tu mes. Espera al inicio de tu nuevo ciclo para agregar más horarios.`
            );
          }
        }
        // =================================================================

        // 👮‍♂️ PASO 3: Obtener Precio según Régimen (desde logic)
        const cantidadClases = horario_ids.length;
        const conceptoAplicar = await tx.catalogo_conceptos.findFirst({
          where: {
            cantidad_clases_semanal: cantidadClases,
            activo: true,
            es_vigente: !esAlumnoLegacy // El switch mágico
          }
        });

        if (!conceptoAplicar) {
          throw new Error(`⛔ BLOQUEO DE PLAN: No existe un plan de precios para un paquete de ${cantidadClases} clases.`);
        }

        // 🧮 Preparación de precios unitarios para Upgrades
        let precioUnitarioOficial = 0;
        if (esInscripcionAdicional) {
          const codigoUnitario = esAlumnoLegacy ? 'CLASE_UNI_LEGACY' : 'CLASE_UNITARIA_2026';
          const conceptoUnitario = await tx.catalogo_conceptos.findFirst({
            where: { codigo_interno: codigoUnitario, activo: true }
          });
          precioUnitarioOficial = Number(conceptoUnitario?.precio_base || 0);
        }

        // 🔄 PASO 4: Procesar cada Horario (Validación y Creación)
        const inscripcionesCreadas = [];
        let totalCobrar = 0;
        let detalleCobro = [];

        for (const idHorario of horario_ids) {
          // Validar cupos (desde validators)
          const horario = await Validators.validarAforoHorario(tx, idHorario, fechaLimiteZombie);

          // Calcular costo específico (desde utils)
          let montoEsteHorario = 0;
          if (esInscripcionAdicional && fechaCorte) {
            const clasesRestantes = Utils.contarClasesEnIntervalo(horario.dia_semana, new Date(), fechaCorte);
            montoEsteHorario = clasesRestantes * precioUnitarioOficial;
            detalleCobro.push(`Upgrade ${horario.dia_semana} (${clasesRestantes} clases)`);
          } else {
            montoEsteHorario = Number(conceptoAplicar.precio_base) / cantidadClases;
            detalleCobro.push(`Mensualidad ${horario.dia_semana}`);
          }

          totalCobrar += montoEsteHorario;

          // Crear registro de inscripción
          const nuevaInscripcion = await tx.inscripciones.create({
            data: {
              alumno_id: parseInt(alumno_id),
              horario_id: idHorario,
              estado: 'PENDIENTE_PAGO',
            },
            include: { horarios_clases: true }
          });
          inscripcionesCreadas.push(nuevaInscripcion);
        }

        // 💸 PASO 5: Generar la Deuda
        if (totalCobrar > 0) {
          const nuevaCuenta = await tx.cuentas_por_cobrar.create({
            data: {
              alumno_id: parseInt(alumno_id),
              concepto_id: conceptoAplicar.id,
              detalle_adicional: [...new Set(detalleCobro)].join(' | '),
              monto_final: totalCobrar,
              fecha_vencimiento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
              estado: 'PENDIENTE'
            }
          });

          // --- Lógica de Beneficios Pendientes ---
          const beneficiosEnCola = await tx.beneficios_pendientes.findMany({
            where: { alumno_id: parseInt(alumno_id), usado: false },
            include: { tipos_beneficio: true }
          });

          for (const pendiente of beneficiosEnCola) {
            const deudaActual = parseFloat(nuevaCuenta.monto_final);
            const valorNominal = parseFloat(pendiente.tipos_beneficio.valor_por_defecto);

            let descuentoReal = pendiente.tipos_beneficio.es_porcentaje
              ? deudaActual * (valorNominal / 100)
              : valorNominal;

            const descuentoFinal = descuentoReal > deudaActual ? deudaActual : descuentoReal;
            const nuevoMonto = deudaActual - descuentoFinal;

            // Registrar descuento
            await tx.descuentos_aplicados.create({
              data: {
                cuenta_id: nuevaCuenta.id,
                tipo_beneficio_id: pendiente.tipo_beneficio_id,
                monto_nominal_aplicado: valorNominal,
                monto_dinero_descontado: descuentoFinal,
                motivo_detalle: pendiente.motivo || "Beneficio aplicado automáticamente en inscripción",
                aplicado_por: pendiente.asignado_por,
                fecha_aplicacion: new Date()
              }
            });

            // Actualizar cuenta
            await tx.cuentas_por_cobrar.update({
              where: { id: nuevaCuenta.id },
              data: {
                monto_final: nuevoMonto,
                estado: nuevoMonto <= 0.01 ? 'PAGADA' : nuevaCuenta.estado
              }
            });

            // Quemar beneficio
            await tx.beneficios_pendientes.update({
              where: { id: pendiente.id },
              data: { usado: true }
            });
          }
        }

        const cuentaFinal = await tx.cuentas_por_cobrar.findFirst({
          where: { alumno_id: parseInt(alumno_id) },
          orderBy: { creado_en: 'desc' }
        });

        return {
          mensaje: esInscripcionAdicional ? 'Upgrade procesado.' : 'Inscripción creada.',
          total_a_pagar: cuentaFinal ? cuentaFinal.monto_final : totalCobrar,
          inscripciones: inscripcionesCreadas
        };
      });

    } catch (error) {
      // =================================================================
      // 🚨 CONTEXTO DE ERROR: Impresión para auditoría y depuración
      // =================================================================
      console.error('\n❌ [FALLO EN MOTOR DE INSCRIPCIÓN] ==========================');
      console.error(`👤 Alumno ID: ${alumno_id}`);
      console.error(`🕒 Horarios solicitados: ${horario_ids.join(', ')}`);
      console.error(`💥 Motivo del bloqueo: ${error.message}`);
      console.error('==============================================================\n');

      // Relanzamos el error para que el controlador lo atrape y se lo envíe al frontend.
      // Como todos los errores empiezan con "⛔ BLOQUEO...", el frontend puede leer el 'error.message'
      // y mostrarlo directamente en un SweetAlert o Toast.
      throw error;
    }
  },

  // =================================================================
  // 🔮 LA LÓGICA DEL PROFETA: Renovaciones Masivas (Herencia Estricta)
  // =================================================================
  generarRenovacionesMasivas: async (diasAnticipacion) => {
    const { inicio, fin } = Utils.calcularRangoRenovacion(diasAnticipacion);

    return await prisma.$transaction(async (tx) => {
      const candidatos = await tx.inscripciones.findMany({
        where: {
          estado: 'ACTIVO',
          fecha_inscripcion: { gte: inicio, lte: fin },
        },
        distinct: ['alumno_id'],
      });

      let renovacionesCreadas = 0;

      for (const candidato of candidatos) {
        const alumnoId = candidato.alumno_id;

        if (await Validators.existeRenovacionReciente(tx, alumnoId, inicio)) continue;

        // 1. Contamos cuántas inscripciones reales tiene el alumno hoy
        const totalCursosActivos = await tx.inscripciones.count({
          where: { alumno_id: alumnoId, estado: 'ACTIVO' },
        });

        if (totalCursosActivos === 0) continue;

        // 🕵️‍♂️ Detective de Régimen para saber si es Legacy o 2026
        const esAlumnoLegacy = await Logic.detectarRegimenAlumno(tx, alumnoId);

        // 2. 🌟 BUSQUEDA DINÁMICA: Buscamos el plan que calce con sus clases actuales
        const planAdecuado = await tx.catalogo_conceptos.findFirst({
          where: {
            cantidad_clases_semanal: totalCursosActivos, // Match dinámico
            activo: true,
            es_vigente: !esAlumnoLegacy 
          }
        });

        // Si no existe un plan para esa cantidad de clases, saltamos (evita errores)
        if (!planAdecuado) {
          console.log(`⚠️ No hay plan para ${totalCursosActivos} clases para el alumno ${alumnoId}`);
          continue;
        }

        // 3. Crear la Deuda con el plan encontrado
        const nuevaCuenta = await tx.cuentas_por_cobrar.create({
          data: {
            alumno_id: alumnoId,
            concepto_id: planAdecuado.id, // ✅ Cambiado de concept_id a concepto_id
            monto_final: planAdecuado.precio_base,
            detalle_adicional: `Renovación Automática (Plan: ${planAdecuado.nombre})`,
            fecha_vencimiento: Utils.calcularFechaVencimiento(diasAnticipacion),
            estado: 'PENDIENTE',
          },
        });

        // ... (Aquí sigue tu lógica de aplicación de beneficios que ya tienes)
        // [Copia aquí el resto de tu bucle de beneficios_pendientes...]

        renovacionesCreadas++;
      }
      return renovacionesCreadas;
    });
  },

  getAllInscripciones: async () => {
    return await prisma.inscripciones.findMany({
      include: {
        alumnos: {
          include: { usuarios: { select: { nombres: true, apellidos: true, email: true } } },
        },
        horarios_clases: { include: { canchas: true, niveles_entrenamiento: true } },
      },
      orderBy: { fecha_inscripcion: 'desc' },
    });
  },
  obtenerPorAlumno: async (alumnoId) => {
    return await prisma.inscripciones.findMany({
      where: {
        alumno_id: Number.parseInt(alumnoId)
      },
      include: {
        horarios_clases: {
          include: {
            canchas: true,
            niveles_entrenamiento: true,
            coordinadores: { include: { usuarios: true } }
          }
        }
      }
    });
  },
  getInscripcionById: async (id) => {
    return await prisma.inscripciones.findUnique({
      where: { id: Number.parseInt(id) },
      include: {
        alumnos: {
          include: { usuarios: { select: { nombres: true, apellidos: true, email: true } } },
        },
        horarios_clases: {
          include: {
            canchas: true,
            niveles_entrenamiento: true,
            coordinadores: { include: { usuarios: true } }
          }
        },
      }
    });
  },

  // =================================================================
  // 🗑️ ELIMINAR / CANCELAR INSCRIPCIÓN
  // =================================================================
  eliminarInscripcion: async (id) => {
    // Primero verificamos si existe
    const existe = await prisma.inscripciones.findUnique({
      where: { id: Number.parseInt(id) }
    });

    if (!existe) throw new Error('La inscripción no existe.');

    // En lugar de borrar físicamente, podrías cambiar el estado a 'CANCELADO'
    // Pero si el requerimiento es borrar de la BD:
    return await prisma.inscripciones.delete({
      where: { id: Number.parseInt(id) }
    });
  },
// =================================================================
  // 👋 FINALIZACIÓN VOLUNTARIA (El usuario decide retirarse)
  // =================================================================
  finalizarInscripcionVoluntaria: async (id) => {
    return await prisma.$transaction(async (tx) => {
      // 1. Verificamos que la inscripción exista y sea del alumno
      const inscripcion = await tx.inscripciones.findUnique({
        where: { id: Number.parseInt(id) }
      });

      if (!inscripcion) {
        throw new Error('La inscripción no existe.');
      }

      // 🛡️ REGLA DE NEGOCIO: Solo se puede finalizar lo que está ACTIVO
      if (inscripcion.estado !== 'ACTIVO') {
        throw new Error(`No se puede finalizar una inscripción con estado ${inscripcion.estado}.`);
      }

      // 2. Aplicamos la misma lógica que "El Verdugo": Buscamos recuperaciones
      const tieneRecuperaciones = await tx.recuperaciones.findFirst({
        where: {
          alumno_id: inscripcion.alumno_id,
          estado: { in: ['PENDIENTE', 'PROGRAMADA'] }
        }
      });

      // Si tiene tickets de recuperación, lo mandamos al "Purgatorio" (PEN-RECU)
      // Si no tiene nada, se marca como FINALIZADO definitivamente
      const nuevoEstado = tieneRecuperaciones ? 'PEN-RECU' : 'FINALIZADO';

      const inscripcionActualizada = await tx.inscripciones.update({
        where: { id: Number.parseInt(id) },
        data: { 
          estado: nuevoEstado,
          actualizado_en: new Date()
        }
      });

      console.log(`✅ [CANCELACIÓN] El alumno ${inscripcion.alumno_id} finalizó voluntariamente el horario ${inscripcion.horario_id}.`);
      
      return {
        success: true,
        mensaje: tieneRecuperaciones 
          ? 'Inscripción finalizada. Aún tienes recuperaciones pendientes.' 
          : 'Inscripción finalizada correctamente.',
        nuevo_estado: nuevoEstado
      };
    });
  },

};


// --- HELPER (Calendario) ---
function contarClasesEnIntervalo(diaSemana, inicio, fin) {
  let contador = 0;
  let puntero = new Date(inicio);
  puntero.setHours(12, 0, 0, 0);
  let finFijo = new Date(fin);
  finFijo.setHours(23, 59, 59, 999);

  while (puntero <= finFijo) {
    if (puntero.getDay() === diaSemana) contador++;
    puntero.setDate(puntero.getDate() + 1);
  }
  return contador;
}
