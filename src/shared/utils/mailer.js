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
        <p>Tu cuenta ha sido creada. Para ingresar, utiliza tu número de documento como contraseña inicial.</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; border-left: 5px solid #f97316;">
          <p style="margin: 5px 0;"><strong>Usuario:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Contraseña:</strong> ${password} <span style="color: #666; font-size: 0.8em;">(Tu número de documento)</span></p>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; mt: 10px;">
          * Te recomendamos cambiar tu contraseña una vez que hayas ingresado por primera vez.
        </p>
        <br>
        <div style="text-align: center;">
          <a href="https://tu-web.com/login" style="background: #f97316; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Iniciar Sesión</a>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};