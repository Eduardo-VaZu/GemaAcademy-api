-- AlterTable
ALTER TABLE "catalogo_conceptos" ADD COLUMN     "cantidad_clases_semanal" INTEGER,
ADD COLUMN     "es_vigente" BOOLEAN NOT NULL DEFAULT true;
