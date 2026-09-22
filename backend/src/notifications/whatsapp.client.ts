import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente da Evolution API.
 *
 * Sem `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` configurados, cai em modo de
 * registro: a mensagem aparece no log em vez de sair pelo WhatsApp. É o que
 * mantém o ambiente de desenvolvimento utilizável sem uma instância conectada.
 */
@Injectable()
export class WhatsappClient {
  private readonly logger = new Logger(WhatsappClient.name);

  private readonly baseUrl = (process.env.EVOLUTION_API_URL ?? '').replace(
    /\/+$/,
    '',
  );
  private readonly apiKey = process.env.EVOLUTION_API_KEY ?? '';
  /** Instância da plataforma, usada pelas barbearias sem número próprio. */
  private readonly defaultInstance =
    process.env.EVOLUTION_INSTANCE ?? 'barbearia';
  private readonly defaultCountryCode =
    process.env.WHATSAPP_COUNTRY_CODE ?? '55';

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Envia pela instância da barbearia quando ela tem uma conectada; senão,
   * pela instância padrão da plataforma. A Evolution API atende várias
   * instâncias com a mesma chave global, uma por número de WhatsApp.
   */
  async sendText(
    rawPhone: string,
    message: string,
    instance?: string | null,
  ): Promise<void> {
    const number = this.normalizePhone(rawPhone);

    if (!number) {
      this.logger.warn(
        `Mensagem não enviada: telefone ausente ou inválido ("${rawPhone}").`,
      );
      return;
    }

    if (!this.isConfigured) {
      this.logger.log(
        `[modo log] WhatsApp para ${number}:\n${message}\n(defina EVOLUTION_API_URL e EVOLUTION_API_KEY para enviar de verdade)`,
      );
      return;
    }

    const response = await fetch(
      `${this.baseUrl}/message/sendText/${encodeURIComponent(instance || this.defaultInstance)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({ number, text: message }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      // Lançar aqui é intencional: o BullMQ reprocessa com backoff exponencial.
      throw new Error(
        `Evolution API respondeu ${response.status} ao enviar para ${number}. ${detail.slice(0, 300)}`,
      );
    }
  }

  /**
   * Normaliza para o formato que a Evolution API espera: só dígitos, com DDI.
   * Números brasileiros digitados sem o 55 recebem o código configurado.
   */
  private normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;

    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (digits.length >= 12) return digits;

    return `${this.defaultCountryCode}${digits}`;
  }
}
