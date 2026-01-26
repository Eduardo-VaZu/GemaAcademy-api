import { prisma } from '../../config/database.config.js';

export const inscripcionService = {

  // Crear una nueva inscripción (Transaccional: Inscripción + Deuda)
  inscribirAlumno: async (data) => {
    const { alumno_id, horario_id } = data;

    /**
     * 🔐 USAMOS UNA TRANSACCIÓN ($transaction)
     * ¿Por qué? Porque necesitamos hacer varias cosas a la vez:
     * 1. Leer configuración y horario (sin que nadie lo cambie mientras leemos).
     * 2. Contar cupos con precisión milimétrica.
     * 3. Guardar la inscripción Y la deuda.
     * Si falla CUALQUIER paso (ej: se va la luz al crear la deuda), se deshace TODO.
     * Así evitamos tener alumnos inscritos sin deuda o cupos mal contados.
     */
    return await prisma.$transaction(async (tx) => {
      
      // =================================================================
      // 1. OBTENER REGLAS DEL JUEGO (Configuración Dinámica) 📏
      // =================================================================
      
      // A. Buscamos el Horario (Necesitamos saber el precio y si tiene excepción de tiempo)
      const horario = await tx.horarios_clases.findUnique({
        where: { id: parseInt(horario_id) },
        include: { niveles_entrenamiento: true } // Traemos esto para saber el PRECIO
      });

      if (!horario) throw new Error('El horario indicado no existe.');

      // B. Buscamos la Configuración Global del Sistema
      // Usamos findFirst porque solo existe una fila de configuración general.
      const configGlobal = await tx.configuracion_sistema.findFirst();
      
      // Si por error no corriste el seed y la tabla está vacía, usamos 20 min por seguridad.
      const tiempoGlobal = configGlobal?.tiempo_reserva_global || 20;

      // C. JERARQUÍA DE REGLAS (El "Cerebro" de la configuración) 🧠
      // Lógica: "Si el horario tiene un tiempo específico, úsalo. Si es null, usa el global".
      // El operador '??' hace exactamente eso: (Izquierda ?? Derecha).
      const minutosValidos = horario.minutos_reserva_especifico ?? tiempoGlobal;


      // =================================================================
      // 2. LÓGICA "ANTI-ZOMBIE" 🧟‍♂️ (Validación de Aforo Real)
      // =================================================================
      
      // Calculamos la "Fecha de Corte": 
      // Si son las 10:00am y damos 20 min, la fecha de corte es 09:40am.
      // Cualquier reserva PENDIENTE antes de las 09:40am ya CADUCÓ y no debe ocupar sitio.
      const fechaCorte = new Date(Date.now() - (minutosValidos * 60 * 1000));

      // Hacemos el conteo inteligente:
      const ocupados = await tx.inscripciones.count({
        where: {
          horario_id: parseInt(horario_id),
          OR: [
            // CASO A: Alumnos confirmados (Ya pagaron y el admin aprobó, o son becados).
            { estado: 'ACTIVO' }, 
            
            // CASO B: Alumnos en revisión (Ya subieron su foto del Yape, el cupo es suyo).
            { estado: 'POR_VALIDAR' }, 
            
            // CASO C: Reservas temporales VÁLIDAS (No Zombies).
            // Contamos 'PENDIENTE_PAGO' SOLO SI se crearon DESPUÉS de la fecha de corte.
            { 
              AND: [
                { estado: 'PENDIENTE_PAGO' },
                { fecha_inscripcion: { gt: fechaCorte } } // gt = Greater Than (Mayor/Más reciente que)
              ]
            }
          ]
        },
      });

      // Si después de filtrar a los zombies, sigue lleno... lanzamos error.
      if (ocupados >= horario.capacidad_max) {
        throw new Error('SOLD_OUT');
      }


      // =================================================================
      // 3. RESERVAR EL CUPO (Inicio del Cronómetro) ⏱️
      // =================================================================
      
      const nuevaInscripcion = await tx.inscripciones.create({
        data: {
          alumno_id: parseInt(alumno_id),
          horario_id: parseInt(horario_id),
          estado: 'PENDIENTE_PAGO', // El alumno entra en "limbo" hasta que pague
          fecha_inscripcion: new Date(), // Guardamos la hora exacta de inicio
        },
        // Incluimos datos para devolver una respuesta bonita al Front
        include: {
          alumnos: { include: { usuarios: true } },
          horarios_clases: { include: { canchas: true } }
        }
      });


      // =================================================================
      // 4. GENERAR LA DEUDA ("Me debes tanto") 💰
      // =================================================================
      
      // Obtenemos el precio del nivel (ej: Vóley Formativo = 150)
      const montoACobrar = horario.niveles_entrenamiento.precio_referencial || 0;

      await tx.cuentas_por_cobrar.create({
        data: {
          alumno_id: parseInt(alumno_id),
          // Si tuvieras un catálogo de conceptos, aquí iría el ID. Por ahora null.
          concepto_id: null, 
          detalle_adicional: `Mensualidad - ${horario.niveles_entrenamiento.nombre}`,
          monto_final: montoACobrar,
          // La deuda vence en 2 días (Regla de negocio aparte del cupo)
          fecha_vencimiento: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)), 
          estado: 'PENDIENTE',
        },
      });

      // Retornamos la inscripción + Metadatos para el Frontend
      return {
        ...nuevaInscripcion,
        meta: {
          mensaje: "Cupo reservado temporalmente. ¡Corre a pagar!",
          minutos_para_pagar: minutosValidos, // El Front necesita este número para el contador
          expira_en: new Date(Date.now() + (minutosValidos * 60 * 1000)) // Hora exacta fin
        }
      };
    });
  },

  // Obtener todas las inscripciones (Sin cambios mayores, solo ordenamiento)
  getAllInscripciones: async () => {
    return await prisma.inscripciones.findMany({
      include: {
        alumnos: {
          select: {
            usuarios: { select: { nombres: true, apellidos: true, email: true } }
          }
        },
        horarios_clases: {
          include: {
            niveles_entrenamiento: true,
            canchas: true
          }
        }
      },
      orderBy: { fecha_inscripcion: 'desc' }
    });
  }
};