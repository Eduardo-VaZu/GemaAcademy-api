import { prisma } from '../../config/database.config.js';
import { asistenciaService } from '../asistencia/asistencia.service.js';

export const pagosService = {

  // 1. REGISTRAR EL PAGO (Tu lógica original intacta ✅)
  registrarPago: async (data) => {
    const { 
      deuda_id, 
      monto, 
      metodo_pago, 
      codigo_operacion, 
      voucher_url 
    } = data;

    // Validaciones de Entrada
    if (!deuda_id || !monto) {
      throw new Error("Faltan datos obligatorios: deuda_id y monto.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // PASO A: VALIDAR LA DEUDA
      const deuda = await tx.cuentas_por_cobrar.findUnique({
        where: { id: parseInt(deuda_id) }
      });

      if (!deuda) throw new Error("La deuda indicada no existe.");
      if (deuda.estado === 'PAGADA') throw new Error("Esta deuda ya fue pagada completamente.");

      // PASO B: RESOLVER EL MÉTODO DE PAGO
      let metodoPagoId;

      if (!isNaN(metodo_pago)) {
        metodoPagoId = parseInt(metodo_pago);
      } else {
        const metodoEncontrado = await tx.metodos_pago.findFirst({
          where: { nombre: { contains: metodo_pago, mode: 'insensitive' } }
        });
        
        if (!metodoEncontrado) {
          const defaultMetodo = await tx.metodos_pago.findFirst();
          if (!defaultMetodo) throw new Error("Error técnico: No hay métodos de pago configurados.");
          metodoPagoId = defaultMetodo.id;
        } else {
          metodoPagoId = metodoEncontrado.id;
        }
      }

      // PASO C: CREAR EL REGISTRO DE PAGO
      const nuevoPago = await tx.pagos.create({
        data: {
          cuenta_id: parseInt(deuda_id),
          metodo_pago_id: metodoPagoId,
          monto_pagado: parseFloat(monto),
          url_comprobante: voucher_url || null,
          codigo_operacion: codigo_operacion || 'S/N',
          estado_validacion: 'PENDIENTE',
          fecha_pago: new Date()
        }
      });

      // PASO D: ACTUALIZAR ESTADOS (Congelar Zombie)
      await tx.cuentas_por_cobrar.update({
        where: { id: parseInt(deuda_id) },
        data: { estado: 'POR_VALIDAR', actualizado_en: new Date() }
      });

      const inscripcionesUpdate = await tx.inscripciones.updateMany({
        where: {
          alumno_id: deuda.alumno_id,
          estado: 'PENDIENTE_PAGO'
        },
        data: { estado: 'POR_VALIDAR', actualizado_en: new Date() }
      });

      return {
        success: true,
        mensaje: "Pago registrado exitosamente. Esperando validación.",
        pago: nuevoPago,
        cupos_asegurados: inscripcionesUpdate.count
      };
    });
  },

  // 2. VALIDAR EL PAGO (Tu lógica + Corrección de Monto 🛡️)
  validarPago: async (data) => {
    // 🆕 ACEPTAMOS 'monto_real_confirmado'
    const { pago_id, accion, usuario_admin_id, notas, monto_real_confirmado } = data; 

    if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
      throw new Error("La acción debe ser APROBAR o RECHAZAR.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar el pago
      // Usamos 'let' porque podríamos actualizarlo si el admin corrige el monto
      let pago = await tx.pagos.findUnique({
        where: { id: parseInt(pago_id) },
        include: { cuentas_por_cobrar: true } 
      });

      if (!pago) throw new Error("El pago ID indicado no existe.");
      if (pago.estado_validacion !== 'PENDIENTE') throw new Error("Este pago ya fue validado anteriormente.");

      // =======================================================
      // 🆕 PASO 1.5: LA VERDAD DEL ADMIN (Corrección de Monto)
      // =======================================================
      // Si el Admin manda un monto corregido y aprueba, sobrescribimos la mentira del alumno.
      if (accion === 'APROBAR' && monto_real_confirmado) {
          const montoAdmin = parseFloat(monto_real_confirmado);
          
          // Solo actualizamos si es diferente a lo que dijo el usuario
          if (montoAdmin !== Number(pago.monto_pagado)) {
              console.log(`👮‍♂️ Corrección de Admin: Usuario dijo ${pago.monto_pagado}, Real es ${montoAdmin}`);
              
              // Actualizamos la base de datos
              pago = await tx.pagos.update({
                  where: { id: pago.id },
                  data: { 
                      monto_pagado: montoAdmin,
                      // Agregamos una nota automática para auditoría
                      notas_validacion: `Monto corregido por Admin. (Usuario reportó: ${pago.monto_pagado})`
                  },
                  include: { cuentas_por_cobrar: true } // Recargamos la data para los cálculos siguientes
              });
          }
      }

      // =======================================================
      // PASO 2: LÓGICA DE ALCANCÍA (Igual que tu código)
      // =======================================================
      let saldoRestante = 0;
      let esPagoCompleto = false;
      const esAprobado = accion === 'APROBAR';

      if (esAprobado) {
        const pagosAnteriores = await tx.pagos.aggregate({
          where: {
            cuenta_id: pago.cuenta_id,
            estado_validacion: 'APROBADO',
            id: { not: pago.id } 
          },
          _sum: { monto_pagado: true }
        });

        const totalPrevio = pagosAnteriores._sum.monto_pagado || 0;
        // OJO: Aquí usamos 'pago.monto_pagado' que ya tiene el valor corregido (si hubo corrección)
        const totalConEstePago = totalPrevio + Number(pago.monto_pagado); 
        const deudaTotal = Number(pago.cuentas_por_cobrar.monto_final);

        saldoRestante = deudaTotal - totalConEstePago;

        if (saldoRestante <= 0.1) { 
           esPagoCompleto = true;
           saldoRestante = 0;
        }
      }

      // =======================================================
      // PASO 3: DETERMINAR NUEVOS ESTADOS
      // =======================================================
      const nuevoEstadoPago = esAprobado ? 'APROBADO' : 'RECHAZADO';
      
      let nuevoEstadoDeuda = 'PENDIENTE';
      let activarAlumno = false;

      if (esAprobado) {
          if (esPagoCompleto) {
              nuevoEstadoDeuda = 'PAGADA'; // 🟢
              activarAlumno = true; 
          } else {
              nuevoEstadoDeuda = 'PARCIAL'; // 🟡
              activarAlumno = true; 
          }
      } else {
          // RECHAZADO
          const pagosAprobadosPrevios = await tx.pagos.count({
              where: { cuenta_id: pago.cuenta_id, estado_validacion: 'APROBADO' }
          });
          nuevoEstadoDeuda = pagosAprobadosPrevios > 0 ? 'PARCIAL' : 'PENDIENTE';
          activarAlumno = false;
      }

      // =======================================================
      // PASO 4: ACTUALIZAR REGISTROS
      // =======================================================

      // A. Actualizar el PAGO
      // Concatenamos las notas que vengan del controller + las automáticas de corrección
      const notasFinales = `${notas || ''} ${pago.notas_validacion || ''} | ${esAprobado ? (esPagoCompleto ? 'PAGO TOTAL' : `ABONO PARCIAL. Resta: S/ ${saldoRestante.toFixed(2)}`) : 'Rechazado'}`;

      const pagoActualizado = await tx.pagos.update({
        where: { id: parseInt(pago_id) },
        data: {
          estado_validacion: nuevoEstadoPago,
          revisado_por: parseInt(usuario_admin_id),
          notas_validacion: notasFinales,
          fecha_pago: new Date() 
        }
      });

      // B. Actualizar la DEUDA
      await tx.cuentas_por_cobrar.update({
        where: { id: pago.cuenta_id },
        data: { estado: nuevoEstadoDeuda }
      });

      // =======================================================
      // PASO 5: GESTIÓN DE INSCRIPCIONES
      // =======================================================
      
      if (activarAlumno) {
        // BIENVENIDO (Total o Parcial)
        const inscripciones = await tx.inscripciones.findMany({
            where: {
              alumno_id: pago.cuentas_por_cobrar.alumno_id, 
              estado: { in: ['POR_VALIDAR', 'PENDIENTE_PAGO'] } 
            },
            include: { horarios_clases: true } 
        });

        for (const inscripcion of inscripciones) {
            await tx.inscripciones.update({
              where: { id: inscripcion.id },
              data: { estado: 'ACTIVO', actualizado_en: new Date() }
            });

            // Generar Asistencia (Ciclo 30 días)
            const profesorId = inscripcion.horarios_clases.profesor_id;
            await asistenciaService.generarClasesFuturas(tx, {
              inscripcion_id: inscripcion.id,
              dia_semana: inscripcion.horarios_clases.dia_semana,
              usuario_admin_id: parseInt(usuario_admin_id),
              profesor_id: profesorId 
            });
        }

      } else if (!esAprobado) {
        // RECHAZADO: Vuelve a PENDIENTE para que el Francotirador lo pueda borrar si no corrige
        await tx.inscripciones.updateMany({
            where: {
                alumno_id: pago.cuentas_por_cobrar.alumno_id,
                estado: 'POR_VALIDAR'
            },
            data: { estado: 'PENDIENTE_PAGO' }
        });
      }

     // --- CORRECCIÓN DE MENSAJE (Lógica de 3 casos) ---
      let mensajeFinal = "";
      
      if (!esAprobado) {
          // Caso 1: Rechazado ❌
          mensajeFinal = "⛔ PAGO RECHAZADO. La inscripción ha vuelto a estado PENDIENTE (o será eliminada por el sistema).";
      } else if (esPagoCompleto) {
          // Caso 2: Aprobado Total ✅
          mensajeFinal = "✅ Deuda SALDADA. Alumno ACTIVO y limpio.";
      } else {
          // Caso 3: Aprobado Parcial ⚠️
          mensajeFinal = `⚠️ Abono registrado. Saldo: S/ ${saldoRestante.toFixed(2)}. Alumno ACTIVO (con deuda PARCIAL).`;
      }

      return {
        resultado: mensajeFinal,
        pago: pagoActualizado,
        saldo_pendiente: saldoRestante
      };
    });
  }
};