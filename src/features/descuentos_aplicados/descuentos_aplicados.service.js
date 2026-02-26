import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DescuentosAplicadosService = {
  
  async aplicar({ cuenta_id, tipo_beneficio_id, admin_id, motivo }) {
    
    // 1. Validaciones de existencia y carga de relaciones
    const cuenta = await prisma.cuentas_por_cobrar.findUnique({
      where: { id: parseInt(cuenta_id) },
      include: { descuentos_aplicados: true } 
    });

    const beneficio = await prisma.tipos_beneficio.findUnique({
      where: { id: parseInt(tipo_beneficio_id) }
    });

    if (!beneficio || !cuenta) throw new Error("Cuenta o Beneficio no encontrado.");

    // 2. Regla de "Una sola vez" por cuenta
    const yaTieneEseBeneficio = cuenta.descuentos_aplicados.some(
      d => d.tipo_beneficio_id === parseInt(tipo_beneficio_id)
    );
    if (yaTieneEseBeneficio) throw new Error("Este beneficio ya fue aplicado a esta cuenta.");

    // 3. Verificación de estado de cuenta
    if (cuenta.estado === 'PAGADA') throw new Error("No se pueden aplicar descuentos a una cuenta ya pagada.");

    // 4. Lógica de cálculo (Monto Fijo vs Porcentaje)
    const deudaActual = parseFloat(cuenta.monto_final || 0); 
    const valorNominal = parseFloat(beneficio.valor_por_defecto);
    
    let descuentoReal = beneficio.es_porcentaje 
      ? deudaActual * (valorNominal / 100) 
      : valorNominal;

    // Protección contra saldos negativos
    const descuentoFinal = descuentoReal > deudaActual ? deudaActual : descuentoReal;

    // --- TRANSACCIÓN ATÓMICA ---
    return await prisma.$transaction(async (tx) => {
        
        // Paso A: Crear el registro del descuento
        const nuevoDescuento = await tx.descuentos_aplicados.create({
            data: {
                cuenta_id: parseInt(cuenta_id),
                tipo_beneficio_id: parseInt(tipo_beneficio_id),
                monto_nominal_aplicado: valorNominal,
                monto_dinero_descontado: descuentoFinal,
                motivo_detalle: motivo || `Descuento: ${beneficio.nombre}`,
                aplicado_por: parseInt(admin_id), // Conexión directa por ID según tu modelo
                fecha_aplicacion: new Date()
            }
        });

        // Paso B: Actualizar el monto_final en la cuenta
        const nuevoMonto = deudaActual - descuentoFinal;
        
        await tx.cuentas_por_cobrar.update({
            where: { id: parseInt(cuenta_id) },
            data: {
                monto_final: nuevoMonto,
                // Si el saldo llega a cero, se marca como PAGADA
                estado: nuevoMonto <= 0.01 ? 'PAGADA' : cuenta.estado,
                actualizado_en: new Date()
            }
        });

        return {
          success: true,
          mensaje: `S/ ${descuentoFinal.toFixed(2)} descontados correctamente.`,
          descuento: nuevoDescuento
        };
    });
  },

  // Dentro de DescuentosAplicadosService
async eliminar(descuento_id, restaurarBeneficio = false) {
  return await prisma.$transaction(async (tx) => {
    const descuento = await tx.descuentos_aplicados.findUnique({
      where: { id: parseInt(descuento_id) },
      include: { cuentas_por_cobrar: true }
    });

    if (!descuento) throw new Error("El descuento no existe.");

    // SOLO si se pide restaurar (Caso del Francotirador)
    if (restaurarBeneficio) {
      const beneficioPendiente = await tx.beneficios_pendientes.findFirst({
        where: {
          alumno_id: descuento.cuentas_por_cobrar.alumno_id,
          tipo_beneficio_id: descuento.tipo_beneficio_id,
          usado: true
        },
        orderBy: { fecha_asignacion: 'desc' }
      });

      if (beneficioPendiente) {
        await tx.beneficios_pendientes.update({
          where: { id: beneficioPendiente.id },
          data: { usado: false }
        });
      }
    }

    // Actualizamos la cuenta (esto sí debe pasar siempre para que el saldo sea real)
    const montoARestaurar = parseFloat(descuento.monto_dinero_descontado);
    const nuevaDeuda = parseFloat(descuento.cuentas_por_cobrar.monto_final) + montoARestaurar;

    await tx.cuentas_por_cobrar.update({
      where: { id: descuento.cuenta_id },
      data: {
        monto_final: nuevaDeuda,
        estado: nuevaDeuda > 0.01 ? 'PENDIENTE' : 'PAGADA'
      }
    });

    return await tx.descuentos_aplicados.delete({
      where: { id: parseInt(descuento_id) }
    });
  });
}, 

  async obtenerPorCuenta(cuentaId) {
    return await prisma.descuentos_aplicados.findMany({
      where: { cuenta_id: parseInt(cuentaId) },
      include: { 
        tipos_beneficio: true,
        administrador: {
          include: { usuarios: true } // Para ver quién lo aplicó en el historial
        }
      } 
    });
  }
};