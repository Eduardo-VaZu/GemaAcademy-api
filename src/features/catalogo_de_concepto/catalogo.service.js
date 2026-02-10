import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class CatalogoService {
    async findAll() {
        return await prisma.catalogo_conceptos.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        });
    }

    async findOne(id) {
        return await prisma.catalogo_conceptos.findUnique({
            where: { id }
        });
    }

    async create(data) {
        return await prisma.catalogo_conceptos.create({
            data: {
                codigo_interno: data.codigo_interno,
                nombre: data.nombre,
                precio_base: parseFloat(data.precio_base),
                cantidad_clases_semanal: data.cantidad_clases_semanal ? parseInt(data.cantidad_clases_semanal) : null,
                es_vigente: true,
                activo: true
            }
        });
    }

    async update(id, data) {
        return await prisma.catalogo_conceptos.update({
            where: { id },
            data: {
                ...data,
                precio_base: data.precio_base ? parseFloat(data.precio_base) : undefined,
                cantidad_clases_semanal: data.cantidad_clases_semanal ? parseInt(data.cantidad_clases_semanal) : undefined
            }
        });
    }

    async delete(id) {
        // Hacemos borrado lógico (activo: false) para no romper la relación con cuentas_por_cobrar
        return await prisma.catalogo_conceptos.update({
            where: { id },
            data: { activo: false, es_vigente: false }
        });
    }
}