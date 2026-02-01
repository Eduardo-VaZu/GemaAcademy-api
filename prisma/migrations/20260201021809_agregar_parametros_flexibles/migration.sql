/*
  Warnings:

  - You are about to drop the `configuracion_sistema` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `fecha_inscripcion` on table `inscripciones` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "inscripciones" ALTER COLUMN "fecha_inscripcion" SET NOT NULL,
ALTER COLUMN "fecha_inscripcion" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "fecha_inscripcion" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE_PAGO';

-- DropTable
DROP TABLE "configuracion_sistema";

-- CreateTable
CREATE TABLE "parametros_sistema" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametros_sistema_clave_key" ON "parametros_sistema"("clave");
