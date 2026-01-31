import { prisma } from '../../config/database.config.js';

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
    const { pago_id, accion, usuario_admin_id, notas } = data; // accion: 'APROBAR' o 'RECHAZAR'

    if (!['APROBAR', 'RECHAZAR'].includes(accion)) {
      throw new Error("La acción debe ser APROBAR o RECHAZAR.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar el pago y ver si existe
      const pago = await tx.pagos.findUnique({
        where: { id: parseInt(pago_id) },
        include: { cuentas_por_cobrar: true } // Traemos la deuda para saber quién es el alumno
      });

      if (!pago) throw new Error("El pago ID indicado no existe.");
      if (pago.estado_validacion !== 'PENDIENTE') throw new Error("Este pago ya fue validado (no se puede editar).");

      // 2. Preparar los nuevos estados
      const esAprobado = accion === 'APROBAR';
      
      const nuevoEstadoPago = esAprobado ? 'APROBADO' : 'RECHAZADO';
      
      // Si se aprueba, la deuda muere (PAGADA). Si se rechaza, revive (PENDIENTE) para que pague de nuevo.
      const nuevoEstadoDeuda = esAprobado ? 'PAGADA' : 'PENDIENTE'; 
      
      // Si se aprueba, entra a la cancha (ACTIVO). Si se rechaza, vuelve a ser Zombie (PENDIENTE_PAGO) y podría perder el cupo.
      const nuevoEstadoInscripcion = esAprobado ? 'ACTIVO' : 'PENDIENTE_PAGO'; 

      // 3. Actualizar el PAGO 🧾
      const pagoActualizado = await tx.pagos.update({
        where: { id: parseInt(pago_id) },
        data: {
          estado_validacion: nuevoEstadoPago,
          revisado_por: parseInt(usuario_admin_id),
          notas_validacion: notas || '',
          // Si aprobamos, actualizamos la fecha al momento real de la confirmación financiera
          fecha_pago: esAprobado ? new Date() : pago.fecha_pago 
        }
      });

      // 4. Actualizar la DEUDA 💰
      await tx.cuentas_por_cobrar.update({
        where: { id: pago.cuenta_id },
        data: { estado: nuevoEstadoDeuda }
      });

      // 5. Actualizar las INSCRIPCIONES (La Gran Activación) 🏐
      // Buscamos las inscripciones de ESTE alumno que estaban esperando validación
      await tx.inscripciones.updateMany({
        where: {
          alumno_id: pago.cuentas_por_cobrar.alumno_id, // Usamos el alumno de la deuda original
          estado: 'POR_VALIDAR' 
        },
        data: {
          estado: nuevoEstadoInscripcion,
          actualizado_en: new Date()
        }
      });

      return {
        resultado: `Operación exitosa: Pago ${nuevoEstadoPago}`,
        pago: pagoActualizado
      };  
    });
  }
  
};