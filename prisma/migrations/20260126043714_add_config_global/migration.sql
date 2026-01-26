-- AlterTable
ALTER TABLE "horarios_clases" ADD COLUMN     "minutos_reserva_especifico" INTEGER;

-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" SERIAL NOT NULL,
    "tiempo_reserva_global" INTEGER NOT NULL DEFAULT 20,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);
