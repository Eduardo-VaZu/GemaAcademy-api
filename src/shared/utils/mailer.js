import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendCredentialsEmail = async (email, nombres, password) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Academia Gema <onboarding@resend.dev>',
      to: [email],
      subject: '¡Bienvenido a Academia Gema! - Tus Credenciales',
      html: `
        <h1>¡Hola, ${nombres}!</h1>
        <p>Tu cuenta ha sido creada con éxito. Aquí tienes tus datos de acceso:</p>
        <ul>
          <li><strong>Usuario:</strong> ${email}</li>
          <li><strong>Contraseña temporal:</strong> ${password}</li>
        </ul>
        <p>Puedes iniciar sesión en: <a href="https://tudominio.com/login">Academia Gema Login</a></p>
      `,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Error enviando correo:", err);
  }
};