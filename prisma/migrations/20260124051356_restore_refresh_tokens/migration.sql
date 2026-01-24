-- CreateTable
CREATE TABLE "descuentos_aplicados" (
    "id" SERIAL NOT NULL,
    "cuenta_id" INTEGER NOT NULL,
    "tipo_beneficio_id" INTEGER NOT NULL,
    "monto_nominal_aplicado" DECIMAL(10,2) NOT NULL,
    "monto_dinero_descontado" DECIMAL(10,2) NOT NULL,
    "motivo_detalle" VARCHAR(255),
    "aplicado_por" INTEGER,
    "fecha_aplicacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descuentos_aplicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_beneficio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "es_porcentaje" BOOLEAN DEFAULT false,
    "valor_por_defecto" DECIMAL(10,2),
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "tipos_beneficio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_beneficio_nombre_key" ON "tipos_beneficio"("nombre");

-- AddForeignKey
ALTER TABLE "descuentos_aplicados" ADD CONSTRAINT "descuentos_aplicados_aplicado_por_fkey" FOREIGN KEY ("aplicado_por") REFERENCES "administrador"("usuario_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "descuentos_aplicados" ADD CONSTRAINT "descuentos_aplicados_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_por_cobrar"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "descuentos_aplicados" ADD CONSTRAINT "descuentos_aplicados_tipo_beneficio_id_fkey" FOREIGN KEY ("tipo_beneficio_id") REFERENCES "tipos_beneficio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
