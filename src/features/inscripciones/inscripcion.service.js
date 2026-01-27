import { prisma } from '../../config/database.config.js';

export const inscripcionService = {

  // 📦 Lógica Maestra: Inscripción por Paquetes
  inscribirPaquete: async (data) => {
    const { alumno_id, horario_ids } = data;

    // 1. Validación Básica
    if (!horario_ids || !Array.isArray(horario_ids) || horario_ids.length === 0) {
      throw new Error("Debes seleccionar al menos un horario.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // =================================================================
      // PASO A: DETECCIÓN AUTOMÁTICA DE PRECIO 🏷️
      // =================================================================
      const cantidadClases = horario_ids.length;

      // Buscamos el precio VIGENTE para esa cantidad
      const conceptoCobro = await tx.catalogo_conceptos.findFirst({
        where: {
          cantidad_clases_semanal: cantidadClases, 
          es_vigente: true,
          activo: true
        }
      });

      if (!conceptoCobro) {
        throw new Error(`No existe un plan de precios configurado para ${cantidadClases} clases por semana.`);
      }

      const configGlobal = await tx.configuracion_sistema.findFirst();
      const tiempoGlobal = configGlobal?.tiempo_reserva_global || 20;

      // =================================================================
      // PASO B: BUCLE DE RESERVA 🔄
      // =================================================================
      const inscripcionesCreadas = [];

      for (const idHorario of horario_ids) {
        // 1. Validar horario
        const horario = await tx.horarios_clases.findUnique({ where: { id: idHorario } });
        if (!horario) throw new Error(`El horario ID ${idHorario} no existe.`);

        const tiempoHorario = horario.minutos_reserva_especifico ?? tiempoGlobal;
        const fechaCorte = new Date(Date.now() - (tiempoHorario * 60 * 1000));
        
        // 2. Anti-Zombie
        const ocupados = await tx.inscripciones.count({
          where: {
            horario_id: idHorario,
            OR: [
              { estado: 'ACTIVO' }, 
              { estado: 'POR_VALIDAR' }, 
              { AND: [{ estado: 'PENDIENTE_PAGO' }, { fecha_inscripcion: { gt: fechaCorte } }] }
            ]
          },
        });

        if (ocupados >= horario.capacidad_max) {
          throw new Error(`El horario del día ${horario.dia_semana} (ID: ${idHorario}) ya está AGOTADO.`);
        }

        // 3. Crear Inscripción (Aquí usamos connect para ser más seguros)
        const nuevaInscripcion = await tx.inscripciones.create({
          data: {
            alumnos: { connect: { usuario_id: parseInt(alumno_id) } }, // 👈 CORRECCIÓN 1: Conexión explícita
            horarios_clases: { connect: { id: idHorario } },           // 👈 CORRECCIÓN 1: Conexión explícita
            estado: 'PENDIENTE_PAGO',
            fecha_inscripcion: new Date(),
          },
          include: { horarios_clases: true }
        });
        inscripcionesCreadas.push(nuevaInscripcion);
      }

      // =================================================================
      // PASO C: GENERAR DEUDA (Aquí estaba el NaN) 💰
      // =================================================================
      
      await tx.cuentas_por_cobrar.create({
        data: {
          // Relación con el Alumno (Sintaxis explícita para evitar error)
          alumnos: { 
             connect: { usuario_id: parseInt(alumno_id) } 
          },
          
          // Relación con el Concepto
          catalogo_conceptos: {
             connect: { id: conceptoCobro.id }
          },

          detalle_adicional: `Paquete ${cantidadClases} clases/sem - ${conceptoCobro.nombre}`,
          
          // ⚠️ CORRECCIÓN 2 (CRÍTICA): Usamos 'precio_base', NO 'monto'
          monto_final: Number(conceptoCobro.precio_base), 
          
          fecha_vencimiento: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)),
          estado: 'PENDIENTE',
        },
      });

      return {
        mensaje: "Paquete reservado con éxito",
        total_a_pagar: Number(conceptoCobro.precio_base), // 👈 También corregido aquí
        concepto_aplicado: conceptoCobro.nombre,
        inscripciones: inscripcionesCreadas
      };
    });
  },

  getAllInscripciones: async () => {
    return await prisma.inscripciones.findMany({
      include: {
        alumnos: { include: { usuarios: { select: { nombres: true, apellidos: true, email: true } } } },
        horarios_clases: { include: { canchas: true, niveles_entrenamiento: true } }
      },
      orderBy: { fecha_inscripcion: 'desc' }
    });
  }
};