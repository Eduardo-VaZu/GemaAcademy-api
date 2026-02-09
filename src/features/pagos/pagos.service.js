import { prisma } from '../../config/database.config.js';
import { asistenciaService } from '../asistencia/asistencia.service.js';
import * as Validators from './validators/pagos.validator.js';
import * as Logic from './logic/pagos.logic.js';
import * as Utils from './utils/pagos.util.js';

export const pagosService = {
  // 1. REGISTRAR EL PAGO (Tu lógica original intacta ✅)
  registrarPago: async (data) => {
    // 1. Validar input básico
    Utils.validarInputPago(data);
    const { deuda_id, monto, metodo_pago, codigo_operacion, voucher_url } = data;

    return await prisma.$transaction(async (tx) => {
      // 🛡️ PASO A: VALIDAR LA DEUDA
      const deuda = await Validators.validarDeudaParaPago(tx, deuda_id);

      // 💳 PASO B: RESOLVER EL MÉTODO DE PAGO
      const metodoPagoId = await Logic.resolverMetodoPagoId(tx, metodo_pago);

      // 📝 PASO C: CREAR EL REGISTRO DE PAGO
      const nuevoPago = await tx.pagos.create({
        data: {
          cuenta_id: parseInt(deuda_id),
          metodo_pago_id: metodoPagoId,
          monto_pagado: parseFloat(monto),
          url_comprobante: voucher_url || null,
          codigo_operacion: codigo_operacion || 'S/N',
          estado_validacion: 'PENDIENTE',
          fecha_pago: new Date(),
        },
      });

      // 🔄 PASO D: ACTUALIZAR ESTADOS (Inmunidad temporal contra el Francotirador)
      await tx.cuentas_por_cobrar.update({
        where: { id: parseInt(deuda_id) },
        data: { estado: 'POR_VALIDAR', actualizado_en: new Date() },
      });

      const inscripcionesUpdate = await tx.inscripciones.updateMany({
        where: { alumno_id: deuda.alumno_id, estado: 'PENDIENTE_PAGO' },
        data: { estado: 'POR_VALIDAR', actualizado_en: new Date() },
      });

      return {
        success: true,
        mensaje: 'Pago registrado exitosamente. Esperando validación.',
        pago: nuevoPago,
        cupos_asegurados: inscripcionesUpdate.count,
      };
    });
  },

  // 2. VALIDAR EL PAGO (Tu lógica + Corrección de Monto 🛡️)
  validarPago: async (data) => {
  const { pago_id, accion, usuario_admin_id, notas, monto_real_confirmado } = data;
  const esAprobado = accion === 'APROBAR';

  if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
    throw new Error('La acción debe ser APROBAR o RECHAZAR.');
  }

  return await prisma.$transaction(async (tx) => {
    // 🛡️ PASO 1: Buscar y Validar el pago (Usa tu Validator)
    let pago = await Validators.buscarYValidarPagoPendiente(tx, pago_id);

    // 👮‍♂️ PASO 2: Corrección de Monto por el Admin
    if (esAprobado && monto_real_confirmado) {
      const montoAdmin = Number.parseFloat(monto_real_confirmado);
      if (montoAdmin !== Number(pago.monto_pagado)) {
        pago = await tx.pagos.update({
          where: { id: pago.id },
          data: { 
            monto_pagado: montoAdmin,
            notas_validacion: `Monto corregido por Admin. (Reportado: ${pago.monto_pagado})`
          },
          include: { cuentas_por_cobrar: true }
        });
      }
    }

    // 💰 PASO 3: Lógica de Alcancía (Usa tu Logic)
    let saldoRestante = 0;
    let esPagoCompleto = false;
    
    if (esAprobado) {
      const saldos = await Logic.calcularSaldosAlcancía(tx, pago);
      saldoRestante = saldos.saldoRestante;
      esPagoCompleto = saldos.esPagoCompleto;
    }

    // 🔄 PASO 4: Determinar Evolución de Estados (Usa tu Logic)
    const { nuevoEstadoDeuda, activarAlumno } = await Logic.definirEvolucionDeEstados(
      tx, pago, esAprobado, esPagoCompleto
    );

    // 📝 PASO 5: Actualizar el Pago y la Deuda
    const notaFinalInformativa = esAprobado 
      ? (esPagoCompleto ? 'PAGO TOTAL' : `ABONO PARCIAL. Resta: S/ ${saldoRestante.toFixed(2)}`) 
      : 'Rechazado';

    const notasFinales = `${notas || ''} ${pago.notas_validacion || ''} | ${notaFinalInformativa}`;

    const pagoActualizado = await tx.pagos.update({
      where: { id: pago.id },
      data: {
        estado_validacion: esAprobado ? 'APROBADO' : 'RECHAZADO',
        revisado_por: Number.parseInt(usuario_admin_id),
        notas_validacion: notasFinales,
        fecha_pago: new Date(),
      }
    });

    await tx.cuentas_por_cobrar.update({
      where: { id: pago.cuenta_id },
      data: { estado: nuevoEstadoDeuda }
    });

    // 🎓 PASO 6: Gestión de Inscripciones y Asistencias
    if (activarAlumno) {
      // Activamos inscripciones del alumno
      const inscripciones = await tx.inscripciones.findMany({
        where: {
          alumno_id: pago.cuentas_por_cobrar.alumno_id,
          estado: { in: ['POR_VALIDAR', 'PENDIENTE_PAGO'] },
        },
        include: { horarios_clases: true },
      });

      for (const inscripcion of inscripciones) {
        await tx.inscripciones.update({
          where: { id: inscripcion.id },
          data: { estado: 'ACTIVO', actualizado_en: new Date() },
        });

        // Generar asistencias automáticas (Usa tu asistenciaService)
        await asistenciaService.generarClasesFuturas(tx, {
          inscripcion_id: inscripcion.id,
          dia_semana: inscripcion.horarios_clases.dia_semana,
          usuario_admin_id: Number.parseInt(usuario_admin_id),
          profesor_id: inscripcion.horarios_clases.profesor_id,
        });
      }
    } else if (!esAprobado) {
      // Si se rechaza, devolvemos a PENDIENTE_PAGO para que el "Francotirador" lo vea
      await tx.inscripciones.updateMany({
        where: {
          alumno_id: pago.cuentas_por_cobrar.alumno_id,
          estado: 'POR_VALIDAR',
        },
        data: { estado: 'PENDIENTE_PAGO' },
      });
    }

    return {
      resultado: Utils.generarMensajeResultado(accion, esPagoCompleto, saldoRestante),
      pago: pagoActualizado,
      saldo_pendiente: saldoRestante,
    };
  });
},
  obtenerTodos: async () => {
    return await prisma.pagos.findMany({
      include: {
        cuentas_por_cobrar: {
          include: { alumnos: { include: { usuarios: true } } }
        },
        metodos_pago: true,
        administrador: { include: { usuarios: true } }
      },
      orderBy: { fecha_pago: 'desc' }
    });
  },

  // 4. OBTENER PAGO POR ID
  obtenerPorId: async (id) => {
    const pago = await prisma.pagos.findUnique({
      where: { id: Number.parseInt(id) },
      include: {
        cuentas_por_cobrar: true,
        metodos_pago: true
      }
    });
    if (!pago) throw new Error('El pago no existe.');
    return pago;
  },

  // 5. ELIMINAR REGISTRO DE PAGO (Uso delicado)
  eliminarPago: async (id) => {
    return await prisma.pagos.delete({
      where: { id: Number.parseInt(id) }
    });
  }
};
