import { prisma } from '../../config/database.config.js';

export const inscripcionService = {

  // =================================================================
  // 📦 LÓGICA MAESTRA: INSCRIPCIÓN / UPGRADE (Con Switch Legacy/Nuevo)
  // =================================================================
  inscribirPaquete: async (data) => {
    const { alumno_id, horario_ids } = data;

    // 1. Validación Básica
    if (!horario_ids || !Array.isArray(horario_ids) || horario_ids.length === 0) {
      throw new Error("Debes seleccionar al menos un horario.");
    }

    return await prisma.$transaction(async (tx) => {
      
      // 🛡️ PASO 0: EL MURO DE DEUDA
      const deudasPendientes = await tx.cuentas_por_cobrar.count({
        where: {
          alumno_id: parseInt(alumno_id),
          estado: { in: ['PENDIENTE', 'PARCIAL'] } 
        }
      });

      if (deudasPendientes > 0) {
        throw new Error("⛔ BLOQUEO: Tienes pagos pendientes. Cancela tu deuda anterior para poder inscribirte nuevamente.");
      }

      // PASO 1: CONFIGURACIÓN ANTI-ZOMBIE 🧟‍♂️
      const paramTiempo = await tx.parametros_sistema.findUnique({ where: { clave: 'TIEMPO_LIMITE_RESERVA_MIN' } });
      const tiempoLimite = paramTiempo ? parseInt(paramTiempo.valor) : 20;
      const fechaLimiteZombie = new Date(Date.now() - tiempoLimite * 60 * 1000);

      // =================================================================
      // 🕵️‍♂️ PASO 2: DETECTIVE DE RÉGIMEN (¿ES LEGACY O NUEVO?)
      // =================================================================
      const hoy = new Date();
      let fechaCorte = null;
      let esInscripcionAdicional = false;
      let esAlumnoLegacy = false; // Por defecto asumimos que es nuevo

      // A. Buscamos si tiene historial de pagos para definir su "Régimen"
      const ultimoPago = await tx.pagos.findFirst({
        where: { 
            cuentas_por_cobrar: { alumno_id: parseInt(alumno_id) },
            estado_validacion: 'APROBADO' 
        },
        orderBy: { fecha_pago: 'desc' },
        include: { cuentas_por_cobrar: { include: { catalogo_conceptos: true } } }
      });

      if (ultimoPago && ultimoPago.cuentas_por_cobrar.catalogo_conceptos) {
          // Si su último plan pagado NO ES VIGENTE, entonces es un alumno LEGACY (Antiguo)
          if (ultimoPago.cuentas_por_cobrar.catalogo_conceptos.es_vigente === false) {
              esAlumnoLegacy = true;
              console.log(`👴 Alumno ${alumno_id} detectado como LEGACY. Se aplicarán precios antiguos.`);
          }
      }

      // B. Lógica de Ciclo (Upgrade)
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
        const fechaFinCiclo = new Date(fechaInicioCiclo);
        fechaFinCiclo.setDate(fechaFinCiclo.getDate() + 30); 

        if (fechaFinCiclo > hoy) {
          fechaCorte = fechaFinCiclo;
        }
      }

      // =================================================================
      // 👮‍♂️ PASO 3: OBTENER PRECIO (SEGÚN RÉGIMEN)
      // =================================================================
      const cantidadClases = horario_ids.length;

      // EL SWITCH MÁGICO 🎚️
      // - Si es Legacy (esAlumnoLegacy = true) -> Busca es_vigente: false
      // - Si es Nuevo (esAlumnoLegacy = false)  -> Busca es_vigente: true
      const conceptoAplicar = await tx.catalogo_conceptos.findFirst({ 
        where: { 
            cantidad_clases_semanal: cantidadClases, 
            activo: true,
            es_vigente: !esAlumnoLegacy 
        } 
      });

      if (!conceptoAplicar) {
          const tipoPrecio = esAlumnoLegacy ? "ANTIGUO (Legacy)" : "VIGENTE (2026)";
          throw new Error(`⛔ No existe un plan de precios ${tipoPrecio} configurado para un paquete de ${cantidadClases} días a la semana. Contacta administración.`);
      }

      // 🧮 PREPARACIÓN PARA UPGRADES (Unitario Dinámico)
      let precioUnitarioOficial = 0;

      if (esInscripcionAdicional) {
          // ✅ CORRECCIÓN AQUÍ: Usamos el código corto que pusiste en la base de datos
          const codigoUnitarioBuscar = esAlumnoLegacy ? 'CLASE_UNI_LEGACY' : 'CLASE_UNITARIA_2026';

          const conceptoUnitario = await tx.catalogo_conceptos.findFirst({
            where: { codigo_interno: codigoUnitarioBuscar, activo: true }
          });
          
          if (!conceptoUnitario) {
              throw new Error(`⛔ ERROR DE CONFIGURACIÓN: No se encontró el concepto '${codigoUnitarioBuscar}'.`);
          }
          
          precioUnitarioOficial = Number(conceptoUnitario.precio_base);
      }

      // PASO 4: PROCESAR HORARIOS Y VALIDAR AFORO 🔄
      const inscripcionesCreadas = [];
      let totalCobrar = 0;
      let detalleCobro = [];

      for (const idHorario of horario_ids) {
        // A. Validar Horario
        const horario = await tx.horarios_clases.findUnique({ where: { id: idHorario } });
        if (!horario) throw new Error(`El horario ID ${idHorario} no existe.`);

        // B. CONTAR AFORO REAL
        const ocupados = await tx.inscripciones.count({
          where: {
            horario_id: idHorario,
            OR: [
              { estado: 'ACTIVO' }, 
              { estado: 'POR_VALIDAR' }, 
              { estado: 'VENCIDO' }, 
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
          // MODO UPGRADE
          const clasesRestantes = contarClasesEnIntervalo(horario.dia_semana, hoy, fechaCorte);
          if (clasesRestantes > 0) {
            montoEsteHorario = clasesRestantes * precioUnitarioOficial;
            detalleCobro.push(`Upgrade ${esAlumnoLegacy ? '(Legacy)' : ''} ${horario.dia_semana} (${clasesRestantes} clases x S/ ${precioUnitarioOficial.toFixed(2)})`);
          } else {
            detalleCobro.push(`Reserva ${horario.dia_semana} (Sincronización - Sin costo)`);
          }
        } else {
          // MODO NUEVO
          montoEsteHorario = Number(conceptoAplicar.precio_base) / cantidadClases; 
          detalleCobro.push(`Mensualidad ${esAlumnoLegacy ? '(Legacy)' : ''} ${horario.dia_semana}`);
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

      // PASO 5: GENERAR LA DEUDA 💸
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

  // =================================================================
  // 🔮 LA LÓGICA DEL PROFETA: Renovaciones Masivas (Herencia Estricta)
  // =================================================================
  generarRenovacionesMasivas: async (diasAnticipacion) => {
    console.log(`🔮 [SERVICIO] Buscando alumnos para renovar (Herencia de Plan)...`);
    
    // 1. CALCULAR FECHAS MÁGICAS
    const diasCiclo = 30;
    const diasAtras = diasCiclo - diasAnticipacion; 
    
    const inicioBusqueda = new Date();
    inicioBusqueda.setDate(inicioBusqueda.getDate() - diasAtras);
    inicioBusqueda.setHours(0,0,0,0);

    const finBusqueda = new Date(inicioBusqueda);
    finBusqueda.setHours(23,59,59,999);

    return await prisma.$transaction(async (tx) => {
        // 2. BUSCAR CANDIDATOS
        const candidatos = await tx.inscripciones.findMany({
            where: {
                estado: 'ACTIVO',
                fecha_inscripcion: { gte: inicioBusqueda, lte: finBusqueda }
            },
            distinct: ['alumno_id'] 
        });

        let renovacionesCreadas = 0;

        // 3. PROCESAR CADA ALUMNO
        for (const candidato of candidatos) {
            const alumnoId = candidato.alumno_id;

            // A. Anti-Duplicados
            const deudaExistente = await tx.cuentas_por_cobrar.findFirst({
                where: {
                    alumno_id: alumnoId,
                    estado: 'PENDIENTE',
                    detalle_adicional: { contains: 'Renovación Automática' },
                    creado_en: { gte: inicioBusqueda } 
                }
            });

            if (deudaExistente) continue; 

            // B. HERENCIA GENÉTICA DEL PLAN
            // Buscamos la última deuda generada para este alumno (su plan actual)
            const ultimaDeuda = await tx.cuentas_por_cobrar.findFirst({
                where: { alumno_id: alumnoId },
                orderBy: { id: 'desc' },
                include: { catalogo_conceptos: true }
            });

            if (!ultimaDeuda || !ultimaDeuda.catalogo_conceptos) {
                console.log(`⚠️ Alumno ${alumnoId} sin historial de precios. Se omite.`);
                continue;
            }

            // COPIAMOS EL PLAN TAL CUAL (Aunque es_vigente sea false)
            const conceptoHeredado = ultimaDeuda.catalogo_conceptos;

            if (!conceptoHeredado.activo) {
                 console.log(`⛔ El plan ID ${conceptoHeredado.id} está desactivado por completo. No se renueva.`);
                 continue;
            }

            // C. Validación de Cantidad de Clases
            const totalCursosActivos = await tx.inscripciones.count({
                where: { alumno_id: alumnoId, estado: 'ACTIVO' }
            });

            // Si sigue teniendo la misma cantidad de clases, le renovamos su plan viejo o nuevo
            if (conceptoHeredado.cantidad_clases_semanal === totalCursosActivos) {
                await tx.cuentas_por_cobrar.create({
                    data: {
                        alumno_id: alumnoId,
                        concepto_id: conceptoHeredado.id, 
                        monto_final: conceptoHeredado.precio_base,
                        detalle_adicional: `Renovación Automática (Plan: ${conceptoHeredado.nombre})`,
                        fecha_vencimiento: new Date(Date.now() + (diasAnticipacion * 24 * 60 * 60 * 1000)),
                        estado: 'PENDIENTE'
                    }
                });
                renovacionesCreadas++;
            } else {
                 console.log(`⚠️ Alumno ${alumnoId} cambió frecuencia (Tiene ${totalCursosActivos}, Plan era ${conceptoHeredado.cantidad_clases_semanal}).`);
            }
        }

        return renovacionesCreadas;
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