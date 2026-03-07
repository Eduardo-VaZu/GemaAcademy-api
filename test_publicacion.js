import { PrismaClient } from '@prisma/client';
import { publicacionService } from './src/features/publicaciones/publicacion.service.js';

const prisma = new PrismaClient();

const main = async () => {
    try {
        const admins = await prisma.administrador.findMany({ take: 1 });
        if (!admins.length) return console.log('No admins found in DB');
        
        console.log('Testing createPublicacion with admin:', admins[0].usuario_id);
        const res = await publicacionService.createPublicacion({
            titulo: 'Test Titulo',
            contenido: 'Test Contenido',
            autor_id: admins[0].usuario_id
        }, null); // no image
        
        console.log('Success:', res);
    } catch(e) {
        console.error('ERROR CATCHED:', e);
    } finally {
        await prisma.$disconnect();
    }
};
main();
