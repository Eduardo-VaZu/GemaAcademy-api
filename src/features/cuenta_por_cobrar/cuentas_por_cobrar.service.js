import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CuentasPorCobrarService = {
  // Obtener todas las cuentas con los nombres exactos de tu schema
  async obtenerTodas() {
    return await prisma.cuentas_por_cobrar.findMany({
      include: {
        alumnos: {
          include: {
            usuarios: true, // Para traer el nombre del alumno desde la tabla usuarios
          },
        },
        catalogo_conceptos: true, // Nombre exacto según tu model cuentas_por_cobrar
      },
      orderBy: { creado_en: 'desc' },
    });
  },

  async crear(data) {
    // Iniciamos transacción para que la creación + descuento sean un solo bloque indivisible
    return await prisma.$transaction(async (tx) => {
      // 1. Crear la cuenta (Tu código original con tx)
      const nuevaCuenta = await tx.cuentas_por_cobrar.create({
        data: {
          alumno_id: parseInt(data.alumno_id),
          concepto_id: data.concepto_id ? parseInt(data.concepto_id) : null,
          detalle_adicional: data.detalle_adicional,
          monto_final: parseFloat(data.monto_final),
          fecha_vencimiento: new Date(data.fecha_vencimiento),
          estado: data.estado || 'PENDIENTE',
        },
      });

      // 2. BUSCAR BENEFICIOS PENDIENTES
      const beneficiosEnCola = await tx.beneficios_pendientes.findMany({
        where: {
          alumno_id: nuevaCuenta.alumno_id,
          usado: false,
        },
        include: { tipos_beneficio: true },
      });

      // 3. SI HAY BENEFICIOS, LOS APLICAMOS
      if (beneficiosEnCola.length > 0) {
        for (const pendiente of beneficiosEnCola) {
          // Calculamos el descuento (Reutilizando tu lógica de Porcentaje vs Monto Fijo)
          const deudaActual = parseFloat(nuevaCuenta.monto_final);
          const valorNominal = parseFloat(pendiente.tipos_beneficio.valor_por_defecto);

          let descuentoReal = pendiente.tipos_beneficio.es_porcentaje
            ? deudaActual * (valorNominal / 100)
            : valorNominal;

          // Protección contra saldos negativos
          const descuentoFinal = descuentoReal > deudaActual ? deudaActual : descuentoReal;
          const nuevoMonto = deudaActual - descuentoFinal;

          // A. Registrar en descuentos_aplicados
          await tx.descuentos_aplicados.create({
            data: {
              cuenta_id: nuevaCuenta.id,
              tipo_beneficio_id: pendiente.tipo_beneficio_id,
              monto_nominal_aplicado: valorNominal,
              monto_dinero_descontado: descuentoFinal,
              motivo_detalle: pendiente.motivo || 'Aplicación automática de beneficio pendiente',
              aplicado_por: pendiente.asignado_por,
              fecha_aplicacion: new Date(),
            },
          });

          // B. Actualizar el monto en la cuenta recién creada
          await tx.cuentas_por_cobrar.update({
            where: { id: nuevaCuenta.id },
            data: {
              monto_final: nuevoMonto,
              estado: nuevoMonto <= 0.01 ? 'PAGADA' : nuevaCuenta.estado,
              actualizado_en: new Date(),
            },
          });

          // C. Marcar el beneficio pendiente como USADO
          await tx.beneficios_pendientes.update({
            where: { id: pendiente.id },
            data: { usado: true },
          });
        }
      }

      // Retornamos la cuenta final (ya sea con descuento o sin él)
      return await tx.cuentas_por_cobrar.findUnique({
        where: { id: nuevaCuenta.id },
        include: { descuentos_aplicados: true, catalogo_conceptos: true },
      });
    });
  },

  async eliminar(id, restaurarBeneficios = false) {
    return await prisma.$transaction(async (tx) => {
      console.log(`🔍 [DEBUG] Iniciando eliminación de cuenta ID: ${id}`);

      const cuenta = await tx.cuentas_por_cobrar.findUnique({
        where: { id: parseInt(id) },
        include: { descuentos_aplicados: true, pagos: true },
      });

      if (!cuenta) {
        console.log(`⚠️ [DEBUG] La cuenta ${id} ya no existe.`);
        return;
      }

      // PASO 1: Descuentos
      console.log(`Step 1: Borrando ${cuenta.descuentos_aplicados.length} descuentos aplicados...`);
      await tx.descuentos_aplicados.deleteMany({
        where: { cuenta_id: cuenta.id },
      });
      console.log(`✅ Step 1 completado.`);

      // PASO 2: Beneficios Pendientes
      if (restaurarBeneficios && cuenta.descuentos_aplicados.length > 0) {
        console.log(`Step 2: Restaurando beneficios para el alumno ${cuenta.alumno_id}...`);
        for (const desc of cuenta.descuentos_aplicados) {
          await tx.beneficios_pendientes.updateMany({
            where: {
              alumno_id: cuenta.alumno_id,
              tipo_beneficio_id: desc.tipo_beneficio_id,
              usado: true,
            },
            data: { usado: false },
          });
        }
        console.log(`✅ Step 2 completado.`);
      }

      // PASO 3: Pagos (Posible culpable)
      console.log(`Step 3: Borrando pagos asociados...`);
      const pagosBorrados = await tx.pagos.deleteMany({
        where: { cuenta_id: cuenta.id },
      });
      console.log(`✅ Step 3 completado (Borrados: ${pagosBorrados.count}).`);

      // PASO 4: Intento de borrado final
      console.log(`Step 4: Intentando borrar la cuenta principal ID: ${id}...`);
      const resultado = await tx.cuentas_por_cobrar.delete({
        where: { id: cuenta.id },
      });
      console.log(`🚀 [SUCCESS] Cuenta ${id} eliminada exitosamente.`);

      return resultado;
    });
  },

  async obtenerPorId(id) {
    const cuenta = await prisma.cuentas_por_cobrar.findUnique({
      where: { id: parseInt(id) },
      include: {
        alumnos: { include: { usuarios: true } },
        catalogo_conceptos: true,
      },
    });
    if (!cuenta) throw new Error('Cuenta no encontrada');
    return cuenta;
  },

  async actualizar(id, data) {
    return await prisma.cuentas_por_cobrar.update({
      where: { id: parseInt(id) },
      data: {
        alumno_id: data.alumno_id ? parseInt(data.alumno_id) : undefined,
        concepto_id: data.concepto_id ? parseInt(data.concepto_id) : undefined,
        detalle_adicional: data.detalle_adicional,
        monto_final: data.monto_final ? parseFloat(data.monto_final) : undefined,
        fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : undefined,
        estado: data.estado,
        actualizado_en: new Date(),
      },
    });
  },

  async obtenerTodoPorAlumno(alumnoId) {
    return await prisma.cuentas_por_cobrar.findMany({
      where: {
        alumno_id: parseInt(alumnoId),
      },
      include: {
        catalogo_conceptos: true,
        pagos: {
          // Es vital traer los pagos aprobados para que el Front calcule saldos
          where: { estado_validacion: 'APROBADO' },
          select: {
            id: true,
            monto_pagado: true,
            fecha_pago: true,
            estado_validacion: true,
          },
        },
      },
      orderBy: { fecha_vencimiento: 'desc' }, // Lo más reciente primero
    });
  },

  // eslint-disable-next-line no-dupe-keys
  async eliminar(id) {
    return await prisma.cuentas_por_cobrar.delete({
      where: { id: parseInt(id) },
    });
  },
};
