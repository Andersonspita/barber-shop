import { Injectable, Logger } from '@nestjs/common';

const BASE_URLS = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
} as const;

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AsaasError';
  }
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string | null;
  externalReference?: string | null;
}

/**
 * Cliente da API v3 do Asaas.
 *
 * Autenticação pelo cabeçalho `access_token` (não é Bearer). O `User-Agent` é
 * obrigatório para contas criadas a partir de jun/2024. `ASAAS_ENV` escolhe
 * sandbox (padrão, seguro para testar) ou production — a chave de um ambiente
 * não funciona no outro.
 */
@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);

  get isConfigured(): boolean {
    return Boolean(process.env.ASAAS_API_KEY?.trim());
  }

  private get baseUrl(): string {
    const override = process.env.ASAAS_API_URL?.trim();
    if (override) return override.replace(/\/+$/, '');
    return process.env.ASAAS_ENV === 'production'
      ? BASE_URLS.production
      : BASE_URLS.sandbox;
  }

  async createCustomer(input: {
    name: string;
    cpfCnpj: string;
    email?: string | null;
    mobilePhone?: string | null;
    externalReference: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/customers', {
      ...input,
      // Os avisos ao dono saem pelo WhatsApp da plataforma; sem e-mail/SMS do Asaas.
      notificationDisabled: true,
    });
  }

  /**
   * Cobrança avulsa de uma fatura (Pix, boleto ou cartão). O `externalReference`
   * é o id da fatura: o webhook de pagamento volta com ele.
   */
  async createPayment(input: {
    customer: string;
    /** UNDEFINED = quem paga escolhe Pix, boleto ou cartão na página da fatura. */
    billingType: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
  }): Promise<AsaasPayment> {
    return this.request('POST', '/payments', input);
  }

  /** Cancela a cobrança (fatura baixada por fora ou cancelada). 404 conta como sucesso. */
  async deletePayment(id: string): Promise<void> {
    try {
      await this.request('DELETE', `/payments/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof AsaasError && error.status === 404) return;
      throw error;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const apiKey = process.env.ASAAS_API_KEY?.trim();
    if (!apiKey) throw new AsaasError('Cobrança não configurada.', 503);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GerenteBarber/1.0',
          access_token: apiKey,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(
        `Asaas fora do ar (${method} ${path}): ${String(error)}`,
      );
      throw new AsaasError('O Asaas não respondeu. Tente de novo.', 502);
    }

    const payload = (await response.json().catch(() => null)) as {
      errors?: Array<{ description?: string }>;
    } | null;
    if (!response.ok) {
      const message =
        payload?.errors
          ?.map((e) => e.description)
          .filter(Boolean)
          .join('; ') || `Asaas respondeu ${response.status}`;
      throw new AsaasError(message, response.status);
    }
    return payload as T;
  }
}
