/*
  Warnings:

  - You are about to drop the column `tarifa_hora` on the `profesores` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "alumnos" ADD COLUMN     "direccion_id" INTEGER;

-- AlterTable
ALTER TABLE "profesores" DROP COLUMN "tarifa_hora";

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direcciones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
