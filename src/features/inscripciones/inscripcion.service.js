import { prisma } from '../../config/database.config.js';

export const inscripcionService = {

  // 📦 Lógica Maestra: Inscripción Dinámica y Sincronizada
  inscribirPaquete: async (data) => {
    const { alumno_id, horario_ids } = data;

    // 1. Validación Básica
    if (!horario_ids || !Array.isArray(horario_ids) || horario_ids.length === 0) {
      throw new Error("Debes seleccionar al menos un horario.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // =================================================================
      // PASO 1: ANTI-ZOMBIE 🧟‍♂️ (Protección de Aforo)
      // =================================================================
      const paramTiempo = await tx.parametros_sistema.findUnique({ where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' } });
      const tiempoLimite = paramTiempo ? parseInt(paramTiempo.valor) : 20;
      const fechaLimiteZombie = new Date(Date.now() - tiempoLimite * 60 * 1000);

      // =================================================================
      // PASO 2: DETECTAR "FECHA GUÍA" (¿Es nuevo o antiguo?) 📅
      // =================================================================
      const hoy = new Date();
      let fechaCorte = null;
      let esInscripcionAdicional = false;

      // Buscamos si el alumno tiene una inscripción ACTIVA para saber su ciclo
      const ultimaInscripcionActiva = await tx.inscripciones.findFirst({
        where: {
          alumno_id: parseInt(alumno_id),
          estado: 'ACTIVO'
        },
        orderBy: { fecha_inscripcion: 'desc' }
      });

      if (ultimaInscripcionActiva) {
        esInscripcionAdicional = true;
        const fechaInicioCiclo = new Date(ultimaInscripcionActiva.fecha_inscripcion);
        
        // Calculamos el fin de su ciclo actual (30 días comercial)
        const fechaFinCiclo = new Date(fechaInicioCiclo);
        fechaFinCiclo.setDate(fechaFinCiclo.getDate() + 30); 

        // Solo sincronizamos si su ciclo vence en el futuro
        if (fechaFinCiclo > hoy) {
          fechaCorte = fechaFinCiclo;
          console.log(`🔄 Upgrade detectado. Sincronizando cierre al: ${fechaCorte.toISOString()}`);
        }
      }

      // =================================================================
      // PASO 3: OBTENER PRECIO DINÁMICO 💰
      // =================================================================
      const cantidadClases = horario_ids.length;

      // A. Buscamos el concepto exacto en la BD (ej: "2 clases" -> ID 2)
      let conceptoAplicar = await tx.catalogo_conceptos.findFirst({ 
        where: { 
            cantidad_clases_semanal: cantidadClases, 
            activo: true,
            es_vigente: true
        } 
      });

      // B. Fallback de Seguridad (Si elige 3 días y no existe plan de 3)
      if (!conceptoAplicar) {
         console.warn(`⚠️ No existe plan para ${cantidadClases} días. Calculando basado en unitario.`);
         
         const conceptoBase = await tx.catalogo_conceptos.findFirst({
            where: { cantidad_clases_semanal: 1, activo: true }
         });
         
         if (!conceptoBase) throw new Error("No hay planes de precios configurados en el sistema.");
         
         // Creamos un concepto temporal multiplicando el base
         conceptoAplicar = {
             ...conceptoBase,
             precio_base: Number(conceptoBase.precio_base) * cantidadClases,
             nombre: `Paquete Personalizado (${cantidadClases} días)`
         };
      }

      // C. Calculamos precio por clase individual (para prorrateos de upgrade)
      // Asumimos mes de 4 semanas para sacar el valor unitario
      const precioPorClase = Number(conceptoAplicar.precio_base) / (cantidadClases * 4); 

      // =================================================================
      // PASO 4: PROCESAR HORARIOS Y CALCULAR TOTAL 🔄
      // =================================================================
      const inscripcionesCreadas = [];
      let totalCobrar = 0;
      let detalleCobro = [];

      for (const idHorario of horario_ids) {
        
        // A. Validar Horario y Aforo
        const horario = await tx.horarios_clases.findUnique({ where: { id: idHorario } });
        if (!horario) throw new Error(`El horario ID ${idHorario} no existe.`);

        // Anti-Zombie Count
        const ocupados = await tx.inscripciones.count({
          where: {
            horario_id: idHorario,
            OR: [
              { estado: 'ACTIVO' }, 
              { estado: 'POR_VALIDAR' }, 
              { AND: [{ estado: 'PENDIENTE_PAGO' }, { fecha_inscripcion: { gt: fechaLimiteZombie } }] }
            ]
          },
        });

        if (ocupados >= horario.capacidad_max) throw new Error(`El horario del día ${horario.dia_semana} ya está AGOTADO.`);

        // B. Calcular Monto para este horario
        let montoEsteHorario = 0;

        if (esInscripcionAdicional && fechaCorte) {
          // --- MODO UPGRADE (Cobro proporcional hasta fin de mes) ---
          const clasesRestantes = contarClasesEnIntervalo(horario.dia_semana, hoy, fechaCorte);
          
          if (clasesRestantes > 0) {
            montoEsteHorario = clasesRestantes * precioPorClase;
            detalleCobro.push(`Upgrade ${horario.dia_semana} (${clasesRestantes} clases)`);
          } else {
            // Alineación gratuita (si vence mañana y no hay clase hoy)
            montoEsteHorario = 0; 
            detalleCobro.push(`Reserva ${horario.dia_semana} (Alineada)`);
          }

        } else {
          // --- MODO NUEVO (Cobro Full) ---
          // Dividimos el precio total del paquete entre los horarios para registrar
          montoEsteHorario = Number(conceptoAplicar.precio_base) / cantidadClases; 
          detalleCobro.push(`Mensualidad ${horario.dia_semana}`);
        }

        totalCobrar += montoEsteHorario;

        // C. Crear Inscripción
        const nuevaInscripcion = await tx.inscripciones.create({
          data: {
            alumnos: { connect: { usuario_id: parseInt(alumno_id) } },
            horarios_clases: { connect: { id: idHorario } },
            estado: 'PENDIENTE_PAGO',
            fecha_inscripcion: new Date(),
          },
          include: { horarios_clases: true }
        });
        inscripcionesCreadas.push(nuevaInscripcion);
      }

      // =================================================================
      // PASO 5: GENERAR LA DEUDA 💸
      // =================================================================
      if (totalCobrar > 0) {
        await tx.cuentas_por_cobrar.create({
          data: {
            alumnos: { connect: { usuario_id: parseInt(alumno_id) } },
            catalogo_conceptos: { connect: { id: conceptoAplicar.id } },
            
            // Unimos los detalles para que se vea bonito en el recibo
            detalle_adicional: [...new Set(detalleCobro)].join(' | '), 
            monto_final: totalCobrar,
            
            fecha_vencimiento: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)), // 48 horas para pagar
            estado: 'PENDIENTE',
          },
        });
      }

      return {
        mensaje: esInscripcionAdicional 
          ? "Upgrade exitoso. Ciclo sincronizado." 
          : "Inscripción creada. Ciclo iniciado.",
        total_a_pagar: totalCobrar,
        detalle: detalleCobro,
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

// --- FUNCIÓN AUXILIAR (Fuera del objeto, solo uso interno) ---
function contarClasesEnIntervalo(diaSemana, inicio, fin) {
  let contador = 0;
  let puntero = new Date(inicio);
  puntero.setHours(12,0,0,0); // Evitar líos de hora
  let finFijo = new Date(fin);
  finFijo.setHours(23,59,59,999);

  while (puntero <= finFijo) {
    if (puntero.getDay() === diaSemana) contador++;
    puntero.setDate(puntero.getDate() + 1);
  }
  return contador;
}