# Feature Cron: Notificador WhatsApp Pre-Liquidación (Twilio) 📲

## 1. Problema de Negocio
Las renovaciones en GemaAcademy originaban **pagos parciales** que se convertían en deudas estáticas (`estado: PARCIAL`).
Existía un script purificador (*El Liquidador Parcial*) que mataba sin avisos a los morosos borrándolos de su lista de asistencia a las clases, dejándoles las deudas intactas en la contabilidad.
Se requería un sistema que notifique amable y automáticamente al cliente de su recorte de asistencia con 48 horas (2 días) anticipados al momento de ese juicio automatizado.

## 2. Archivos Afectados
La modificación se dispersó por la arquitectura sin alterar de forma destructiva ningún backend anterior:
```text
prisma/schema.prisma                             # Control Anti-Spam Booleano [NEW DB COLUMN]
src/features/inscripciones/notificacion-cron.js  # Lógica principal del Notificador [NUEVO SCRIPT]
src/features/cron/services/cron-jobs.service.js  # Timer Global Inyector [MODIFICADO]
```

## 3. Modelo de Control Anti-Spam (Idempotencia DB)
Si el servidor falla o reinicia múltiples veces en el día, disparará el script de notificación varias veces. Enviar 10 veces un requerimiento monetario al celular generará ira al usuario y consumirá dinero pagado de Twilio (SaaS).

**Solución Antigravity:**
Se inyectó en el modelo de Prisma `cuentas_por_cobrar` el campo reservado:
`notificacion_parcial_enviada Boolean? @default(false)`
Cuando el WhatsApp abandona con OK HTTP Status el Gateway de Meta/Twilio, se bloquea el booleano permanentemente.

## 4. Ingeniería Matemática Tempórea

El Notificador no utiliza días "duros" (*hardcoded*), lee el comportamiento dinámico desde la tabla de parámetros `parametros_sistema` de la BDD.

*   `diasProfeta`: (Ej. 5) Configurado en el sistema globalmente como los días de Pre-Vencimiento donde el Alumno debe renovar.
*   `dias_Liquidador`: (Ej. 6) `Profeta + 1`. El Liquidador los suspende un santiamén después.
*   `dias_WhatsApp`: (Ej. 8) `Liquidador + 2`. Ataca y notifica a los *8 días* previos al fin nominal del mes de suscripción.

## 5. Middleware y Extracción
Este Feature interno es auto-ejecutable y no mapea a ningún Express Endpoint.
Corre con zona horaria blindada: `America/Lima` a las `10:00 AM` precisas, con el objetivo de encajar en horas de oficina amigables y garantizar la entrega exitosa del mensaje por Twilio.

**Transacción en Secuencia Atómica:**
```javascript
await twilioWhatsappService.sendWhatsApp(telefonoDestino, mensajeWS);

await prisma.cuentas_por_cobrar.update({
    where: { id: cuenta.id },
    data: { notificacion_parcial_enviada: true } // Blindaje.
});
```
