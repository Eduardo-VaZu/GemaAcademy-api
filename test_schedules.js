import { PrismaClient } from '@prisma/client';
import { horarioService } from './src/features/horarios/horario.service.js';

const prisma = new PrismaClient();

const main = async () => {
  try {
    const allHorarios = await prisma.horarios_clases.findMany({ where: { activo: true } });
    console.log(`Found ${allHorarios.length} active schedules. Testing updates...`);
    
    for (const h of allHorarios) {
      try {
        // Change hora fin just a bit
        let newEnd = new Date(h.hora_fin.getTime() + 60000); 
        let newEndStr = newEnd.toISOString().substring(11, 16);
        
        await horarioService.updateHorario(h.id, {
            cancha_id: h.cancha_id,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio.toISOString().substring(11, 16),
            hora_fin: newEndStr
        });
        console.log(`Update OK for ID: ${h.id}`);
      } catch(e) {
        console.log(`Update FAIL for ID: ${h.id} -> ${e.message}`);
      }
    }
  } catch(e) { console.error(e); }
  finally {
    await prisma.$disconnect();
  }
};
main();
