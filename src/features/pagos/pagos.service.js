import { prisma } from '../../config/database.config.js';

export const pagosService = {
  registrarPago: async (data) => {
    // Recibimos "deuda_id" del front, pero internamente lo usaremos como "cuenta_id"
    const { deuda_id, monto, metodo_pago, codigo_operacion, voucher_url } = data;

    // 1. Validaciones básicas
    if (!deuda_id || !monto) throw new Error("Faltan datos obligatorios (deuda_id, monto).");

    return await prisma.$transaction(async (tx) => {
      
      // A. VALIDAR LA DEUDA (Usando 'id' de cuentas_por_cobrar)
      const deuda = await tx.cuentas_por_cobrar.findUnique({
        where: { id: parseInt(deuda_id) }
      });

      if (!deuda) throw new Error("La deuda indicada no existe.");
      if (deuda.estado === 'PAGADA') throw new Error("Esta deuda ya fue pagada anteriormente.");
      // Permitimos re-enviar si estaba PENDIENTE o POR_VALIDAR (para corregir vouchers)
      
      // B. BUSCAR EL ID DEL MÉTODO DE PAGO 🔍
      // Como tu base de datos pide un ID (metodo_pago_id), buscamos el texto que mandó el usuario.
      // Si no encuentra "YAPE" o "PLIN", usaremos el ID 1 por defecto (Asumiendo que 1 es Efectivo u Otros).
      let metodoEncontrado = await tx.metodos_pago.findFirst({
        where: { nombre: metodo_pago } 
      });
      
      // Si no existe el método, buscamos cualquiera para no romper el código
      if (!metodoEncontrado) {
         metodoEncontrado = await tx.metodos_pago.findFirst(); 
      }
      
      if (!metodoEncontrado) throw new Error("No hay métodos de pago configurados en el sistema.");


      // C. CREAR EL PAGO (Ahora sí con los campos correctos del Schema) ✅
      const nuevoPago = await tx.pagos.create({
        data: {
          cuenta_id: parseInt(deuda_id),          // <--- CORREGIDO: Es cuenta_id
          metodo_pago_id: metodoEncontrado.id,    // <--- CORREGIDO: Es un ID, no un string
          monto_pagado: parseFloat(monto),        // <--- CORREGIDO: En tu schema es monto_pagado
          url_comprobante: voucher_url,
          codigo_operacion: codigo_operacion || 'S/N', // Código opcional
          estado_validacion: 'PENDIENTE',         // Tu schema usa 'PENDIENTE' por defecto
          fecha_pago: new Date()
        }
      });

      // D. ACTUALIZAR ESTADO DE LA DEUDA
      await tx.cuentas_por_cobrar.update({
        where: { id: parseInt(deuda_id) },
        data: { estado: 'POR_VALIDAR' }
      });

      // E. CONGELAR EL CRONÓMETRO (Anti-Zombie) ❄️
      // Pasamos las inscripciones a POR_VALIDAR para que no se borren a los 20 mins.
      await tx.inscripciones.updateMany({
        where: {
          alumno_id: deuda.alumno_id, 
          estado: 'PENDIENTE_PAGO'
        },
        data: { estado: 'POR_VALIDAR' }
      });

      return nuevoPago;
    });
  }
};