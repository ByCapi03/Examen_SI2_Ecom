import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const esc = (v: string) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendTemporaryPassword(email: string, name: string, temporaryPassword: string) {
    const subject = 'Bienvenido a Boutique Elegance';
    const htmlContent = `
      <h3>Hola ${name},</h3>
      <p>Tu cuenta ha sido creada en Boutique Elegance.</p>
      <p><strong>Correo:</strong> ${email}</p>
      <p><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
      <p>Por seguridad, esta contraseña debe cambiarse al iniciar sesión.</p>
      <p>La contraseña temporal expira en 24 horas.</p>
      <p>Ingresa en: <a href="http://localhost:5173/login">http://localhost:5173/login</a></p>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: `"Boutique Elegance" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject,
        html: htmlContent,
      });
      this.logger.log(`Email enviado a ${email}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error enviando correo a ${email}`, error);
      throw error;
    }
  }

  async sendActivationCode(email: string, name: string, code: string) {
    const subject = 'Activa tu cuenta digital - Boutique Elegance';
    const htmlContent = `
      <h3>Hola ${name},</h3>
      <p>Has solicitado activar tu cuenta digital en Boutique Elegance.</p>
      <p>Tu código de activación es:</p>
      <h2 style="letter-spacing: 8px; font-family: monospace; color: #333;">${code}</h2>
      <p>Este código es válido por <strong>15 minutos</strong>.</p>
      <p>Si no solicitaste esto, ignora este correo.</p>
      <p>Activa tu cuenta en: <a href="http://localhost:5173/activate-account">http://localhost:5173/activate-account</a></p>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: `"Boutique Elegance" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject,
        html: htmlContent,
      });
      this.logger.log(`Código de activación enviado a ${email}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error enviando código de activación a ${email}`, error);
      throw error;
    }
  }

  async sendPaymentConfirmation(email: string, name: string, amount: number, paymentMethod: string, referenceId: string) {
    const subject = 'Confirmación de Pago - Boutique Elegance';
    const htmlContent = `
      <h3>Hola ${name},</h3>
      <p>Hemos recibido la confirmación de tu pago exitosamente.</p>
      <p><strong>Monto:</strong> Bs. ${amount}</p>
      <p><strong>Método de pago:</strong> ${paymentMethod}</p>
      <p><strong>Referencia:</strong> ${referenceId}</p>
      <p>Gracias por tu preferencia.</p>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: `"Boutique Elegance" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject,
        html: htmlContent,
      });
      this.logger.log(`Confirmación de pago enviada a ${email}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error enviando confirmación de pago a ${email}`, error);
      throw error;
    }
  }

  private get frontendUrl() {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  async sendTenantVerificationCode(email: string, name: string, code: string, tenantName: string) {
    await this.transporter.sendMail({
      from: `"DRESSED" <${this.configService.get<string>('SMTP_USER')}>`,
      to: email,
      subject: 'Verifica tu correo - DRESSED',
      html: `
        <h3>Hola ${esc(name)},</h3>
        <p>Registraste la empresa <strong>${esc(tenantName)}</strong> en DRESSED.</p>
        <p>Tu código de verificación es:</p>
        <h2 style="letter-spacing: 8px; font-family: monospace; color: #182D2A;">${esc(code)}</h2>
        <p>Es válido por <strong>15 minutos</strong>. Si no fuiste tú, ignora este correo.</p>
      `,
    });
    this.logger.log(`Código de verificación de empresa enviado a ${email}`);
  }

  async sendTenantWelcome(email: string, name: string, tenantName: string, slug: string, planName: string) {
    const loginUrl = `${this.frontendUrl}/login?tenant=${encodeURIComponent(slug)}`;
    await this.transporter.sendMail({
      from: `"DRESSED" <${this.configService.get<string>('SMTP_USER')}>`,
      to: email,
      subject: `Bienvenido a DRESSED, ${tenantName}`,
      html: `
        <h3>¡Bienvenido, ${esc(name)}!</h3>
        <p>Tu empresa <strong>${esc(tenantName)}</strong> ya está activa en el <strong>${esc(planName)}</strong>.</p>
        <p><strong>Identificador:</strong> ${esc(slug)}</p>
        <p>Siguientes pasos: registra tus sucursales, empleados, productos e inventario desde el panel.</p>
        <p>Ingresa en: <a href="${loginUrl}">${loginUrl}</a></p>
      `,
    });
    this.logger.log(`Correo de bienvenida enviado a ${email}`);
  }
}
