import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { renderEmail } from './mail.templates';

/** "an admin", "a manager" -- role names are written by whoever made them. */
function withArticle(role: string): string {
  return `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`;
}

/**
 * Outbound email. Transport is configured from env:
 *
 *   MAIL_SERVICE   nodemailer "well-known service" (e.g. gmail). Optional.
 *   MAIL_HOST / MAIL_PORT / MAIL_SECURE   explicit SMTP; used when MAIL_SERVICE is unset.
 *   MAIL_USER / MAIL_PASSWORD             SMTP credentials (Gmail: an App Password).
 *   MAIL_FROM                             From header; defaults to MAIL_USER.
 *   APP_URL                               Web app origin used to build links.
 *
 * With no MAIL_USER the service runs in "log only" mode so local development
 * never needs real SMTP credentials — the link is printed to the service log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly brand = 'Stow';

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('MAIL_USER');
    const pass = config.get<string>('MAIL_PASSWORD');
    this.from = config.get<string>('MAIL_FROM') ?? user ?? 'no-reply@localhost';
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');

    if (!user || !pass) {
      this.transporter = null;
      this.logger.warn(
        'MAIL_USER/MAIL_PASSWORD not set — emails will be logged, not sent.',
      );
      return;
    }

    const service = config.get<string>('MAIL_SERVICE');
    this.transporter = nodemailer.createTransport(
      service
        ? { service, auth: { user, pass } }
        : {
            host: config.get<string>('MAIL_HOST'),
            port: Number(config.get<string>('MAIL_PORT') ?? 587),
            secure: config.get<string>('MAIL_SECURE') === 'true',
            auth: { user, pass },
          },
    );
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: `Verify your ${this.brand} email`,
      link,
      html: renderEmail({
        brand: this.brand,
        title: 'Verify your email address',
        intro: `Thanks for signing up for ${this.brand}. Confirm your email address to activate your account.`,
        cta: 'Verify email',
        link,
        footer:
          'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
      }),
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: `Reset your ${this.brand} password`,
      link,
      html: renderEmail({
        brand: this.brand,
        title: 'Reset your password',
        intro:
          'We received a request to reset the password for your account. Choose a new one using the button below.',
        cta: 'Reset password',
        link,
        footer:
          'This link expires in 1 hour. If you did not request a reset, no action is needed.',
      }),
    });
  }

  async sendInviteEmail(
    to: string,
    token: string,
    context: { workspace: string; inviter: string; role: string },
  ): Promise<void> {
    const link = `${this.appUrl}/invite?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: `${context.inviter} invited you to ${context.workspace}`,
      link,
      html: renderEmail({
        brand: this.brand,
        title: `Join ${context.workspace}`,
        intro: `${context.inviter} has invited you to ${context.workspace} on ${this.brand} as ${withArticle(context.role)}. Accept below to get access.`,
        cta: 'Accept invitation',
        link,
        footer:
          'This invitation expires in 7 days. If you were not expecting it, you can ignore this email.',
      }),
    });
  }

  /**
   * Never throws: a mail outage must not fail registration or password reset.
   * Failures are logged with enough context to diagnose.
   */
  private async send(msg: {
    to: string;
    subject: string;
    html: string;
    link: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[mail:dry-run] to=${msg.to} subject="${msg.subject}"\n  ${msg.link}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
      this.logger.log(`Sent "${msg.subject}" to ${msg.to}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send "${msg.subject}" to ${msg.to}: ${err?.message ?? err}`,
      );
    }
  }
}
