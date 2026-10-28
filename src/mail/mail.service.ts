import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST');
    const port = this.config.get<number>('MAIL_PORT');
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');

    if (!host || !port || !user || !pass) {
      this.transporter = null;
      this.logger.warn('Mail transport is not configured. Email delivery is disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const link = `${frontendUrl}/verify-email?token=${token}`;


    if (!this.transporter) {
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM') ?? 'no-reply@localhost',
      to,
      subject: 'Verify your email',
      html: `<h2>Welcome!</h2><p>Click the link to verify your email:</p><a href="${link}">${link}</a><p>This link expires in 24 hours.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const link = `${frontendUrl}/reset-password?token=${token}`;


    if (!this.transporter) {
      return;
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM') ?? 'no-reply@localhost',
      to,
      subject: 'Reset your password',
      html: `<h2>Password reset</h2><p>Click the link to reset your password:</p><a href="${link}">${link}</a><p>This link expires in 1 hour.</p><p>If you did not request this, ignore this email.</p>`,
    });
  }
}
