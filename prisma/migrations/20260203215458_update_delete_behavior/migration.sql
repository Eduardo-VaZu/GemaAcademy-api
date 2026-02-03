-- DropForeignKey
ALTER TABLE "administrador" DROP CONSTRAINT "administrador_sede_id_fkey";

-- DropForeignKey
ALTER TABLE "canchas" DROP CONSTRAINT "canchas_sede_id_fkey";

-- AddForeignKey
ALTER TABLE "administrador" ADD CONSTRAINT "administrador_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
