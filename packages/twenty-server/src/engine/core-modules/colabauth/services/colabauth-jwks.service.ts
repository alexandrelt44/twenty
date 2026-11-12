import { Injectable } from '@nestjs/common';

import { createPublicKey, type JsonWebKey, type KeyObject } from 'crypto';

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const JWKS_MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const JWKS_REQUEST_TIMEOUT_MS = 10_000;

type JwksResponse = { keys?: (JsonWebKey & { kid?: string })[] };

@Injectable()
export class ColabauthJwksService {
  private keys = new Map<string, KeyObject>();
  private fetchedFromIssuer: string | null = null;
  private fetchedAt = 0;

  async getSigningKey(issuer: string, kid: string): Promise<KeyObject | null> {
    const isStale =
      this.fetchedFromIssuer !== issuer ||
      Date.now() - this.fetchedAt > JWKS_CACHE_TTL_MS;

    // A key the cache does not know may have just been rotated in, so refetch
    // once, but not more often than a minute to avoid hammering the issuer.
    const isUnknownKidRefreshAllowed =
      !this.keys.has(kid) &&
      Date.now() - this.fetchedAt > JWKS_MIN_REFRESH_INTERVAL_MS;

    if (isStale || isUnknownKidRefreshAllowed) {
      await this.refresh(issuer);
    }

    return this.keys.get(kid) ?? null;
  }

  private async refresh(issuer: string): Promise<void> {
    const response = await fetch(`${issuer.replace(/\/$/, '')}/oauth2/jwks`, {
      signal: AbortSignal.timeout(JWKS_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`JWKS request failed with status ${response.status}`);
    }

    const { keys = [] } = (await response.json()) as JwksResponse;

    this.keys = new Map(
      keys
        .filter((key) => typeof key.kid === 'string')
        .map((key) => [
          key.kid as string,
          createPublicKey({ key, format: 'jwk' }),
        ]),
    );
    this.fetchedFromIssuer = issuer;
    this.fetchedAt = Date.now();
  }
}
