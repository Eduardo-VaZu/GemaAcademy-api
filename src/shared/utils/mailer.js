import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del transporte con Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

export const sendCredentialsEmail = async (email, nombres, password) => {
  const mailOptions = {
    from: `"Academia Gema" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '¡Bienvenido! Tus credenciales de acceso',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #2563eb;">¡Hola, ${nombres}!</h2>
        <p>Tu registro como <strong>Alumno</strong> en la Academia Gema ha sido exitoso.</p>
        <p>Usa los siguientes datos para ingresar a la plataforma:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 10px;">
          <p><strong>Usuario:</strong> ${email}</p>
          <p><strong>Contraseña:</strong> ${password}</p>
        </div>
        <br>
        <a href="https://tu-web.com/login" style="background: #f97316; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Iniciar Sesión</a>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};