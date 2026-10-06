import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface StoredChallenge {
  challenge: string;
  expiresAt: number;
}

/**
 * Short-lived store for WebAuthn challenges.
 *
 * A challenge MUST be generated and remembered by the server, then compared
 * against what the authenticator signed. Accepting the expected challenge from
 * the client would let a caller replay a captured assertion, so this sits
 * between the "generate options" and "verify" halves of every ceremony.
 *
 * In-memory by design for now: it is correct for a single instance and is the
 * seam to swap for Redis in Phase 11 (see docs/plan.md). Running more than one
 * replica before that swap will break ceremonies that land on another pod.
 */
@Injectable()
export class ChallengeStore implements OnModuleDestroy {
  private readonly challenges = new Map<string, StoredChallenge>();

  // Constructor takes no arguments: Nest would otherwise try to inject the
  // primitive as a provider. Tune via PASSKEY_CHALLENGE_TTL_MS.
  private readonly ttlMs =
    Number(process.env.PASSKEY_CHALLENGE_TTL_MS) || 5 * 60 * 1000;

  // Do not keep the event loop alive just for cleanup.
  private readonly sweeper: NodeJS.Timeout = setInterval(
    () => this.sweep(),
    60 * 1000,
  ).unref();

  set(key: string, challenge: string): void {
    this.challenges.set(key, {
      challenge,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Returns the stored challenge and removes it — challenges are single use,
   * so a replay of the same assertion finds nothing the second time.
   */
  consume(key: string): string | null {
    const entry = this.challenges.get(key);
    if (!entry) return null;

    this.challenges.delete(key);

    if (entry.expiresAt < Date.now()) return null;

    return entry.challenge;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.challenges) {
      if (entry.expiresAt < now) this.challenges.delete(key);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
    this.challenges.clear();
  }
}
