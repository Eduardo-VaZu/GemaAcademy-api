/*
  Warnings:

  - Made the column `fecha_inscripcion` on table `inscripciones` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "inscripciones" ALTER COLUMN "fecha_inscripcion" SET NOT NULL,
ALTER COLUMN "fecha_inscripcion" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "fecha_inscripcion" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE_PAGO';
