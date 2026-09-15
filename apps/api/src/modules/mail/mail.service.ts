import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Canal de e-mail da plataforma. Sem ele, um alerta de doação com janela de
 * poucas horas só era visto por quem estivesse com a aba aberta, e quem perdia
 * a senha ficava trancado para sempre.
 *
 * Em desenvolvimento não há SMTP configurado: a mensagem vai para o log (com o
 * link completo), o que mantém os fluxos testáveis sem depender de provedor.
 * Falha de envio nunca derruba a operação que a originou — um cadastro não pode
 * ser perdido porque o servidor de e-mail estava fora.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('mail.host');
    if (!host) {
      this.logger.log('SMTP não configurado: e-mails serão registrados no log em vez de enviados.');
      return;
    }

    this.transporter = createTransport({
      host,
      port: this.config.get<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure'),
      auth: this.config.get<string>('mail.user')
        ? { user: this.config.get<string>('mail.user'), pass: this.config.get<string>('mail.password') }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[e-mail simulado] para=${message.to} assunto="${message.subject}"\n${message.text}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('mail.from'),
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${message.to}: ${(err as Error).message}`);
      return false;
    }
  }
}
