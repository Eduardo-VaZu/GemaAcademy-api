import fetch from 'node-fetch';
import { logger } from '../utils/logger.util.js';
import { BREVO_API_KEY } from '../../config/secret.config.js';

export const whatsappService = {
  /**
   * Envía un mensaje de WhatsApp usando una plantilla de Brevo.
   * @param {Object} options - Opciones de envío.
   * @param {string} options.to - Número celular destino (Ej. '+51999999999').
   * @param {number} options.templateId - ID de la plantilla de WhatsApp en Brevo.
   * @param {Object} [options.params] - Variables para la plantilla (opcional).
   * @returns {Promise<boolean>} Retorna true si el envío fue exitoso.
   */
  async sendTemplate(options) {
    if (!BREVO_API_KEY) {
      logger.warn('BREVO_API_KEY no está configurado, omitiendo envío de WhatsApp a ' + options.to);
      return false;
    }

    const { to, templateId, params = {} } = options;

    let formattedNumber = to.replace(/\s+/g, '');
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+51${formattedNumber}`;
    }

    const bodyData = {
      recipient: {
        contactNumber: formattedNumber,
      },
      sender: {},
      templateId: templateId,
      params: params,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const myHeaders = new Headers();
      myHeaders.append('accept', 'application/json');
      myHeaders.append('api-key', BREVO_API_KEY.trim());
      myHeaders.append('content-type', 'application/json');

      const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(bodyData),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.text();
        logger.error(`Error enviando WhatsApp con Brevo: ${response.status} - ${errorData}`);
        return false;
      }

      logger.info(`WhatsApp (Plantilla ${templateId}) enviado exitosamente a ${formattedNumber}`);
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.error(`Timeout (5s) excedido enviando WhatsApp a ${formattedNumber}`);
      } else {
        logger.error(`Error inesperado enviando WhatsApp a ${formattedNumber}: ${error.message}`);
      }
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },
};
