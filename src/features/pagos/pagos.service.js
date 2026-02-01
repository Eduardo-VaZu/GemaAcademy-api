import { prisma } from '../../config/database.config.js';
import { asistenciaService } from '../asistencia/asistencia.service.js';

export const pagosService = {

  registrarPago: async (data) => {
    const { 
      deuda_id, 
      monto, 
      metodo_pago, // Puede venir el ID (1) o el nombre ("YAPE")
      codigo_operacion, 
      voucher_url 
    } = data;

    // 1. Validaciones de Entrada
    if (!deuda_id || !monto) {
      throw new Error("Faltan datos obligatorios: deuda_id y monto.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // =======================================================
      // PASO A: VALIDAR LA DEUDA 🕵️‍♂️
      // =======================================================
      const deuda = await tx.cuentas_por_cobrar.findUnique({
        where: { id: parseInt(deuda_id) }
      });

      if (!deuda) throw new Error("La deuda indicada no existe.");
      if (deuda.estado === 'PAGADA') throw new Error("Esta deuda ya fue pagada completamente.");
      if (deuda.estado === 'POR_VALIDAR') throw new Error("Ya existe un pago en revisión para esta deuda.");

      // =======================================================
      // PASO B: RESOLVER EL MÉTODO DE PAGO 💳
      // =======================================================
      let metodoPagoId;

      // Si es un número, asumimos que es el ID directo
      if (!isNaN(metodo_pago)) {
        metodoPagoId = parseInt(metodo_pago);
      } else {
        // Si es texto (ej: "YAPE"), buscamos su ID
        const metodoEncontrado = await tx.metodos_pago.findFirst({
          where: { nombre: { contains: metodo_pago, mode: 'insensitive' } } // Búsqueda flexible
        });
        if (!metodoEncontrado) {
          // Fallback: Buscamos "TRANSFERENCIA" o el primero que haya
          const defaultMetodo = await tx.metodos_pago.findFirst();
          if (!defaultMetodo) throw new Error("No hay métodos de pago configurados en el sistema.");
          metodoPagoId = defaultMetodo.id;
        } else {
          metodoPagoId = metodoEncontrado.id;
        }
      }

      // =======================================================
      // PASO C: CREAR EL REGISTRO DE PAGO (Evidence) 🧾
      // =======================================================
      const nuevoPago = await tx.pagos.create({
        data: {
          cuenta_id: parseInt(deuda_id),
          metodo_pago_id: metodoPagoId,
          monto_pagado: parseFloat(monto),
          url_comprobante: voucher_url || null, // Mapeo correcto al schema
          codigo_operacion: codigo_operacion || 'S/N',
          estado_validacion: 'PENDIENTE',
          fecha_pago: new Date() // Timestamp exacto
        }
      });

      // =======================================================
      // PASO D: ACTUALIZAR ESTADOS (El Cambio de Fase) 🔄
      // =======================================================
      
      // 1. La Deuda pasa a revisión
      await tx.cuentas_por_cobrar.update({
        where: { id: parseInt(deuda_id) },
        data: { 
          estado: 'POR_VALIDAR',
          actualizado_en: new Date()
        }
      });

      // 2. EL CONGELAMIENTO DEL ZOMBIE 🧟‍♂️❄️
      // Buscamos las inscripciones de ESTE alumno que estén PENDIENTES
      // y las pasamos a POR_VALIDAR. Esto detiene el reloj en la Fase 1.
      const inscripcionesUpdate = await tx.inscripciones.updateMany({
        where: {
          alumno_id: deuda.alumno_id, // Aseguramos que sea del mismo alumno
          estado: 'PENDIENTE_PAGO'
        },
        data: { 
          estado: 'POR_VALIDAR',
          actualizado_en: new Date() // Importante para saber cuándo reportó
        }
      });

      return {
        success: true,
        mensaje: "Pago registrado. Cronómetro detenido.",
        pago: nuevoPago,
        cupos_asegurados: inscripcionesUpdate.count
      };
    });
  },
  validarPago: async (data) => {
    const { pago_id, accion, usuario_admin_id, notas } = data; 

    if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
      throw new Error("La acción debe ser APROBAR o RECHAZAR.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar el pago y la deuda asociada
      const pago = await tx.pagos.findUnique({
        where: { id: parseInt(pago_id) },
        include: { cuentas_por_cobrar: true } 
      });

      if (!pago) throw new Error("El pago ID indicado no existe.");
      if (pago.estado_validacion !== 'PENDIENTE') throw new Error("Este pago ya fue validado.");

      // 2. Definir lógica de estados
      const esAprobado = accion === 'APROBAR';
      const nuevoEstadoPago = esAprobado ? 'APROBADO' : 'RECHAZADO';
      const nuevoEstadoDeuda = esAprobado ? 'PAGADA' : 'PENDIENTE'; 
      const nuevoEstadoInscripcion = esAprobado ? 'ACTIVO' : 'PENDIENTE_PAGO'; 

      // 3. Actualizar el PAGO 
      const pagoActualizado = await tx.pagos.update({
        where: { id: parseInt(pago_id) },
        data: {
          estado_validacion: nuevoEstadoPago,
          revisado_por: parseInt(usuario_admin_id),
          notas_validacion: notas || '',
          fecha_pago: esAprobado ? new Date() : pago.fecha_pago 
        }
      });

      // 4. Actualizar la DEUDA 
      await tx.cuentas_por_cobrar.update({
        where: { id: pago.cuenta_id },
        data: { estado: nuevoEstadoDeuda }
      });

      // 5. Actualizar INSCRIPCIONES y GENERAR CLASES 🚀
      // Buscamos las inscripciones de este alumno que estaban esperando
      // ¡IMPORTANTE! Incluimos 'horarios_clases' para sacar el ID del Profesor
      const inscripciones = await tx.inscripciones.findMany({
        where: {
          alumno_id: pago.cuentas_por_cobrar.alumno_id, 
          estado: 'POR_VALIDAR' 
        },
        include: { horarios_clases: true } 
      });

      for (const inscripcion of inscripciones) {
        // A. Cambiar estado de inscripción
        await tx.inscripciones.update({
          where: { id: inscripcion.id },
          data: {
            estado: nuevoEstadoInscripcion,
            actualizado_en: new Date()
          }
        });

        // B. SI SE APRUEBA -> Generamos la Asistencia
        if (esAprobado) {
           // Obtenemos el ID del profesor desde el horario
           const profesorId = inscripcion.horarios_clases.profesor_id;

           await asistenciaService.generarClasesFuturas(tx, {
             inscripcion_id: inscripcion.id,
             dia_semana: inscripcion.horarios_clases.dia_semana,
             usuario_admin_id: parseInt(usuario_admin_id),
             profesor_id: profesorId // <--- Enviamos el ID del profesor correcto
           });
        }
      }

      return {
        resultado: `Operación exitosa: Pago ${nuevoEstadoPago}`,
        pago: pagoActualizado
      };
    });
  }
  
};