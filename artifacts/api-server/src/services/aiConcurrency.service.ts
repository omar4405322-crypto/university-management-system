/**
 * Per-user concurrent AI request tracker.
 * Prevents a single user from spawning simultaneous AI generation requests
 * to avoid quota drain and rate limit exhaustion, without locking other users
 * or regular university endpoints.
 */
class AiUserConcurrencyTracker {
  private activeUserLocks = new Map<number, number>(); // userId -> acquiredTimestamp
  private readonly LOCK_TTL_MS = 45_000; // Fail-safe auto-release after 45s

  public acquire(userId: number, now = Date.now()): boolean {
    const existing = this.activeUserLocks.get(userId);
    if (existing !== undefined) {
      if (now - existing < this.LOCK_TTL_MS) {
        return false; // Still active
      }
      // Expired fail-safe
      this.activeUserLocks.delete(userId);
    }

    this.activeUserLocks.set(userId, now);
    return true;
  }

  public release(userId: number): void {
    this.activeUserLocks.delete(userId);
  }

  public clear(): void {
    this.activeUserLocks.clear();
  }

  public isLocked(userId: number, now = Date.now()): boolean {
    const existing = this.activeUserLocks.get(userId);
    if (existing === undefined) return false;
    if (now - existing >= this.LOCK_TTL_MS) {
      this.activeUserLocks.delete(userId);
      return false;
    }
    return true;
  }
}

export const aiUserConcurrency = new AiUserConcurrencyTracker();
