import { prisma } from "../../config/database.js";

export const getAllAdmin = async () => {
    return prisma.administrador.findMany();
};

export const getAdmin = async (id) => {
    return prisma.administrador.findUnique({
        where: { usuario_id: Number(id) }
    });
};

export const createAdmin = async ({ userData, adminData }) => {
    const user = await prisma.usuarios.create({
        data: {
            ...userData
        }
    });

    const admin = await prisma.administrador.create({
        data: {
            usuario_id: user.id,
            cargo: adminData.cargo,
            area: adminData.area,
            sede_id: adminData.sede_id,
        },
        include: { usuarios: true, sedes: true }
    });

    return admin;
};

export const updateAdmin = async (id, data) => {
    return prisma.usuarios.update({
        where: { id: Number(id) },
        data: {
            nombres: data.nombres,
            apellidos: data.apellidos,
            email: data.email,
            telefono_personal: data.telefono_personal,
            fecha_nacimiento: data.fecha_nacimiento,
            administrador: {
                update: {
                    sede_id: data.sede_id,
                    cargo: data.cargo,
                    area: data.area
                }
            }
        },
        include: {
            administrador: true
        }
    })
}

export const deleteAdmin = async (id) => {
    return prisma.$transaction([
        prisma.administrador.deleteMany({ where: { usuario_id: Number(id) } }),
        prisma.usuarios.delete({ where: { id: Number(id) } })
    ]);
};
