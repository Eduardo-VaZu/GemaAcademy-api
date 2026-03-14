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

  /**
   * Valida si un número telefónico tiene el formato correcto.
   *
   * MEJORA #5: Se agregó el flag `strict` para controlar si la validación es solo Perú
   * o si acepta cualquier número internacional con código de país (11+ dígitos).
   *
   * @param {string} to - Número a validar.
   * @param {boolean} [strict=true] - true = solo celulares peruanos. false = acepta internacionales.
   */
  isValidFormat(to, strict = true) {
    const cleanTo = to.replace(/\D/g, '');
    let finalTo = cleanTo;

    if (cleanTo.startsWith('51') && cleanTo.length === 11) {
      finalTo = cleanTo.slice(2);
    }

    if (strict) {
      // Modo estricto: solo celulares peruanos (9 dígitos, empieza en 9)
      if (finalTo.length !== 9 || !finalTo.startsWith('9')) {
        logger.warn(`[Twilio] Número detectado como inválido o no celular de Perú: ${to}`);
        return false;
      }
    } else {
      // Modo permisivo: acepta cualquier número con al menos 7 dígitos
      if (cleanTo.length < 7) {
        logger.warn(`[Twilio] Número demasiado corto para ser válido: ${to}`);
        return false;
      }
    }

    return true;
  }

  formatNumber(to) {
    const cleanTo = to.replace(/\D/g, '');
    const finalTo = cleanTo.startsWith('51') ? cleanTo : `51${cleanTo}`;
    return `whatsapp:+${finalTo}`;
  }

  getTwilioSender() {
    const cleanFrom = TWILIO_PHONE_NUMBER.replace(/\D/g, '');
    return `whatsapp:+${cleanFrom}`;
  }

  /**
   * Envía un mensaje de texto libre (Solo Sandbox o ventana conversacional de 24h).
   *
   * MEJORA #7: Se retorna el SID del mensaje para que el caller pueda guardarlo en DB si lo necesita.
   * Retorna { success: boolean, sid: string | null } en lugar de solo boolean.
   */
  async sendWhatsAppMessage(to, message, maxRetries = 2) {
    if (!this.isInitialized) {
      logger.error('[Twilio] Intento de envío denegado: El cliente no está configurado.');
      return { success: false, sid: null };
    }

    if (!this.isValidFormat(to)) {
      return { success: false, sid: null };
    }

    const formattedTo = this.formatNumber(to);
    const formattedFrom = this.getTwilioSender();

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

        logger.info(`[Twilio] Libre: WA enviado a ${formattedTo}. SID: ${response.sid}`);
        return { success: true, sid: response.sid };
      } catch (error) {
        logger.warn(
          `[Twilio] Libre: Intento ${attempt} fallido al enviar a ${to}: ${error.message}`
        );
        if (attempt === maxRetries) {
          logger.error(
            `[Twilio] Libre: Error definitivo al enviar a ${to} tras ${maxRetries} intentos.`
          );
          return { success: false, sid: null };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    return { success: false, sid: null };
  }

  /**
   * Envía un mensaje estructurado usando plantillas pre-aprobadas de Meta (Content API).
   *
   * MEJORA #7: Se retorna el SID del mensaje para que el caller pueda guardarlo en DB si lo necesita.
   * Retorna { success: boolean, sid: string | null } en lugar de solo boolean.
   *
   * @param {string} to - Número destino.
   * @param {string} contentSid - SID de la plantilla en Twilio Content API.
   * @param {Object} [variables={}] - Variables de la plantilla, ej: { "1": "Juan", "2": "2026-03-20" }.
   * @param {number} [maxRetries=2]
   */
  async sendTemplateMessage(to, contentSid, variables = {}, maxRetries = 2) {
    if (!this.isInitialized) {
      logger.error('[Twilio] Intento de plantilla denegado: El cliente no está configurado.');
      return { success: false, sid: null };
    }

    if (!contentSid) {
      logger.error('[Twilio] Content SID no proporcionado para la plantilla.');
      return { success: false, sid: null };
    }

    if (!this.isValidFormat(to)) {
      return { success: false, sid: null };
    }

    const formattedTo = this.formatNumber(to);
    const formattedFrom = this.getTwilioSender();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const payload = {
          contentSid: contentSid,
          from: formattedFrom,
          to: formattedTo,
        };

        if (Object.keys(variables).length > 0) {
          payload.contentVariables = JSON.stringify(variables);
        }

        const envioPromise = this.client.messages.create(payload);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Excedido (5s)')), 5000)
        );

        const response = await Promise.race([envioPromise, timeoutPromise]);

        logger.info(`[Twilio] Plantilla enviada a ${formattedTo}. SID: ${response.sid}`);
        return { success: true, sid: response.sid };
      } catch (error) {
        logger.warn(
          `[Twilio] Plantilla: Intento ${attempt} fallido al enviar a ${to}: ${error.message}`
        );
        if (attempt === maxRetries) {
          logger.error(
            `[Twilio] Plantilla: Error definitivo al enviar a ${to} tras ${maxRetries} intentos.`
          );
          return { success: false, sid: null };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    return { success: false, sid: null };
  }
}

export const twilioProvider = new TwilioProvider();
