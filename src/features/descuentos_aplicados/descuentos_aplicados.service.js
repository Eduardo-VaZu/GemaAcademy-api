import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DescuentosAplicadosService = {
  
  async aplicar({ cuenta_id, tipo_beneficio_id, admin_id, motivo }) {
    
    // 1. Validaciones previas (igual que antes)
    const cuenta = await prisma.cuentas_por_cobrar.findUnique({
      where: { id: parseInt(cuenta_id) }
    });
    const beneficio = await prisma.tipos_beneficio.findUnique({
      where: { id: parseInt(tipo_beneficio_id) }
    });

    if (!beneficio || !cuenta) throw new Error("Datos no encontrados");

    // Calculamos montos
    const deudaTotal = parseFloat(cuenta.monto_final || 0); 
    const valorNominal = parseFloat(beneficio.valor_por_defecto);
    let descuentoReal = 0;

    if (beneficio.es_porcentaje) {
      descuentoReal = deudaTotal * (valorNominal / 100);
    } else {
      descuentoReal = valorNominal;
    }

    // --- AQUÍ EMPIEZA LA MAGIA DE LA TRANSACCIÓN ---
    // "tx" es una mini-instancia de prisma que controla que todo pase junto
    return await prisma.$transaction(async (tx) => {
        
        // Paso A: Crear el registro del descuento (Historial)
        const nuevoDescuento = await tx.descuentos_aplicados.create({
            data: {
                monto_nominal_aplicado: valorNominal,
                monto_dinero_descontado: descuentoReal,
                motivo_detalle: motivo,
                fecha_aplicacion: new Date(),
                cuentas_por_cobrar: { connect: { id: parseInt(cuenta_id) } },
                tipos_beneficio: { connect: { id: parseInt(tipo_beneficio_id) } },
                administrador: { connect: { usuario_id: parseInt(admin_id) } }
            }
        });

        // Paso B: ACTUALIZAR la cuenta por cobrar (Restar la deuda)
        // Usamos 'decrement' para que sea matemáticamente seguro
        await tx.cuentas_por_cobrar.update({
            where: { id: parseInt(cuenta_id) },
            data: {
                monto_final: {
                    decrement: descuentoReal // Resta automática
                }
            }
        });

        return nuevoDescuento;
    });
  },

  async obtenerPorCuenta(cuentaId) {
    return await prisma.descuentos_aplicados.findMany({
      where: { cuenta_id: parseInt(cuentaId) },
      include: { tipos_beneficio: true } 
    });
  }
};