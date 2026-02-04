-- DropForeignKey
ALTER TABLE "horarios_clases" DROP CONSTRAINT "horarios_clases_cancha_id_fkey";

-- AddForeignKey
ALTER TABLE "horarios_clases" ADD CONSTRAINT "horarios_clases_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
