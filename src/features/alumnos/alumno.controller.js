import { alumnoService } from './alumno.service.js';

export const alumnoController = {
  actualizarMiPerfil: async (req, res) => {
    try {
      const usuarioId = req.params.id;

      // 1. Extraemos la data exactamente como la armaste en Postman
      const condiciones = req.body.datosRolEspecifico?.condiciones_medicas;

      console.log(`🔥 LLEGÓ AL CONTROLADOR - ID: ${usuarioId}, Condiciones: ${condiciones}`);

      // 2. Llamamos a tu Service intacto
      const resultado = await alumnoService.actualizarSoloCondiciones(usuarioId, condiciones);

      return res.status(200).json({
        success: true,
        message: "¡POR FIN FUNCIONÓ!",
        data: resultado
      });

    } catch (error) {
      // 🚨 3. LA TRAMPA: Devolvemos el error directo a Postman saltándonos el errorHandler
      console.error("🚨 FALLO REAL:", error.message);
      
      return res.status(500).json({
        success: false,
        message: "¡TE ATRAPÉ! El error real de Prisma es: " + error.message,
        codigoPrisma: error.code || "Desconocido"
      });
    }
  }
};