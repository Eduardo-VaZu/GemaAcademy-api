-- CreateTable
CREATE TABLE "beneficios_pendientes" (
    "id" SERIAL NOT NULL,
    "alumno_id" INTEGER NOT NULL,
    "tipo_beneficio_id" INTEGER NOT NULL,
    "asignado_por" INTEGER NOT NULL,
    "motivo" VARCHAR(255),
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_asignacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficios_pendientes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "beneficios_pendientes" ADD CONSTRAINT "beneficios_pendientes_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumnos"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_pendientes" ADD CONSTRAINT "beneficios_pendientes_tipo_beneficio_id_fkey" FOREIGN KEY ("tipo_beneficio_id") REFERENCES "tipos_beneficio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
