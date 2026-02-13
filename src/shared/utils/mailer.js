import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendCredentialsEmail = async (email, nombres, username) => {
  const mailOptions = {
    from: `"Academia Gema" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '¡Bienvenido a la Academia Gema! 🏐 Tus credenciales',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px; text-transform: uppercase;">Academia Gema</h1>
          <div style="height: 4px; width: 50px; background-color: #f97316; margin: 15px auto; border-radius: 2px;"></div>
          <p style="color: #bfdbfe; margin: 0; font-size: 16px;">¡Tu camino al éxito deportivo comienza aquí!</p>
        </div>

        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0; font-size: 22px;">¡Hola, ${nombres}!</h2>
          <p style="color: #475569; line-height: 1.6; font-size: 15px;">
            Es un gusto darte la bienvenida a nuestra familia. Tu registro como <strong>Alumno</strong> se ha completado con éxito. 
            A continuación, encontrarás tus credenciales para acceder a nuestra plataforma:
          </p>

          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
            <div style="margin-bottom: 15px;">
              <span style="display: block; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Nombre de usuario</span>
              <span style="color: #1e3a8a; font-size: 18px; font-weight: bold;">${username}</span>
            </div>
            <div>
              <span style="display: block; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Contraseña inicial</span>
              <span style="color: #1e3a8a; font-size: 18px; font-weight: bold;">${username}</span>
              <small style="display: block; color: #f97316; font-size: 11px; margin-top: 4px;">(Corresponde a tu nombre de usuario autogenerado)</small>
            </div>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="${process.env.FRONTEND_URL}/login" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);">
              Ingresar a la Plataforma
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; pt: 20px;">
            Por seguridad, te recomendamos cambiar tu contraseña desde tu perfil una vez que hayas ingresado.
          </p>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            &copy; 2026 Academia Gema. Todos los derechos reservados.
          </p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export const sendPasswordRecoveryEmail = async (email, nombres, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"Academia Gema" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Recuperación de Contraseña - Academia Gema',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 30px;">
        <h2 style="color: #1e3a8a;">Hola, ${nombres}</h2>
        <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para continuar:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Restablecer Contraseña
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b;">Este enlace expirará en 15 minutos.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};