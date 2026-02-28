import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} from '../../config/secret.config.js';
import { logger } from '../utils/logger.util.js';

class TwilioProvider {
  constructor() {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      this.isInitialized = true;
    } else {
      logger.warn(
        '[Twilio] Faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN. El proveedor no se inicializó.'
      );
      this.isInitialized = false;
    }
  }

  async sendWhatsAppMessage(to, message, maxRetries = 2) {
    if (!this.isInitialized) {
      logger.error('[Twilio] Intento de envío denegado: El cliente no está configurado.');
      return false;
    }

    const cleanTo = to.replace(/\D/g, '');
    const finalTo = cleanTo.startsWith('51') ? cleanTo : `51${cleanTo}`;
    const formattedTo = `whatsapp:+${finalTo}`;

    // Twilio sandbox requires the exact + sign, so we strip and format it predictably
    const cleanFrom = TWILIO_PHONE_NUMBER.replace(/\D/g, '');
    const formattedFrom = `whatsapp:+${cleanFrom}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const envioPromise = this.client.messages.create({
          body: message,
          from: formattedFrom,
          to: formattedTo,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Excedido (5s)')), 5000)
        );

        const response = await Promise.race([envioPromise, timeoutPromise]);

        logger.info(`[Twilio] Mensaje de WhatsApp enviado a ${formattedTo}. SID: ${response.sid}`);
        return true;
      } catch (error) {
        logger.warn(`[Twilio] Intento ${attempt} fallido al enviar a ${to}: ${error.message}`);
        if (attempt === maxRetries) {
          logger.error(
            `[Twilio] Error definitivo al enviar WhatsApp a ${to} tras ${maxRetries} intentos.`
          );
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    return false;
  }
}

export const twilioProvider = new TwilioProvider();
