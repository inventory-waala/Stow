import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SizeLookup {
  id: string;
  label: string;
  sku: string | null;
  variant: { id: string; name: string };
  product: { id: string; name: string; code: string | null };
}

export interface MovementRequest {
  size_id: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  quantity: string;
  from_location_id?: string;
  to_location_id?: string;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
}

/**
 * Thin HTTP client for inventory-service. Calls carry the caller's own bearer
 * token, so inventory applies its own tenant and permission checks; this
 * service never holds credentials of its own.
 *
 * inventory-service owns stock. Nothing here caches quantities — a purchase
 * order records what was bought, and the stock consequence is inventory's
 * single source of truth.
 */
@Injectable()
export class InventoryClient {
  private readonly logger = new Logger(InventoryClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('INVENTORY_SERVICE_URL') ?? 'http://localhost:3002'
    ).replace(/\/$/, '');
  }

  /** Resolves a stock unit so its names can be denormalised onto the document. */
  async getSize(sizeId: string, token: string): Promise<SizeLookup> {
    return this.request<SizeLookup>(
      'GET',
      `/sizes/${encodeURIComponent(sizeId)}`,
      token,
    );
  }

  async createMovement(body: MovementRequest, token: string): Promise<unknown> {
    return this.request<unknown>('POST', '/stock/movements', token, body);
  }

  private async request<T>(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err: any) {
      // Connection refused, DNS failure, timeout: inventory-service is down.
      this.logger.error(
        `inventory-service unreachable at ${this.baseUrl}: ${err?.message ?? err}`,
      );
      throw new BadGatewayException(
        'inventory-service is unreachable, so stock could not be updated',
      );
    }

    const text = await response.text();
    const payload = text ? safeJson(text) : undefined;

    if (!response.ok) {
      // Surface inventory's own message and status (e.g. 409 insufficient
      // stock) rather than flattening everything into a 502.
      const message =
        (payload as any)?.message ??
        `inventory-service responded ${response.status}`;
      throw new HttpException(
        { statusCode: response.status, message, source: 'inventory-service' },
        response.status,
      );
    }

    return payload as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
