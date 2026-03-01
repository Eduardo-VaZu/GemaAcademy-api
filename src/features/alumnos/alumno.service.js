import { prisma } from '../../config/database.config.js';

export const alumnoService = {
  actualizarSoloCondiciones: async (usuarioId, condiciones) => {
    const id = parseInt(usuarioId);
    
    // 🚩 Mira esto en tu terminal negra de VS Code
    console.log("-----------------------------------------");
    console.log("🔍 DATOS PARA PRISMA:");
    console.log("ID:", id);
    console.log("Condiciones:", condiciones);
    console.log("-----------------------------------------");

    try {
      return await prisma.alumnos.update({
        where: { usuario_id: id },
        data: { 
          condiciones_medicas: String(condiciones || "") 
        }
      });
    } catch (e) {
      console.error("❌ ERROR DE PRISMA:", e.message);
      throw e;
    }
  }
};