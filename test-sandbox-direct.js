// Archivo: test-sandbox-direct.js
import { twilioProvider } from "./src/shared/services/twilio.whatsapp.service.js";

async function probarTwilioDirecto() {
  console.log("🚀 Iniciando simulación DIRECTA al Sandbox de Twilio...");

  // 👉 1. REEMPLAZA ESTO ABAJO POR TU NÚMERO DE WHATSAPP DONDE ENVIASTE EL "join"
  // El formato ideal es con el código de país. Si eres de Perú, sería con 51.
  // Ejemplo: '51999888777' o '+51999888777'
  const miNumeroDeTelefono = "51940554669";

  // 👉 2. REGLA DEL SANDBOX:
  // Como estamos en el Sandbox de prueba y NO podemos aprobar nuestras propiasS
  // plantillas con `HX...`, Meta (WhatsApp) NOS OBLIGA a mandar un texto
  // idéntico en inglés si queremos que el mensaje llegue como notificación proactiva.
  const mensajeSandBoxObligatorio = `Your Club Gema appointment is coming up on July 10`;

  try {
    console.log(`Enviando mensaje de prueba a: ${miNumeroDeTelefono}...`);

    const resultado = await twilioProvider.sendWhatsAppMessage(
      miNumeroDeTelefono,
      mensajeSandBoxObligatorio,
    );

    if (resultado) {
      console.log(
        "✅ ¡Éxito! El mensaje salió hacia Twilio. Revisa tu celular.",
      );
    } else {
      console.error(
        "❌ Twilio rechazó el envío. Verifica tus credenciales .env",
      );
    }
  } catch (err) {
    console.error("❌ Error explotó el script:", err);
  } finally {
    process.exit(0);
  }
}

probarTwilioDirecto();
