import { prisma } from '../../config/database.config.js';

export const inscripcionService = {

  // 📦 Lógica Maestra: Inscripción con Bloqueo de Deudores, Sincronización y Tolerancia
  inscribirPaquete: async (data) => {
    const { alumno_id, horario_ids } = data;

    // 1. Validación Básica
    if (!horario_ids || !Array.isArray(horario_ids) || horario_ids.length === 0) {
      throw new Error("Debes seleccionar al menos un horario.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // =================================================================
      // 🛡️ PASO 0: EL MURO DE DEUDA (Regla de Negocio Crítica)
      // =================================================================
      const deudasPendientes = await tx.cuentas_por_cobrar.count({
        where: {
          alumno_id: parseInt(alumno_id),
          estado: { in: ['PENDIENTE', 'PARCIAL'] }, 
          activo: true 
        }
      });

      if (deudasPendientes > 0) {
        throw new Error("⛔ BLOQUEO: Tienes pagos pendientes. Cancela tu deuda anterior para poder inscribirte nuevamente.");
      }

      // =================================================================
      // PASO 1: CONFIGURACIÓN ANTI-ZOMBIE 🧟‍♂️
      // =================================================================
      const paramTiempo = await tx.parametros_sistema.findUnique({ where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' } });
      const tiempoLimite = paramTiempo ? parseInt(paramTiempo.valor) : 20;
      const fechaLimiteZombie = new Date(Date.now() - tiempoLimite * 60 * 1000);

      // =================================================================
      // PASO 2: DETECTAR EL CICLO (¿Es nuevo o es Upgrade?) 📅
      // =================================================================
      const hoy = new Date();
      let fechaCorte = null;
      let esInscripcionAdicional = false;

      // Buscamos inscripción ACTIVA para sincronizar fechas
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
        
        // Calculamos fin de ciclo (30 días comercial)
        const fechaFinCiclo = new Date(fechaInicioCiclo);
        fechaFinCiclo.setDate(fechaFinCiclo.getDate() + 30); 

        // Solo aplicamos prorrateo si el ciclo vence en el futuro
        if (fechaFinCiclo > hoy) {
          fechaCorte = fechaFinCiclo;
          console.log(`🔄 Upgrade detectado. Sincronizando cierre al: ${fechaCorte.toISOString()}`);
        }
      }

      // =================================================================
      // 👮‍♂️ PASO 3: OBTENER PRECIO DINÁMICO (MODO ESTRICTO)
      // =================================================================
      const cantidadClases = horario_ids.length;

      // A. Buscamos el plan exacto por cantidad de días
      const conceptoAplicar = await tx.catalogo_conceptos.findFirst({ 
        where: { 
            cantidad_clases_semanal: cantidadClases, 
            activo: true,
            es_vigente: true
        } 
      });

      // B. VALIDACIÓN DE HIERRO: Si no existe, explota.
      if (!conceptoAplicar) {
         throw new Error(`⛔ ERROR DE CONFIGURACIÓN: No existe un plan de precios activo para un paquete de ${cantidadClases} días a la semana. Contacta al administrador.`);
      }

      // =================================================================
      // 🧮 PREPARACIÓN PARA UPGRADES (Cálculo Unitario Real)
      // =================================================================
      // ... (código anterior igual) ...

      // =================================================================
      // 🧮 PREPARACIÓN PARA UPGRADES (Cálculo Unitario Real)
      // =================================================================
      let precioUnitarioOficial = 0;

      if (esInscripcionAdicional) {
          // CAMBIO: Ahora buscamos el "Concepto Unitario" específico en la BD
          // Ya no dividimos nada. Usamos el precio que tú configuraste.
          const conceptoUnitario = await tx.catalogo_conceptos.findFirst({
            where: { codigo_interno: 'CLASE_UNITARIA_2026', activo: true }
          });
          
          if (!conceptoUnitario) {
             throw new Error("⛔ ERROR DE CONFIGURACIÓN: No se encontró el precio 'CLASE_UNITARIA_2026' en el catálogo. Es necesario para calcular el cobro proporcional del upgrade.");
          }
          
          // Usamos el precio directo de la base de datos
          precioUnitarioOficial = Number(conceptoUnitario.precio_base);
          
          console.log(`💰 Precio base para cálculo: S/ ${precioUnitarioOficial} por clase.`);
      }

      // ... (el resto del código sigue igual, usando precioUnitarioOficial) ...

      // =================================================================
      // PASO 4: PROCESAR HORARIOS Y VALIDAR AFORO 🔄
      // =================================================================
      const inscripcionesCreadas = [];
      let totalCobrar = 0;
      let detalleCobro = [];

      for (const idHorario of horario_ids) {
        
        // A. Validar Horario
        const horario = await tx.horarios_clases.findUnique({ where: { id: idHorario } });
        if (!horario) throw new Error(`El horario ID ${idHorario} no existe.`);

        // B. CONTAR AFORO REAL (Incluyendo VENCIDOS en tolerancia)
        const ocupados = await tx.inscripciones.count({
          where: {
            horario_id: idHorario,
            OR: [
              { estado: 'ACTIVO' }, 
              { estado: 'POR_VALIDAR' }, 
              { estado: 'VENCIDO' }, // El sitio del "Vencido" se respeta
              { AND: [{ estado: 'PENDIENTE_PAGO' }, { fecha_inscripcion: { gt: fechaLimiteZombie } }] }
            ]
          },
        });

        if (ocupados >= horario.capacidad_max) {
          throw new Error(`El horario del día ${horario.dia_semana} ya está AGOTADO.`);
        }

        // C. Calcular Monto Específico
        let montoEsteHorario = 0;

        if (esInscripcionAdicional && fechaCorte) {
          // --- MODO UPGRADE (Preciso) ---
          // Contamos cuántas clases reales quedan en el calendario
          const clasesRestantes = contarClasesEnIntervalo(horario.dia_semana, hoy, fechaCorte);
          
          if (clasesRestantes > 0) {
            // Multiplicamos clases reales * precio unitario oficial
            montoEsteHorario = clasesRestantes * precioUnitarioOficial;
            detalleCobro.push(`Upgrade ${horario.dia_semana} (${clasesRestantes} clases x S/ ${precioUnitarioOficial.toFixed(2)})`);
          } else {
            montoEsteHorario = 0; 
            detalleCobro.push(`Reserva ${horario.dia_semana} (Sincronización - Sin costo)`);
          }

        } else {
          // --- MODO NUEVO (Full) ---
          // Dividimos el precio del paquete entre los días para referencia interna
          montoEsteHorario = Number(conceptoAplicar.precio_base) / cantidadClases; 
          detalleCobro.push(`Mensualidad ${horario.dia_semana}`);
        }

        totalCobrar += montoEsteHorario;

        // D. Crear Inscripción
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
            detalle_adicional: [...new Set(detalleCobro)].join(' | '), 
            monto_final: totalCobrar,
            fecha_vencimiento: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)), 
            estado: 'PENDIENTE',
          },
        });
      }

      return {
        mensaje: esInscripcionAdicional ? "Upgrade procesado correctamente." : "Inscripción creada. Realiza el pago.",
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

// --- HELPER (Calendario) ---
function contarClasesEnIntervalo(diaSemana, inicio, fin) {
  let contador = 0;
  let puntero = new Date(inicio);
  puntero.setHours(12,0,0,0); 
  let finFijo = new Date(fin);
  finFijo.setHours(23,59,59,999);

  while (puntero <= finFijo) {
    if (puntero.getDay() === diaSemana) contador++;
    puntero.setDate(puntero.getDate() + 1);
  }
  return contador;
}